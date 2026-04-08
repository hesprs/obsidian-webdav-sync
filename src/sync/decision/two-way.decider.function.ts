import type { FileStatModel, FolderStatModel, RecordStatModel, StatModel } from '~/types';
import { SyncPlanningSubStage } from '~/events';
import i18n from '~/i18n';
import { normalizeRemotePathToAbsolute } from '~/platform/path';
import { SyncMode } from '~/settings';
import { hasInvalidChar } from '~/utils/has-invalid-char';
import logger from '~/utils/logger';
import type {
	PlannedLocalSnapshot,
	PlannedRemoteSnapshot,
	SyncDecisionInput,
} from './sync-decision.interface';
import { ConflictStrategy } from '../tasks/merge.task';
import { BaseTask } from '../tasks/task.interface';
import isChanged from '../utils/is-changed';

export async function twoWayDecider(input: SyncDecisionInput): Promise<BaseTask[]> {
	const {
		settings,
		currentLocalStats: localStats,
		currentRemoteStats: remoteStats,
		records,
		onProgress,
		taskFactory,
		remoteBaseDir,
		createPlannedLocalFileSnapshot,
		createPlannedRemoteFileSnapshot,
		createPlannedLocalFolderSnapshot,
		createPlannedRemoteFolderSnapshot,
	} = input;
	const mixedPath = Array.from(new Set([...localStats.keys(), ...remoteStats.keys()]));

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
		if (hasInvalidChar(path))
			throw new Error(`${i18n.t('sync.fileOp.filenameError')}: ${path}`);
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
	let completedUnits = 0;
	const updateProgress = async () => {
		await onProgress?.({
			subStage: SyncPlanningSubStage.deciding,
			totalWorkUnits: files.length + fileFolders.length,
			completedWorkUnits: completedUnits,
		});
		completedUnits++;
	};
	void updateProgress();

	const createPushTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			local?: PlannedLocalSnapshot;
			remote?: PlannedRemoteSnapshot;
		},
		localStat: StatModel,
	) => {
		const plannedLocal =
			(await createPlannedLocalFileSnapshot(options.localPath, localStat)) ?? options.local;
		tasks.push(
			taskFactory.createPushTask({
				...options,
				local: plannedLocal,
			}),
		);
	};

	const createPullTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			local?: PlannedLocalSnapshot;
			remote?: PlannedRemoteSnapshot;
		},
		remoteStat: StatModel,
	) => {
		const plannedRemote =
			(await createPlannedRemoteFileSnapshot(options.remotePath, remoteStat)) ??
			options.remote;
		tasks.push(
			taskFactory.createPullTask({
				...options,
				remote: plannedRemote,
			}),
		);
	};

	const createMergeTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			record?: RecordStatModel;
			strategy: ConflictStrategy;
			useGitStyle: boolean;
		},
		localStat: StatModel,
		remoteStat: StatModel,
	) => {
		const [plannedLocal, plannedRemote] = await Promise.all([
			createPlannedLocalFileSnapshot(options.localPath, localStat),
			createPlannedRemoteFileSnapshot(options.remotePath, remoteStat),
		]);
		if (!plannedLocal)
			throw new Error(`Cannot plan local conflict snapshot: ${options.localPath}`);
		if (!plannedRemote)
			throw new Error(`Cannot plan remote conflict snapshot: ${options.remotePath}`);
		tasks.push(
			taskFactory.createMergeTask({
				...options,
				record: options.record,
				local: plannedLocal,
				remote: plannedRemote,
			}),
		);
	};

	const routeConflict = async (params: {
		local: StatModel;
		remote: StatModel;
		record?: RecordStatModel;
		options: { localPath: string; remotePath: string };
		strategy: ConflictStrategy;
		useGitStyle: boolean;
	}) => {
		const { local, remote, record, options, strategy, useGitStyle } = params;
		if (strategy === ConflictStrategy.Skip || local.isDir || remote.isDir) return;
		if (strategy === ConflictStrategy.KeepLocal) {
			await createPushTaskWithSnapshot(options, local);
			return;
		}
		if (strategy === ConflictStrategy.KeepRemote) {
			await createPullTaskWithSnapshot(options, remote);
			return;
		}
		if (strategy === ConflictStrategy.LatestTimeStamp) {
			if (local.mtime >= remote.mtime) {
				await createPushTaskWithSnapshot(options, local);
				return;
			}
			await createPullTaskWithSnapshot(options, remote);
			return;
		}

		await createMergeTaskWithSnapshot(
			{
				...options,
				record,
				strategy,
				useGitStyle,
			},
			local,
			remote,
		);
	};

	const createMkdirLocalTaskWithSnapshot = (
		options: { localPath: string; remotePath: string },
		remoteStat: PlannedRemoteSnapshot['stat'],
	) => {
		const plannedRemote = createPlannedRemoteFolderSnapshot(options.remotePath, remoteStat);
		tasks.push(
			taskFactory.createMkdirLocalTask({
				...options,
				remote: plannedRemote,
			}),
		);
	};

	const createMkdirRemoteTaskWithSnapshot = (
		options: { localPath: string; remotePath: string },
		localStat: StatModel,
	) => {
		const plannedLocal = createPlannedLocalFolderSnapshot(options.localPath, localStat);
		tasks.push(
			taskFactory.createMkdirRemoteTask({
				...options,
				local: plannedLocal,
			}),
		);
	};

	const createAddFileRecordTaskWithSnapshot = async (
		options: { localPath: string; remotePath: string },
		localStat: StatModel,
		remoteStat: StatModel,
	) => {
		const plannedLocal = await createPlannedLocalFileSnapshot(options.localPath, localStat);
		tasks.push(
			taskFactory.createAddRecordTask({
				...options,
				local: plannedLocal,
				remote: remoteStat,
			}),
		);
	};

	const createAddFolderRecordTaskWithSnapshot = (
		options: { localPath: string; remotePath: string },
		localStat: StatModel,
		remoteStat: StatModel,
	) => {
		const plannedLocal = createPlannedLocalFolderSnapshot(options.localPath, localStat);
		tasks.push(
			taskFactory.createAddRecordTask({
				...options,
				local: plannedLocal,
				remote: remoteStat,
			}),
		);
	};

	// * sync files
	await Promise.all(
		files.map(async ({ local, remote, path }) => {
			const record = records.get(path);
			const localPath = local?.path ?? path;
			const remotePath =
				remote?.path ??
				(local
					? normalizeRemotePathToAbsolute(remoteBaseDir, path, local.isDir)
					: remoteBaseDir);

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
						if (remoteChanged && localChanged)
							caseName = 'RECORD_REMOTE_LOCAL_CONFLICT';
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
						if (settings.syncMode === SyncMode.LOOSE && remote.size === local.size)
							caseName = 'NORECORD_REMOTE_LOCAL_RECORD';
						else caseName = 'NORECORD_REMOTE_LOCAL_CONFLICT';
					} else caseName = 'NORECORD_REMOTE_NOLOCAL_PULL';
				} else if (local) caseName = 'NORECORD_NOREMOTE_LOCAL_PUSH';
			}

			const operations = {
				NONE: () => {},
				NORECORD_REMOTE_LOCAL_RECORD: async () => {
					if (!local || !remote) return;
					logger.debug(`creating new record`, {
						reason: 'both local and remote exist but no record',
					});

					await createAddFileRecordTaskWithSnapshot(
						{ localPath, remotePath },
						local,
						remote,
					);
				},
				RECORD_REMOTE_LOCAL_CONFLICT: async () => {
					if (!remote || !local) return;
					logger.debug(
						`Detected conflict between \`${localPath}\` and \`${remotePath}\``,
						{ reason: 'both local and remote files changed' },
					);
					await routeConflict({
						local,
						remote,
						record,
						options,
						strategy: settings.conflictStrategy,
						useGitStyle: settings.useGitStyle,
					});
				},
				RECORD_REMOTE_LOCAL_PULL: async () => {
					if (!remote || !local) return;
					logger.debug(`Pull remote file \`${remotePath}\` changes to local`, {
						reason: 'remote file changed',
					});
					await createPullTaskWithSnapshot(options, remote);
				},
				RECORD_REMOTE_LOCAL_PUSH: async () => {
					if (!remote || !local) return;
					logger.debug(`Push local file \`${localPath}\` changes to remote`, {
						reason: 'local file changed',
					});
					await createPushTaskWithSnapshot(options, local);
				},
				RECORD_REMOTE_NOLOCAL_PULL: async () => {
					if (!remote) return;
					logger.debug(`Pull remote file \`${remotePath}\` to local`, {
						reason: 'remote file changed and local file does not exist',
					});
					await createPullTaskWithSnapshot(options, remote);
				},
				RECORD_REMOTE_NOLOCAL_REMOVE: () => {
					if (!remote) return;
					logger.debug(`Remove remote file \`${remote.path}\``, {
						reason: 'remote file is removable',
					});
					tasks.push(taskFactory.createRemoveRemoteTask(options));
				},
				RECORD_NOREMOTE_LOCAL_PUSH: async () => {
					if (!local) return;
					logger.debug(`Push local file \`${localPath}\` to remote`, {
						reason: 'local file changed and remote file does not exist',
					});
					await createPushTaskWithSnapshot(options, local);
				},
				RECORD_NOREMOTE_LOCAL_REMOVE: () => {
					if (!local) return;
					logger.debug(`Remove local file \`${localPath}\``, {
						reason: 'local file is removable',
					});
					tasks.push(taskFactory.createRemoveLocalTask(options));
					return;
				},
				NORECORD_REMOTE_LOCAL_CONFLICT: async () => {
					if (!remote || !local) return;
					logger.debug(
						`Detected conflict between local file \`${localPath}\` and remote file ${remotePath}`,
						{ reason: 'both local and remote files exist without a record' },
					);
					await routeConflict({
						local,
						remote,
						record: undefined,
						options,
						strategy: settings.conflictStrategy,
						useGitStyle: settings.useGitStyle,
					});
				},
				NORECORD_REMOTE_NOLOCAL_PULL: async () => {
					if (!remote) return;
					logger.debug(`Pull remote file \`${remotePath}\` to local`, {
						reason: 'remote file exists without a local file',
					});
					await createPullTaskWithSnapshot(options, remote);
				},
				NORECORD_NOREMOTE_LOCAL_PUSH: async () => {
					if (!local) return;
					logger.debug(`Push local file \`${localPath}\` to remote`, {
						reason: 'local file exists without a remote file',
					});
					await createPushTaskWithSnapshot(options, local);
				},
			};

			await operations[caseName]();
			void updateProgress();
		}),
	);

	// * sync folders
	for (const { path, remote, local } of folders) {
		const record = records.get(path);
		const localPath = local?.path ?? path;
		const remotePath =
			remote?.path ??
			(local
				? normalizeRemotePathToAbsolute(remoteBaseDir, path, local.isDir)
				: remoteBaseDir);

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
				createAddFolderRecordTaskWithSnapshot({ localPath, remotePath }, local, remote);
			},
			REMOTE_NOLOCAL_RECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create local folder according to remote \`${remotePath}\``, {
					reason: 'remote folder content changed',
				});
				createMkdirLocalTaskWithSnapshot({ localPath, remotePath }, remote);
			},
			REMOTE_NOLOCAL_RECORD_REMOVE: () => {
				logger.debug(`Remove remote folder \`${remotePath}\``, {
					reason: 'remote folder is removable (no content changes)',
				});
				tasks.push(taskFactory.createRemoveRemoteTask({ localPath, remotePath }));
			},
			REMOTE_NOLOCAL_NORECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create  local folder according to remote \`${remotePath}\``, {
					reason: 'remote folder does not exist locally',
				});
				createMkdirLocalTaskWithSnapshot({ localPath, remotePath }, remote);
			},
			LOCAL_NOREMOTE_RECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${localPath}\``, {
					reason: 'local folder content changed',
				});
				createMkdirRemoteTaskWithSnapshot({ localPath, remotePath }, local);
			},
			LOCAL_NOREMOTE_RECORD_REMOVE: () => {
				logger.debug(`Remove local folder \`${localPath}\``, {
					reason: 'local folder is removable (no content changes)',
				});
				tasks.push(taskFactory.createRemoveLocalTask({ localPath, remotePath }));
			},
			LOCAL_NOREMOTE_NORECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${localPath}\``, {
					reason: 'local folder does not exist remotely',
				});
				createMkdirRemoteTaskWithSnapshot({ localPath, remotePath }, local);
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
				const remoteForm = i18n.t(`sync.fileFolderConflict.${_remoteForm}`);
				const localForm = i18n.t(`sync.fileFolderConflict.${_localForm}`);
				const message = i18n.t(`sync.fileFolderConflict.message`, {
					remoteForm,
					localForm,
					path,
				});
				throw new Error(message);
			},
			LOCAL_DIR_PUSH: () => {
				logger.debug(`Replace remote file \`${remotePath}\` with local directory`, {
					reason: 'local directory changed but not remote',
				});
				tasks.push(taskFactory.createRemoveRemoteTask(options));
				tasks.push(taskFactory.createMkdirRemoteTask(options));
			},
			REMOTE_FILE_PULL: () => {
				logger.debug(`Replace local directory \`${localPath}\` with remote file`, {
					reason: 'remote file changed but not local',
				});
				tasks.push(taskFactory.createRemoveLocalTask(options));
				tasks.push(taskFactory.createMkdirLocalTask(options));
			},
			LOCAL_FILE_PUSH: async () => {
				logger.debug(`Replace remote directory \`${remotePath}\` with local file`, {
					reason: 'local file changed but not remote',
				});
				tasks.push(taskFactory.createRemoveRemoteTask(options));
				await createPushTaskWithSnapshot(options, local);
			},
			REMOTE_DIR_PULL: () => {
				logger.debug(`Replace local file \`${localPath}\` with local directory`, {
					reason: 'local directory changed but not remote',
				});
				tasks.push(taskFactory.createRemoveLocalTask(options));
				tasks.push(taskFactory.createMkdirLocalTask(options));
			},
		};

		await operations[caseName]();
		void updateProgress();
	}

	for (const path of removeRecords) {
		logger.debug(`cleaning orphaned sync record ${path}`, {
			reason: 'both local and remote deleted',
		});
		tasks.push(
			taskFactory.createCleanRecordTask({
				remotePath: path,
				localPath: path,
			}),
		);
	}
	return tasks;
}
