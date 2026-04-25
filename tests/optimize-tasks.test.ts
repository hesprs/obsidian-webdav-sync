import { describe, expect, it, vi } from 'vitest';

vi.mock('~/i18n', () => ({
	default: (key: string) => key,
}));

vi.mock('~/settings', () => ({
	ConflictStrategy: {
		DiffMatchPatch: 'diffMatchPatch',
		LatestTimeStamp: 'latestTimestamp',
		KeepLocal: 'keepLocal',
		KeepRemote: 'keepRemote',
		Skip: 'skip',
	},
	UnmergeableStrategy: {
		LatestTimeStamp: 'latestTimestamp',
		KeepLocal: 'keepLocal',
		KeepRemote: 'keepRemote',
		Skip: 'skip',
	},
	useSettings: async () => ({
		useGitStyle: false,
		maxThroughputConcurrency: { enabled: false, value: 0 },
	}),
}));

import MkdirLocalTask from '~/sync/tasks/mkdir-local.task';
import MkdirRemoteTask from '~/sync/tasks/mkdir-remote.task';
import PullTask from '~/sync/tasks/pull.task';
import PushTask from '~/sync/tasks/push.task';
import RemoveLocalRecursivelyTask from '~/sync/tasks/remove-local-recursively.task';
import RemoveLocalTask from '~/sync/tasks/remove-local.task';
import RemoveRemoteRecursivelyTask from '~/sync/tasks/remove-remote-recursively.task';
import RemoveRemoteTask from '~/sync/tasks/remove-remote.task';
import { optimizeTasks } from '~/sync/utils/optimize-tasks';

const sharedOptions = {
	vault: {} as never,
	webdav: {} as never,
	syncRecord: {} as never,
	local: {} as never,
	remote: {} as never,
};

const dummyOption = {
	enabled: false,
	value: 0,
};

describe('optimizeSync', () => {
	it('creates directories before file writes and merges subtree removals', () => {
		const tasks = optimizeTasks(
			[
				new PushTask({
					...sharedOptions,
					localPath: 'folder/file.md',
					remotePath: 'folder/file.md',
				}),
				new PullTask({
					...sharedOptions,
					localPath: 'notes/file.md',
					remotePath: 'notes/file.md',
				}),
				new RemoveLocalTask({
					...sharedOptions,
					localPath: 'old/file.md',
					remotePath: 'old/file.md',
				}),
				new RemoveRemoteTask({
					...sharedOptions,
					localPath: 'gone/file.md',
					remotePath: 'gone/file.md',
				}),
				new MkdirRemoteTask({
					...sharedOptions,
					localPath: 'folder',
					remotePath: 'folder',
				}),
				new MkdirLocalTask({
					...sharedOptions,
					localPath: 'notes',
					remotePath: 'notes',
				}),
				new RemoveLocalTask({ ...sharedOptions, localPath: 'old', remotePath: 'old' }),
				new RemoveRemoteTask({ ...sharedOptions, localPath: 'gone', remotePath: 'gone' }),
			],
			dummyOption,
			dummyOption,
		).flatMap((task) => task);

		expect(tasks[0]).toBeInstanceOf(RemoveRemoteRecursivelyTask);
		expect(tasks[1]).toBeInstanceOf(RemoveLocalRecursivelyTask);
		expect(tasks[2]).toBeInstanceOf(MkdirLocalTask);
		expect(tasks[3]).toBeInstanceOf(MkdirRemoteTask);
		expect(tasks[4]).toBeInstanceOf(PushTask);
		expect(tasks[5]).toBeInstanceOf(PullTask);
		expect(tasks).toHaveLength(6);
		expect(tasks[1].localPath).toBe('old');
	});

	it('keeps remote reupload dependencies ahead of local deletion', () => {
		const tasks = optimizeTasks(
			[
				new RemoveLocalTask({
					...sharedOptions,
					localPath: 'archive/file.md',
					remotePath: 'archive/file.md',
				}),
				new PushTask({
					...sharedOptions,
					localPath: 'archive/file.md',
					remotePath: 'archive/file.md',
				}),
				new MkdirRemoteTask({
					...sharedOptions,
					localPath: 'archive',
					remotePath: 'archive',
				}),
			],
			dummyOption,
			dummyOption,
		).flatMap((task) => task);

		expect(tasks[0]).toBeInstanceOf(RemoveLocalTask);
		expect(tasks[1]).toBeInstanceOf(MkdirRemoteTask);
		expect(tasks[2]).toBeInstanceOf(PushTask);
	});
});
