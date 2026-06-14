import type { FileStat, FolderStat, Stat } from '~/fs';
import t from '~/i18n';
import { ConflictStrategy, UnmergeableStrategy } from '~/types';
import logger from '~/utils/logger';
import type { BaseTask } from '../tasks/task.interface';
import type { SyncDecisionInput } from './sync-decision.interface';
import isChanged from '../utils/is-changed';
import isMergeablePath from '../utils/is-mergeable-path';

export default function twoWayDecider(input: SyncDecisionInput): Array<BaseTask> {
	const {
		currentLocalStats: localStats,
		currentRemoteStats: remoteStats,
		records,
		taskFactory,
		settings,
	} = input;

	logger.debug('local state', [...localStats.keys()]);
	logger.debug('remote state', [...remoteStats.keys()]);
	logger.debug('records', [...records.keys()]);

	const tasks: Array<BaseTask> = [];
	const files: Array<{
		key: string;
		local?: FileStat;
		remote?: FileStat;
	}> = [];
	const folders: Array<{
		key: string;
		local?: FolderStat;
		remote?: FolderStat;
	}> = [];
	const fileFolders: Array<{
		key: string;
		local: Stat;
		remote: Stat;
	}> = [];
	const removeRecords: Array<string> = [];

	new Set([...localStats.keys(), ...remoteStats.keys(), ...records.keys()]).forEach((key) => {
		const remote = remoteStats.get(key);
		const local = localStats.get(key);
		if (!(local?.isDir || remote?.isDir)) files.push({ key, local, remote });
		else if (!(remote?.isDir === false || local?.isDir === false))
			folders.push({ key, local, remote });
		else if (remote && local) fileFolders.push({ key, local, remote });
		else removeRecords.push(key);
	});

	const routeConflict = (params: {
		local: FileStat;
		remote: FileStat;
		key: string;
		strategy: ConflictStrategy;
		unmergeableStrategy: UnmergeableStrategy;
	}) => {
		function commonRoutes(strategy: UnmergeableStrategy | ConflictStrategy) {
			if (strategy === UnmergeableStrategy.Skip) return;
			if (strategy === UnmergeableStrategy.KeepLocal) {
				tasks.push(taskFactory.createPushTask({ key, local }));
				return true;
			}
			if (strategy === UnmergeableStrategy.KeepRemote) {
				tasks.push(taskFactory.createPullTask({ key, remote }));
				return true;
			}
			if (strategy === UnmergeableStrategy.LatestTimeStamp) {
				if (local.mtime >= remote.mtime) {
					tasks.push(taskFactory.createPushTask({ key, local }));
					return true;
				}
				tasks.push(taskFactory.createPullTask({ key, remote }));
				return true;
			}
			return false;
		}
		const { local, remote, key, strategy, unmergeableStrategy } = params;
		if (strategy === ConflictStrategy.DiffMatchPatch && !isMergeablePath(local.key))
			commonRoutes(unmergeableStrategy);
		else if (!commonRoutes(strategy))
			tasks.push(taskFactory.createMergeTask({ key, local, remote }));
	};

	// * Sync files
	for (const { local, remote, key } of files) {
		const record = records.get(key);
		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged: boolean;
		let localChanged: boolean;

		if (record) {
			if (remote) {
				remoteChanged = isChanged({
					currentStats: remoteStats,
					key,
					records,
					source: 'remote',
				});
				if (local) {
					localChanged = isChanged({
						currentStats: localStats,
						key,
						records,
						source: 'local',
					});
					if (remoteChanged && localChanged) caseName = 'RECORD_REMOTE_LOCAL_CONFLICT';
					else if (remoteChanged) caseName = 'RECORD_REMOTE_LOCAL_PULL';
					else if (localChanged) caseName = 'RECORD_REMOTE_LOCAL_PUSH';
				} else if (remoteChanged) caseName = 'RECORD_REMOTE_NOLOCAL_PULL';
				else caseName = 'RECORD_REMOTE_NOLOCAL_REMOVE';
			} else if (local) {
				localChanged = isChanged({
					currentStats: localStats,
					key,
					records,
					source: 'local',
				});
				caseName = localChanged
					? 'RECORD_NOREMOTE_LOCAL_PUSH'
					: 'RECORD_NOREMOTE_LOCAL_REMOVE';
			}
		} else if (remote)
			if (local) {
				localChanged = isChanged({
					currentStats: localStats,
					key,
					records,
					source: 'local',
				});
				caseName = localChanged
					? 'NORECORD_REMOTE_LOCAL_RECORD'
					: 'NORECORD_REMOTE_LOCAL_CONFLICT';
			} else caseName = 'NORECORD_REMOTE_NOLOCAL_PULL';
		else if (local) caseName = 'NORECORD_NOREMOTE_LOCAL_PUSH';

		const operations = {
			NONE: () => {},
			NORECORD_NOREMOTE_LOCAL_PUSH: () => {
				if (!local) return;
				logger.debug(`Push local file \`${key}\` to remote`, {
					reason: 'local file exists without a remote file',
				});
				tasks.push(taskFactory.createPushTask({ key, local }));
			},
			NORECORD_REMOTE_LOCAL_CONFLICT: () => {
				if (!remote || !local) return;
				logger.debug(`Detected conflict in file \`${key}\``, {
					reason: 'both local and remote files exist without a record',
				});
				routeConflict({
					key,
					local,
					remote,
					strategy: settings.conflictStrategy,
					unmergeableStrategy: settings.unmergeableStrategy,
				});
			},
			NORECORD_REMOTE_LOCAL_RECORD: () => {
				if (!local || !remote) return;
				logger.debug(`creating new record`, {
					reason: 'both local and remote exist but no record',
				});
				tasks.push(taskFactory.createAddRecordTask({ key, local, remote }));
			},
			NORECORD_REMOTE_NOLOCAL_PULL: () => {
				if (!remote) return;
				logger.debug(`Pull remote file \`${key}\` to local`, {
					reason: 'remote file exists without a local file',
				});
				tasks.push(taskFactory.createPullTask({ key, remote }));
			},
			RECORD_NOREMOTE_LOCAL_PUSH: () => {
				if (!local) return;
				logger.debug(`Push local file \`${key}\` to remote`, {
					reason: 'local file changed and remote file does not exist',
				});
				tasks.push(taskFactory.createPushTask({ key, local }));
			},
			RECORD_NOREMOTE_LOCAL_REMOVE: () => {
				if (!local) return;
				logger.debug(`Remove local file \`${key}\``, {
					reason: 'local file is removable',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ key, local }));
				return;
			},
			RECORD_REMOTE_LOCAL_CONFLICT: () => {
				if (!remote || !local) return;
				logger.debug(`Detected conflict in \`${key}\``, {
					reason: 'both local and remote files changed',
				});
				routeConflict({
					key,
					local,
					remote,
					strategy: settings.conflictStrategy,
					unmergeableStrategy: settings.unmergeableStrategy,
				});
			},
			RECORD_REMOTE_LOCAL_PULL: () => {
				if (!remote || !local) return;
				logger.debug(`Pull remote file \`${key}\` changes to local`, {
					reason: 'remote file changed',
				});
				tasks.push(taskFactory.createPullTask({ key, remote }));
			},
			RECORD_REMOTE_LOCAL_PUSH: () => {
				if (!remote || !local) return;
				logger.debug(`Push local file \`${key}\` changes to remote`, {
					reason: 'local file changed',
				});
				tasks.push(taskFactory.createPushTask({ key, local }));
			},
			RECORD_REMOTE_NOLOCAL_PULL: () => {
				if (!remote) return;
				logger.debug(`Pull remote file \`${key}\` to local`, {
					reason: 'remote file changed and local file does not exist',
				});
				tasks.push(taskFactory.createPullTask({ key, remote }));
			},
			RECORD_REMOTE_NOLOCAL_REMOVE: () => {
				if (!remote) return;
				logger.debug(`Remove remote file \`${key}\``, {
					reason: 'remote file is removable',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ key, remote }));
			},
		};

		operations[caseName]();
	}

	// * Sync folders
	for (const { key, remote, local } of folders) {
		const record = records.get(key);

		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged: boolean;
		let localChanged: boolean;

		if (record) {
			if (local) {
				if (!remote) {
					localChanged = isChanged({
						currentStats: localStats,
						key,
						records,
						source: 'local',
						tasks,
					});
					caseName = localChanged
						? 'LOCAL_NOREMOTE_RECORD_PUSH'
						: 'LOCAL_NOREMOTE_RECORD_REMOVE';
				}
			} else if (remote) {
				remoteChanged = isChanged({
					currentStats: remoteStats,
					key,
					records,
					source: 'remote',
					tasks,
				});
				caseName = remoteChanged
					? 'REMOTE_NOLOCAL_RECORD_PULL'
					: 'REMOTE_NOLOCAL_RECORD_REMOVE';
			}
		} else if (local && remote) caseName = 'LOCAL_REMOTE_NORECORD_RECORD';
		else if (local) caseName = 'LOCAL_NOREMOTE_NORECORD_PUSH';
		else if (remote) caseName = 'REMOTE_NOLOCAL_NORECORD_PULL';

		const operations = {
			LOCAL_NOREMOTE_NORECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${key}\``, {
					reason: 'local folder does not exist remotely',
				});
				tasks.push(taskFactory.createMkdirRemoteTask({ key, local }));
			},
			LOCAL_NOREMOTE_RECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${key}\``, {
					reason: 'local folder content changed',
				});
				tasks.push(taskFactory.createMkdirRemoteTask({ key, local }));
			},
			LOCAL_NOREMOTE_RECORD_REMOVE: () => {
				if (!local) return;
				logger.debug(`Remove local folder \`${key}\``, {
					reason: 'local folder is removable (no content changes)',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ key, local }));
			},
			LOCAL_REMOTE_NORECORD_RECORD: () => {
				if (!local || !remote) return;
				logger.debug(`creating new record for folder \`${key}\``, {
					reason: 'both local and remote exist but no record',
				});
				tasks.push(taskFactory.createAddRecordTask({ key, local, remote }));
			},
			NONE: () => {},
			REMOTE_NOLOCAL_NORECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create local folder according to remote \`${key}\``, {
					reason: 'remote folder does not exist locally',
				});
				tasks.push(taskFactory.createMkdirLocalTask({ key, remote }));
			},
			REMOTE_NOLOCAL_RECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create local folder according to remote \`${key}\``, {
					reason: 'remote folder content changed',
				});
				tasks.push(taskFactory.createMkdirLocalTask({ key, remote }));
			},
			REMOTE_NOLOCAL_RECORD_REMOVE: () => {
				if (!remote) return;
				logger.debug(`Remove remote folder \`${key}\``, {
					reason: 'remote folder is removable (no content changes)',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ key, remote }));
			},
		};

		operations[caseName]();
	}

	for (const { key, remote, local } of fileFolders) {
		const record = records.get(key);
		let caseName: keyof typeof operations;
		const localChanged = isChanged({
			currentStats: localStats,
			key,
			records,
			source: 'local',
		});
		const remoteChanged = isChanged({
			currentStats: remoteStats,
			key,
			records,
			source: 'remote',
		});

		if (record)
			if (localChanged && remoteChanged) caseName = 'CONFLICT';
			else if (localChanged) caseName = local.isDir ? 'LOCAL_DIR_PUSH' : 'LOCAL_FILE_PUSH';
			else if (remote.isDir) caseName = 'REMOTE_DIR_PULL';
			else caseName = 'REMOTE_FILE_PULL';
		else caseName = 'CONFLICT';

		const operations = {
			CONFLICT: () => {
				const remoteFormat = remote.isDir ? 'folder' : 'file';
				const localFormat = local.isDir ? 'folder' : 'file';
				const remoteForm = t(`sync.fileFolderConflict.${remoteFormat}`);
				const localForm = t(`sync.fileFolderConflict.${localFormat}`);
				const message = t(`sync.fileFolderConflict.message`, {
					key,
					localForm,
					remoteForm,
				});
				throw new Error(message);
			},
			LOCAL_DIR_PUSH: () => {
				if (!local.isDir) return;
				logger.debug(`Replace remote file \`${key}\` with local directory`, {
					reason: 'local directory changed but not remote',
				});
				tasks.push(
					taskFactory.createRemoveRemoteTask({ key, remote }),
					taskFactory.createMkdirRemoteTask({ key, local }),
				);
			},
			LOCAL_FILE_PUSH: () => {
				if (local.isDir) return;
				logger.debug(`Replace remote directory \`${key}\` with local file`, {
					reason: 'local file changed but not remote',
				});
				tasks.push(
					taskFactory.createRemoveRemoteTask({ key, remote }),
					taskFactory.createPushTask({ key, local }),
				);
			},
			REMOTE_DIR_PULL: () => {
				if (!remote.isDir) return;
				logger.debug(`Replace local file \`${key}\` with local directory`, {
					reason: 'local directory changed but not remote',
				});
				tasks.push(
					taskFactory.createRemoveLocalTask({ key, local }),
					taskFactory.createMkdirLocalTask({ key, remote }),
				);
			},
			REMOTE_FILE_PULL: () => {
				if (!remote.isDir) return;
				logger.debug(`Replace local directory \`${key}\` with remote file`, {
					reason: 'remote file changed but not local',
				});
				tasks.push(
					taskFactory.createRemoveLocalTask({ key, local }),
					taskFactory.createMkdirLocalTask({ key, remote }),
				);
			},
		};

		operations[caseName]();
	}

	for (const key of removeRecords) {
		logger.debug(`cleaning orphaned sync record ${key}`, {
			reason: 'both local and remote deleted',
		});
		tasks.push(taskFactory.createCleanRecordTask({ key }));
	}

	return tasks;
}
