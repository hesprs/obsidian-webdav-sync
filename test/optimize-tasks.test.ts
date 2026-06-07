import { expect, test } from 'bun:test';

const [
	{ default: MkdirLocalTask },
	{ default: MkdirRemoteTask },
	{ default: PullTask },
	{ default: PushTask },
	{ default: RemoveLocalRecursivelyTask },
	{ default: RemoveLocalTask },
	{ default: RemoveRemoteRecursivelyTask },
	{ default: RemoveRemoteTask },
	{ default: optimizeTasks },
] = await Promise.all([
	import('~/sync/tasks/mkdir-local.task'),
	import('~/sync/tasks/mkdir-remote.task'),
	import('~/sync/tasks/pull.task'),
	import('~/sync/tasks/push.task'),
	import('~/sync/tasks/remove-local-recursively.task'),
	import('~/sync/tasks/remove-local.task'),
	import('~/sync/tasks/remove-remote-recursively.task'),
	import('~/sync/tasks/remove-remote.task'),
	import('~/sync/utils/optimize-tasks'),
]);

const sharedOptions = {
	local: {} as never,
	remote: {} as never,
	syncRecord: {} as never,
	vault: {} as never,
	webdav: {} as never,
};

const dummyOption = {
	enabled: false,
	value: 0,
};

test('merges removals and orders directory creation before file tasks', () => {
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
	).flat();

	expect(tasks[0]).toBeInstanceOf(RemoveRemoteRecursivelyTask);
	expect(tasks[1]).toBeInstanceOf(RemoveLocalRecursivelyTask);
	expect(tasks[2]).toBeInstanceOf(MkdirLocalTask);
	expect(tasks[3]).toBeInstanceOf(MkdirRemoteTask);
	expect(tasks[4]).toBeInstanceOf(PushTask);
	expect(tasks[5]).toBeInstanceOf(PullTask);
	expect(tasks).toHaveLength(6);
	expect(tasks[1].localPath).toBe('old');
});

test('keeps remote reupload steps ahead of local deletion', () => {
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
	).flat();

	expect(tasks[0]).toBeInstanceOf(RemoveLocalTask);
	expect(tasks[1]).toBeInstanceOf(MkdirRemoteTask);
	expect(tasks[2]).toBeInstanceOf(PushTask);
});
