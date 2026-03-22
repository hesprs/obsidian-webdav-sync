import { parse as bytesParse } from 'bytes-iec';
import { remotePathToAbsolute } from '~/platform/path/remote-path';
import { remotePathToLocalRelative } from '~/platform/path/remote-path';
import { SyncMode } from '~/settings';
import { hasInvalidChar } from '~/utils/has-invalid-char';
import logger from '~/utils/logger';
import type {
	PlannedLocalSnapshot,
	PlannedRemoteSnapshot,
	SyncDecisionInput,
} from './sync-decision.interface';
import { ConflictStrategy } from '../tasks/conflict-resolve.task';
import { SkipReason } from '../tasks/skipped.task';
import { BaseTask } from '../tasks/task.interface';
import { getIgnoredPathsInFolder, hasIgnoredInFolder } from '../utils/has-ignored-in-folder';
import { isSameTime } from '../utils/is-same-time';
import { hasFolderContentChanged } from './has-folder-content-changed';

export async function twoWayDecider(input: SyncDecisionInput): Promise<BaseTask[]> {
	const {
		settings,
		currentLocalStats: localStats,
		currentRemoteStats: remoteStats,
		previousRemoteRecords,
		previousLocalRecords,
		remoteBaseDir,
		compareFileContent,
		onProgress,
		taskFactory,
		createPlannedLocalFileSnapshot,
		createPlannedRemoteFileSnapshot,
		createPlannedLocalFolderSnapshot,
		createPlannedRemoteFolderSnapshot,
	} = input;

	let maxFileSize = Infinity;
	const maxFileSizeStr = settings.skipLargeFiles.maxSize.trim();
	if (maxFileSizeStr !== '') {
		maxFileSize = bytesParse(maxFileSizeStr, { mode: 'jedec' }) ?? Infinity;
	}

	// Filter out ignored files and extract StatModel from FsWalkResult
	const localStatsFiltered = localStats.filter((item) => !item.ignored).map((item) => item.stat);
	const remoteStatsFiltered = remoteStats
		.filter((item) => !item.ignored)
		.map((item) => item.stat);

	const localStatsMap = new Map(localStatsFiltered.map((item) => [item.path, item]));
	const remoteStatsMap = new Map(remoteStatsFiltered.map((item) => [item.path, item]));
	const previousRemoteStatsMap = new Map(previousRemoteRecords.map((item) => [item.path, item]));
	const syncRecords = new Map(
		Array.from(previousLocalRecords.entries()).flatMap(([path, record]) => {
			const remote = previousRemoteStatsMap.get(path);
			if (!remote) return [];
			return [
				[
					path,
					{
						local: record.local,
						remote,
						baseText: record.baseText,
					},
				],
			] as const;
		}),
	);
	const cleanupCandidatePaths = new Set([
		...previousLocalRecords.keys(),
		...previousRemoteStatsMap.keys(),
	]);
	const mixedPath = new Set([...localStatsMap.keys(), ...remoteStatsMap.keys()]);

	logger.debug(
		'local state',
		localStatsFiltered.map((d) => ({
			path: d.path,
			size: d.isDir ? undefined : d.size,
			isDir: d.isDir,
		})),
	);
	logger.debug(
		'remote state',
		remoteStatsFiltered.map((d) => ({
			path: d.path,
			size: d.isDir ? undefined : d.size,
			isDir: d.isDir,
		})),
	);

	const tasks: BaseTask[] = [];
	const removeRemoteFolderTasks: BaseTask[] = [];
	const removeLocalFolderTasks: BaseTask[] = [];
	const mkdirLocalTasks: BaseTask[] = [];
	const mkdirRemoteTasks: BaseTask[] = [];
	const noopFolderTasks: BaseTask[] = [];
	const totalDecisionWorkUnits =
		mixedPath.size +
		cleanupCandidatePaths.size +
		remoteStatsFiltered.length +
		localStatsFiltered.length;

	let completedUnits = -1;
	const updateProgress = async () => {
		completedUnits++;
		await onProgress?.({
			subStage: 'deciding',
			totalWorkUnits: totalDecisionWorkUnits,
			completedWorkUnits: completedUnits,
		});
	};

	const createPushTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			remoteBaseDir: string;
			local?: PlannedLocalSnapshot;
			remote?: PlannedRemoteSnapshot;
		},
		localStat: PlannedLocalSnapshot['stat'],
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
			remoteBaseDir: string;
			local?: PlannedLocalSnapshot;
			remote?: PlannedRemoteSnapshot;
		},
		remoteStat: PlannedRemoteSnapshot['stat'],
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

	const createMkdirRemoteTaskWithSnapshot = async (
		options: { localPath: string; remotePath: string; remoteBaseDir: string },
		localStat: PlannedLocalSnapshot['stat'],
	) => {
		const plannedLocal = await createPlannedLocalFolderSnapshot(options.localPath, localStat);
		mkdirRemoteTasks.push(
			taskFactory.createMkdirRemoteTask({
				...options,
				local: plannedLocal,
			}),
		);
	};

	const createRemoveLocalTaskWithSnapshot = async (
		options: {
			localPath: string;
			remotePath: string;
			remoteBaseDir: string;
			recursive?: boolean;
		},
		localStat: PlannedLocalSnapshot['stat'],
		targetTasks: BaseTask[] = tasks,
	) => {
		const plannedLocal = localStat.isDir
			? await createPlannedLocalFolderSnapshot(options.localPath, localStat)
			: await createPlannedLocalFileSnapshot(options.localPath, localStat);
		targetTasks.push(
			taskFactory.createRemoveLocalTask({
				...options,
				local: plannedLocal,
			}),
		);
	};

	const createConflictResolveTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			remoteBaseDir: string;
			record?: typeof syncRecords extends Map<string, infer T> ? T : never;
			strategy: ConflictStrategy;
			useGitStyle: boolean;
		},
		localStat: PlannedLocalSnapshot['stat'],
		remoteStat: PlannedRemoteSnapshot['stat'],
	) => {
		const [plannedLocal, plannedRemote] = await Promise.all([
			createPlannedLocalFileSnapshot(options.localPath, localStat),
			createPlannedRemoteFileSnapshot(options.remotePath, remoteStat),
		]);
		if (!plannedLocal) {
			throw new Error(`Cannot plan local conflict snapshot: ${options.localPath}`);
		}
		if (!plannedRemote) {
			throw new Error(`Cannot plan remote conflict snapshot: ${options.remotePath}`);
		}
		tasks.push(
			taskFactory.createConflictResolveTask({
				...options,
				record: options.record,
				local: plannedLocal,
				remote: plannedRemote,
			}),
		);
	};

	const createMkdirLocalTaskWithSnapshot = async (
		options: { localPath: string; remotePath: string; remoteBaseDir: string },
		remoteStat: PlannedRemoteSnapshot['stat'],
	) => {
		const plannedRemote = await createPlannedRemoteFolderSnapshot(
			options.remotePath,
			remoteStat,
		);
		mkdirLocalTasks.push(
			taskFactory.createMkdirLocalTask({
				...options,
				remote: plannedRemote,
			}),
		);
	};

	// * sync files
	for (const p of mixedPath) {
		await updateProgress();
		const remote = remoteStatsMap.get(p);
		const local = localStatsMap.get(p);
		const record = syncRecords.get(p);
		const options = {
			remotePath: p,
			localPath: p,
			remoteBaseDir,
			local: local ? { stat: local } : undefined,
			remote: remote ? { stat: remote } : undefined,
		};
		const localName = local?.path ?? 'none';
		const remoteName = remote?.path ?? 'none';
		if (local?.isDir || remote?.isDir) continue;

		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged = false;
		let localChanged = false;

		if (record) {
			if (remote) {
				remoteChanged = !isSameTime(remote.mtime, record.remote.mtime);
				if (local) {
					localChanged = !isSameTime(local.mtime, record.local.mtime);
					if (localChanged && record.baseText)
						localChanged = !(await compareFileContent(local.path, record.baseText));
					if (remoteChanged && localChanged) caseName = 'RECORD_REMOTE_LOCAL_CONFLICT';
					else if (remoteChanged) caseName = 'RECORD_REMOTE_LOCAL_PULL';
					else if (localChanged) caseName = 'RECORD_REMOTE_LOCAL_PUSH';
				} else {
					if (remoteChanged) caseName = 'RECORD_REMOTE_NOLOCAL_PULL';
					else caseName = 'RECORD_REMOTE_NOLOCAL_REMOVE';
				}
			} else if (local) {
				localChanged = !isSameTime(local.mtime, record.local.mtime);
				if (localChanged) caseName = 'RECORD_NOREMOTE_LOCAL_PUSH';
				else caseName = 'RECORD_NOREMOTE_LOCAL_REMOVE';
			}
		} else {
			if (remote) {
				if (local) {
					if (
						settings.syncMode === SyncMode.LOOSE &&
						!remote.isDeleted &&
						!remote.isDir &&
						remote.size === local.size
					)
						caseName = 'NORECORD_REMOTE_LOCAL_NOOP';
					else caseName = 'NORECORD_REMOTE_LOCAL_CONFLICT';
				} else caseName = 'NORECORD_REMOTE_NOLOCAL_PULL';
			} else if (local) caseName = 'NORECORD_NOREMOTE_LOCAL_PUSH';
		}

		const operations = {
			NONE: async () => false,
			RECORD_REMOTE_LOCAL_CONFLICT: async () => {
				if (!remote || !local) return false;
				logger.debug(`Detected conflict between \`${localName}\` and \`${remoteName}\``, {
					reason: 'both local and remote files changed',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						remoteChanged,
						localChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (remote.size > maxFileSize || local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
							localSize: local.size,
						}),
					);
					return true;
				}

				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else {
					await createConflictResolveTaskWithSnapshot(
						{
							...options,
							record,
							strategy:
								settings.conflictStrategy === 'latest-timestamp'
									? ConflictStrategy.LatestTimeStamp
									: ConflictStrategy.DiffMatchPatch,
							useGitStyle: settings.useGitStyle,
						},
						local,
						remote,
					);
				}

				return true;
			},
			RECORD_REMOTE_LOCAL_PULL: async () => {
				if (!remote || !local) return false;
				logger.debug(`Pull remote file \`${remoteName}\` changes to local`, {
					reason: 'remote file changed',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						remoteChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (remote.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
							localSize: local.size,
						}),
					);
					return true;
				}
				await createPullTaskWithSnapshot(options, remote);
				return true;
			},
			RECORD_REMOTE_LOCAL_PUSH: async () => {
				if (!remote || !local) return false;
				logger.debug(`Push local file \`${localName}\` changes to remote`, {
					reason: 'local file changed',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						localChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
							localSize: local.size,
						}),
					);
					return true;
				}
				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else {
					await createPushTaskWithSnapshot(options, local);
				}
				return true;
			},
			RECORD_REMOTE_NOLOCAL_PULL: async () => {
				if (!remote) return false;
				logger.debug(`Pull remote file \`${remoteName}\` to local`, {
					reason: 'remote file changed and local file does not exist',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						remoteChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (remote.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
						}),
					);
					return true;
				}
				await createPullTaskWithSnapshot(options, remote);
				return true;
			},
			RECORD_REMOTE_NOLOCAL_REMOVE: async () => {
				if (!remote) return false;
				logger.debug(`Remove remote file \`${remote.path}\``, {
					reason: 'remote file is removable',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				tasks.push(taskFactory.createRemoveRemoteTask(options));
				return true;
			},
			RECORD_NOREMOTE_LOCAL_PUSH: async () => {
				if (!local) return false;
				logger.debug(`Push local file \`${localName}\` to remote`, {
					reason: 'local file changed and remote file does not exist',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						localChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							localSize: local.size,
							maxSize: maxFileSize,
						}),
					);
					return true;
				}
				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else {
					await createPushTaskWithSnapshot(options, local);
				}
				return true;
			},
			RECORD_NOREMOTE_LOCAL_REMOVE: async () => {
				if (!local) return false;
				logger.debug(`Remove local file \`${localName}\``, {
					reason: 'local file is removable',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				await createRemoveLocalTaskWithSnapshot(options, local);
				return true;
			},
			NORECORD_REMOTE_LOCAL_NOOP: async () => {
				tasks.push(
					taskFactory.createNoopTask({
						...options,
					}),
				);
				return true;
			},
			NORECORD_REMOTE_LOCAL_CONFLICT: async () => {
				if (!remote || !local) return false;
				logger.debug(
					`Detected conflict between local file \`${localName}\` and remote file ${remoteName}`,
					{
						reason: 'both local and remote files exist without a record',
						remotePath: remotePathToAbsolute(remoteBaseDir, p),
						localPath: p,
						conditions: {
							recordExists: !!record,
							remoteExists: !!remote,
							localExists: !!local,
						},
					},
				);

				if (remote.size > maxFileSize || local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							remoteSize: remote.size,
							localSize: local.size,
							maxSize: maxFileSize,
						}),
					);
					return true;
				}

				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else {
					await createConflictResolveTaskWithSnapshot(
						{
							...options,
							strategy: ConflictStrategy.DiffMatchPatch,
							useGitStyle: settings.useGitStyle,
						},
						local,
						remote,
					);
				}

				return true;
			},
			NORECORD_REMOTE_NOLOCAL_PULL: async () => {
				if (!remote) return false;
				logger.debug(`Pull remote file \`${remoteName}\` to local`, {
					reason: 'remote file exists without a local file',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});

				if (remote.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							remoteSize: remote.size,
							maxSize: maxFileSize,
						}),
					);
					return true;
				}
				await createPullTaskWithSnapshot(options, remote);
				return true;
			},
			NORECORD_NOREMOTE_LOCAL_PUSH: async () => {
				if (!local) return false;
				logger.debug(`Push local file \`${localName}\` to remote`, {
					reason: 'local file exists without a remote file',
					remotePath: remotePathToAbsolute(remoteBaseDir, p),
					localPath: p,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});

				if (local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							localSize: local.size,
							maxSize: maxFileSize,
						}),
					);
					return true;
				}
				if (hasInvalidChar(local.path))
					tasks.push(taskFactory.createFilenameErrorTask(options));
				else await createPushTaskWithSnapshot(options, local);
				return true;
			},
		};

		if (await operations[caseName]()) continue;
	}

	// * clean orphaned records (both local and remote deleted)
	for (const recordPath of cleanupCandidatePaths) {
		await updateProgress();
		const local = localStatsMap.get(recordPath);
		const remote = remoteStatsMap.get(recordPath);
		const hasPreviousLocal = previousLocalRecords.has(recordPath);
		const hasPreviousRemote = previousRemoteStatsMap.has(recordPath);

		// If both local and remote don't exist, but record exists, clean the record
		if (!local && !remote && (hasPreviousLocal || hasPreviousRemote)) {
			logger.debug(`cleaning orphaned sync record`, {
				reason: 'both local and remote deleted',
				remotePath: remotePathToAbsolute(remoteBaseDir, recordPath),
				localPath: recordPath,
				conditions: {
					localExists: !!local,
					remoteExists: !!remote,
					recordExists: hasPreviousLocal || hasPreviousRemote,
				},
			});

			tasks.push(
				taskFactory.createCleanRecordTask({
					remotePath: recordPath,
					localPath: recordPath,
					remoteBaseDir,
				}),
			);
		}
	}

	// * sync folder: remote -> local
	for (const remote of remoteStatsFiltered) {
		await updateProgress();
		if (!remote.isDir) continue;
		const localPath = remotePathToLocalRelative(remoteBaseDir, remote.path);
		const local = localStatsMap.get(localPath);
		const record = syncRecords.get(localPath);
		const remoteName = remote.path;
		if (local) {
			if (!local.isDir) {
				throw new Error(
					`Folder conflict: remote path ${remote.path} is a folder but local path ${localPath} is a file`,
				);
			}
			if (!record) {
				noopFolderTasks.push(
					taskFactory.createNoopTask({
						localPath: localPath,
						remotePath: remote.path,
						remoteBaseDir,
					}),
				);
				continue;
			}
		} else if (record) {
			// Use sub-items check instead of mtime check
			const remoteChanged = hasFolderContentChanged(
				remote.path,
				remoteStatsFiltered,
				syncRecords,
				'remote',
			);

			if (remoteChanged) {
				logger.debug(`Create local folder according to remote \`${remoteName}\``, {
					reason: 'remote folder content changed',
					remotePath: remotePathToAbsolute(remoteBaseDir, remote.path),
					localPath: localPath,
					conditions: {
						remoteChanged,
						localExists: !!local,
						recordExists: !!record,
					},
				});

				await createMkdirLocalTaskWithSnapshot(
					{
						localPath,
						remotePath: remote.path,
						remoteBaseDir,
					},
					remote,
				);
				continue;
			}

			if (hasIgnoredInFolder(remote.path, remoteStats)) {
				const ignoredPaths = getIgnoredPathsInFolder(remote.path, remoteStats);
				logger.debug(`Skip removing remote folder \`${remoteName}\``, {
					reason: 'remote folder contains ignored items',
					remotePath: remotePathToAbsolute(remoteBaseDir, remote.path),
					localPath: localPath,
					conditions: {
						hasIgnoredItems: true,
						localExists: !!local,
						recordExists: !!record,
					},
					ignoredPaths,
				});
				tasks.push(
					taskFactory.createSkippedTask({
						localPath,
						remotePath: remote.path,
						remoteBaseDir,
						reason: SkipReason.FolderContainsIgnoredItems,
						ignoredPaths,
					}),
				);
				continue;
			}

			logger.debug(`Remove remote folder \`${remoteName}\``, {
				reason: 'remote folder is removable (no content changes)',
				remotePath: remotePathToAbsolute(remoteBaseDir, remote.path),
				localPath: localPath,
				conditions: {
					removable: true,
					localExists: !!local,
					recordExists: !!record,
				},
			});
			removeRemoteFolderTasks.push(
				taskFactory.createRemoveRemoteTask({
					localPath: remote.path,
					remotePath: remote.path,
					remoteBaseDir,
				}),
			);
			continue;
		} else {
			logger.debug(`Create  local folder according to remote \`${remoteName}\``, {
				reason: 'remote folder does not exist locally',
				remotePath: remotePathToAbsolute(remoteBaseDir, remote.path),
				localPath: localPath,
				conditions: {
					localExists: !!local,
					recordExists: !!record,
				},
			});

			await createMkdirLocalTaskWithSnapshot(
				{
					localPath,
					remotePath: remote.path,
					remoteBaseDir,
				},
				remote,
			);

			continue;
		}
	}

	// * sync folder: local -> remote
	for (const local of localStatsFiltered) {
		await updateProgress();
		if (!local.isDir) continue;
		const remote = remoteStatsMap.get(local.path);
		const record = syncRecords.get(local.path);
		const localName = local.path;
		if (remote) {
			if (!record) {
				noopFolderTasks.push(
					taskFactory.createNoopTask({
						localPath: local.path,
						remotePath: remote.path,
						remoteBaseDir,
					}),
				);
				continue;
			}
		} else {
			if (record) {
				// Use sub-items check instead of mtime check
				const localChanged = hasFolderContentChanged(
					local.path,
					localStatsFiltered,
					syncRecords,
					'local',
				);

				if (localChanged) {
					logger.debug(`Create remote folder according to local \`${localName}\``, {
						reason: 'local folder content changed',
						remotePath: remotePathToAbsolute(remoteBaseDir, local.path),
						localPath: local.path,
						conditions: {
							localChanged,
							remoteExists: !!remote,
							recordExists: !!record,
						},
					});
					if (hasInvalidChar(local.path)) {
						tasks.push(
							taskFactory.createFilenameErrorTask({
								localPath: local.path,
								remotePath: local.path,
								remoteBaseDir,
							}),
						);
					} else {
						await createMkdirRemoteTaskWithSnapshot(
							{
								localPath: local.path,
								remotePath: local.path,
								remoteBaseDir,
							},
							local,
						);
					}
					continue;
				}

				if (hasIgnoredInFolder(local.path, localStats)) {
					const ignoredPaths = getIgnoredPathsInFolder(local.path, localStats);
					logger.debug(`Skip removing local folder \`${localName}\``, {
						reason: '(contains ignored items)',
						remotePath: remotePathToAbsolute(remoteBaseDir, local.path),
						localPath: local.path,
						conditions: {
							hasIgnoredItems: true,
							remoteExists: !!remote,
							recordExists: !!record,
						},
						ignoredPaths,
					});
					tasks.push(
						taskFactory.createSkippedTask({
							localPath: local.path,
							remotePath: local.path,
							remoteBaseDir,
							reason: SkipReason.FolderContainsIgnoredItems,
							ignoredPaths,
						}),
					);
					continue;
				}

				logger.debug(`Remove local folder \`${localName}\``, {
					reason: 'local folder is removable (no content changes)',
					remotePath: remotePathToAbsolute(remoteBaseDir, local.path),
					localPath: local.path,
					conditions: {
						removable: true,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});
				removeLocalFolderTasks.push(
					await (async () => {
						const folderTasks: BaseTask[] = [];
						await createRemoveLocalTaskWithSnapshot(
							{
								localPath: local.path,
								remotePath: local.path,
								remoteBaseDir,
							},
							local,
							folderTasks,
						);
						return folderTasks[0];
					})(),
				);
			} else {
				logger.debug(`Create remote folder according to local \`${localName}\``, {
					reason: 'local folder does not exist remotely',
					remotePath: remotePathToAbsolute(remoteBaseDir, local.path),
					localPath: local.path,
					conditions: {
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});
				if (hasInvalidChar(local.path)) {
					tasks.push(
						taskFactory.createFilenameErrorTask({
							localPath: local.path,
							remotePath: local.path,
							remoteBaseDir,
						}),
					);
				} else {
					await createMkdirRemoteTaskWithSnapshot(
						{
							localPath: local.path,
							remotePath: local.path,
							remoteBaseDir,
						},
						local,
					);
				}
				continue;
			}
			continue;
		}
		if (!remote.isDir)
			throw new Error(
				`Folder conflict: local path ${local.path} is a folder but remote path ${remote.path} is a file`,
			);
	}

	await updateProgress();
	tasks.push(
		...removeRemoteFolderTasks,
		...removeLocalFolderTasks,
		...mkdirLocalTasks,
		...mkdirRemoteTasks,
		...noopFolderTasks,
	);
	return tasks;
}
