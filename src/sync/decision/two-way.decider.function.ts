import type { FileStatModel, FolderStatModel, StatModel } from '~/types';
import t from '~/i18n';
import { normalizePathToAbsolute } from '~/platform/path';
import { ConflictStrategy, UnmergeableStrategy } from '~/settings';
import { hasInvalidChar } from '~/utils/has-invalid-char';
import logger from '~/utils/logger';
import type { SyncDecisionInput } from './sync-decision.interface';
import { BaseTask } from '../tasks/task.interface';
import isChanged from '../utils/is-changed';
import { isMergeablePath } from '../utils/is-mergeable-path';

export function twoWayDecider(input: SyncDecisionInput): BaseTask[] {
	const {
		currentLocalStats: localStats,
		currentRemoteStats: remoteStats,
		records,
		taskFactory,
		remoteBaseDir,
		settings,
	} = input;
	const mixedPath = Array.from(
		new Set([...localStats.keys(), ...remoteStats.keys(), ...records.keys()]),
	);

	logger.debug('local state', Array.from(localStats.keys()));
	logger.debug('remote state', Array.from(remoteStats.keys()));
	logger.debug('records', Array.from(records.keys()));

	const tasks: BaseTask[] = [];

	const files: Array<{
		path: string;
		local?: FileStatModel;
		remote?: FileStatModel;
	}> = [];
	const folders: Array<{
		path: string;
		local?: FolderStatModel;
		remote?: FolderStatModel;
	}> = [];
	const fileFolders: Array<{
		path: string;
		local: StatModel;
		remote: StatModel;
	}> = [];
	const removeRecords: Array<string> = [];

	for (const path of mixedPath) {
		if (hasInvalidChar(path)) throw new Error(`${t('sync.fileOp.filenameError')}: ${path}`);
		const remote = remoteStats.get(path);
		const local = localStats.get(path);
		if (!(local?.isDir || remote?.isDir))
			files.push({
				path,
				local,
				remote,
			});
		else if (!(remote?.isDir === false || local?.isDir === false))
			folders.push({
				path,
				local,
				remote,
			});
		else if (remote && local)
			fileFolders.push({
				path,
				local,
				remote,
			});
		else removeRecords.push(path);
	}

	const routeConflict = (params: {
		local: FileStatModel;
		remote: FileStatModel;
		options: { localPath: string; remotePath: string };
		strategy: ConflictStrategy;
		unmergeableStrategy: UnmergeableStrategy;
	}) => {
		function commonRoutes(strategy: UnmergeableStrategy | ConflictStrategy) {
			if (strategy === UnmergeableStrategy.Skip) return;
			if (strategy === UnmergeableStrategy.KeepLocal) {
				tasks.push(taskFactory.createPushTask({ ...options, local }));
				return true;
			}
			if (strategy === UnmergeableStrategy.KeepRemote) {
				tasks.push(taskFactory.createPullTask({ ...options, remote }));
				return true;
			}
			if (strategy === UnmergeableStrategy.LatestTimeStamp) {
				if (local.mtime >= remote.mtime) {
					tasks.push(taskFactory.createPushTask({ ...options, local }));
					return true;
				}
				tasks.push(taskFactory.createPullTask({ ...options, remote }));
				return true;
			}
			return false;
		}
		const { local, remote, options, strategy, unmergeableStrategy } = params;
		if (strategy === ConflictStrategy.DiffMatchPatch && !isMergeablePath(local.path))
			commonRoutes(unmergeableStrategy);
		else if (!commonRoutes(strategy))
			tasks.push(taskFactory.createMergeTask({ ...options, remote, local }));
	};

	// * sync files
	for (const { local, remote, path } of files) {
		const record = records.get(path);
		const localPath = local?.path ?? path;
		const remotePath =
			remote?.path ??
			(local ? normalizePathToAbsolute(remoteBaseDir, path, local.isDir) : remoteBaseDir);

		const options = {
			remotePath,
			localPath,
		};
		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged = false;
		let localChanged = false;

		if (record) {
			if (remote) {
				remoteChanged = isChanged({
					path,
					source: 'remote',
					records,
					currentStats: remoteStats,
				});
				if (local) {
					localChanged = isChanged({
						path,
						source: 'local',
						records,
						currentStats: localStats,
					});
					if (remoteChanged && localChanged) caseName = 'RECORD_REMOTE_LOCAL_CONFLICT';
					else if (remoteChanged) caseName = 'RECORD_REMOTE_LOCAL_PULL';
					else if (localChanged) caseName = 'RECORD_REMOTE_LOCAL_PUSH';
				} else {
					if (remoteChanged) caseName = 'RECORD_REMOTE_NOLOCAL_PULL';
					else caseName = 'RECORD_REMOTE_NOLOCAL_REMOVE';
				}
			} else if (local) {
				localChanged = isChanged({
					path,
					source: 'local',
					records,
					currentStats: localStats,
				});
				if (localChanged) caseName = 'RECORD_NOREMOTE_LOCAL_PUSH';
				else caseName = 'RECORD_NOREMOTE_LOCAL_REMOVE';
			}
		} else {
			if (remote) {
				if (local) {
					if (remote.size === local.size) caseName = 'NORECORD_REMOTE_LOCAL_RECORD';
					else caseName = 'NORECORD_REMOTE_LOCAL_CONFLICT';
				} else caseName = 'NORECORD_REMOTE_NOLOCAL_PULL';
			} else if (local) caseName = 'NORECORD_NOREMOTE_LOCAL_PUSH';
		}

		const operations = {
			NONE: () => {},
			NORECORD_REMOTE_LOCAL_RECORD: () => {
				if (!local || !remote) return;
				logger.debug(`creating new record`, {
					reason: 'both local and remote exist but no record',
				});
				tasks.push(taskFactory.createAddRecordTask({ ...options, local, remote }));
			},
			RECORD_REMOTE_LOCAL_CONFLICT: () => {
				if (!remote || !local) return;
				logger.debug(`Detected conflict between \`${localPath}\` and \`${remotePath}\``, {
					reason: 'both local and remote files changed',
				});
				routeConflict({
					local,
					remote,
					options,
					strategy: settings.conflictStrategy,
					unmergeableStrategy: settings.unmergeableStrategy,
				});
			},
			RECORD_REMOTE_LOCAL_PULL: () => {
				if (!remote || !local) return;
				logger.debug(`Pull remote file \`${remotePath}\` changes to local`, {
					reason: 'remote file changed',
				});
				tasks.push(taskFactory.createPullTask({ ...options, remote }));
			},
			RECORD_REMOTE_LOCAL_PUSH: () => {
				if (!remote || !local) return;
				logger.debug(`Push local file \`${localPath}\` changes to remote`, {
					reason: 'local file changed',
				});
				tasks.push(taskFactory.createPushTask({ ...options, local }));
			},
			RECORD_REMOTE_NOLOCAL_PULL: () => {
				if (!remote) return;
				logger.debug(`Pull remote file \`${remotePath}\` to local`, {
					reason: 'remote file changed and local file does not exist',
				});
				tasks.push(taskFactory.createPullTask({ ...options, remote }));
			},
			RECORD_REMOTE_NOLOCAL_REMOVE: () => {
				if (!remote) return;
				logger.debug(`Remove remote file \`${remote.path}\``, {
					reason: 'remote file is removable',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ ...options, remote }));
			},
			RECORD_NOREMOTE_LOCAL_PUSH: () => {
				if (!local) return;
				logger.debug(`Push local file \`${localPath}\` to remote`, {
					reason: 'local file changed and remote file does not exist',
				});
				tasks.push(taskFactory.createPushTask({ ...options, local }));
			},
			RECORD_NOREMOTE_LOCAL_REMOVE: () => {
				if (!local) return;
				logger.debug(`Remove local file \`${localPath}\``, {
					reason: 'local file is removable',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ ...options, local }));
				return;
			},
			NORECORD_REMOTE_LOCAL_CONFLICT: () => {
				if (!remote || !local) return;
				logger.debug(
					`Detected conflict between local file \`${localPath}\` and remote file ${remotePath}`,
					{ reason: 'both local and remote files exist without a record' },
				);
				routeConflict({
					local,
					remote,
					options,
					strategy: settings.conflictStrategy,
					unmergeableStrategy: settings.unmergeableStrategy,
				});
			},
			NORECORD_REMOTE_NOLOCAL_PULL: () => {
				if (!remote) return;
				logger.debug(`Pull remote file \`${remotePath}\` to local`, {
					reason: 'remote file exists without a local file',
				});
				tasks.push(taskFactory.createPullTask({ ...options, remote }));
			},
			NORECORD_NOREMOTE_LOCAL_PUSH: () => {
				if (!local) return;
				logger.debug(`Push local file \`${localPath}\` to remote`, {
					reason: 'local file exists without a remote file',
				});
				tasks.push(taskFactory.createPushTask({ ...options, local }));
			},
		};

		operations[caseName]();
	}

	// * sync folders
	for (const { path, remote, local } of folders) {
		const record = records.get(path);
		const localPath = local?.path ?? path;
		const remotePath =
			remote?.path ??
			(local ? normalizePathToAbsolute(remoteBaseDir, path, local.isDir) : remoteBaseDir);
		const options = {
			remotePath,
			localPath,
		};

		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged = false;
		let localChanged = false;

		if (record) {
			if (local) {
				if (!remote) {
					localChanged = isChanged({
						path,
						source: 'local',
						records,
						tasks,
						currentStats: localStats,
					});
					if (localChanged) caseName = 'LOCAL_NOREMOTE_RECORD_PUSH';
					else caseName = 'LOCAL_NOREMOTE_RECORD_REMOVE';
				}
			} else if (remote) {
				remoteChanged = isChanged({
					path,
					source: 'remote',
					records,
					tasks,
					currentStats: remoteStats,
				});
				if (remoteChanged) caseName = 'REMOTE_NOLOCAL_RECORD_PULL';
				else caseName = 'REMOTE_NOLOCAL_RECORD_REMOVE';
			}
		} else {
			if (local && remote) caseName = 'LOCAL_REMOTE_NORECORD_RECORD';
			else if (local) caseName = 'LOCAL_NOREMOTE_NORECORD_PUSH';
			else if (remote) caseName = 'REMOTE_NOLOCAL_NORECORD_PULL';
		}

		const operations = {
			NONE: () => {},
			LOCAL_REMOTE_NORECORD_RECORD: () => {
				if (!local || !remote) return;
				logger.debug(`creating new record for folder \`${localPath}\``, {
					reason: 'both local and remote exist but no record',
				});
				tasks.push(taskFactory.createAddRecordTask({ ...options, local, remote }));
			},
			REMOTE_NOLOCAL_RECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create local folder according to remote \`${remotePath}\``, {
					reason: 'remote folder content changed',
				});
				tasks.push(taskFactory.createMkdirLocalTask({ ...options, remote }));
			},
			REMOTE_NOLOCAL_RECORD_REMOVE: () => {
				if (!remote) return;
				logger.debug(`Remove remote folder \`${remotePath}\``, {
					reason: 'remote folder is removable (no content changes)',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ ...options, remote }));
			},
			REMOTE_NOLOCAL_NORECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create  local folder according to remote \`${remotePath}\``, {
					reason: 'remote folder does not exist locally',
				});
				tasks.push(taskFactory.createMkdirLocalTask({ ...options, remote }));
			},
			LOCAL_NOREMOTE_RECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${localPath}\``, {
					reason: 'local folder content changed',
				});
				tasks.push(taskFactory.createMkdirRemoteTask({ ...options, local }));
			},
			LOCAL_NOREMOTE_RECORD_REMOVE: () => {
				if (!local) return;
				logger.debug(`Remove local folder \`${localPath}\``, {
					reason: 'local folder is removable (no content changes)',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ ...options, local }));
			},
			LOCAL_NOREMOTE_NORECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${localPath}\``, {
					reason: 'local folder does not exist remotely',
				});
				tasks.push(taskFactory.createMkdirRemoteTask({ ...options, local }));
			},
		};

		operations[caseName]();
	}

	for (const { path, remote, local } of fileFolders) {
		const record = records.get(path);
		const remotePath = remote.path;
		const localPath = local.path;
		let caseName: keyof typeof operations = 'NONE';
		const localChanged = isChanged({
			path,
			source: 'local',
			records,
			currentStats: localStats,
		});
		const remoteChanged = isChanged({
			path,
			source: 'remote',
			records,
			currentStats: remoteStats,
		});
		const options = { remotePath, localPath };

		if (record) {
			if (localChanged && remoteChanged) caseName = 'CONFLICT';
			if (localChanged) {
				if (local.isDir) caseName = 'LOCAL_DIR_PUSH';
				else caseName = 'LOCAL_FILE_PUSH';
			} else {
				if (remote.isDir) caseName = 'REMOTE_DIR_PULL';
				else caseName = 'REMOTE_FILE_PULL';
			}
		} else caseName = 'CONFLICT';

		const operations = {
			NONE: () => {},
			CONFLICT: () => {
				const _remoteForm = remote.isDir ? 'folder' : 'file';
				const _localForm = local.isDir ? 'folder' : 'file';
				const remoteForm = t(`sync.fileFolderConflict.${_remoteForm}`);
				const localForm = t(`sync.fileFolderConflict.${_localForm}`);
				const message = t(`sync.fileFolderConflict.message`, {
					remoteForm,
					localForm,
					path,
				});
				throw new Error(message);
			},
			LOCAL_DIR_PUSH: () => {
				if (!local.isDir) return;
				logger.debug(`Replace remote file \`${remotePath}\` with local directory`, {
					reason: 'local directory changed but not remote',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ ...options, remote }));
				tasks.push(taskFactory.createMkdirRemoteTask({ ...options, local }));
			},
			REMOTE_FILE_PULL: () => {
				if (!remote.isDir) return;
				logger.debug(`Replace local directory \`${localPath}\` with remote file`, {
					reason: 'remote file changed but not local',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ ...options, local }));
				tasks.push(taskFactory.createMkdirLocalTask({ ...options, remote }));
			},
			LOCAL_FILE_PUSH: () => {
				if (local.isDir) return;
				logger.debug(`Replace remote directory \`${remotePath}\` with local file`, {
					reason: 'local file changed but not remote',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ ...options, remote }));
				tasks.push(taskFactory.createPushTask({ ...options, local }));
			},
			REMOTE_DIR_PULL: () => {
				if (!remote.isDir) return;
				logger.debug(`Replace local file \`${localPath}\` with local directory`, {
					reason: 'local directory changed but not remote',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ ...options, local }));
				tasks.push(taskFactory.createMkdirLocalTask({ ...options, remote }));
			},
		};

		operations[caseName]();
	}

	for (const path of removeRecords) {
		logger.debug(`cleaning orphaned sync record ${path}`, {
			reason: 'both local and remote deleted',
		});
		tasks.push(taskFactory.createCleanRecordTask({ remotePath: path, localPath: path }));
	}

	return tasks;
}
