import { expect, test } from 'bun:test';
import {
	MkdirLocalTask,
	MkdirRemoteTask,
	PullTask,
	PushTask,
	RemoveLocalRecursivelyTask,
	RemoveLocalTask,
	RemoveRemoteRecursivelyTask,
	RemoveRemoteTask,
} from '~/sync';
import optimizeTasks from '~/sync/utils/optimize-tasks';

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
			new PushTask({ ...sharedOptions, key: 'folder/file.md' }),
			new PullTask({ ...sharedOptions, key: 'notes/file.md' }),
			new RemoveLocalTask({ ...sharedOptions, key: 'old/file.md' }),
			new RemoveRemoteTask({ ...sharedOptions, key: 'gone/file.md' }),
			new MkdirRemoteTask({ ...sharedOptions, key: 'folder/' }),
			new MkdirLocalTask({ ...sharedOptions, key: 'notes/' }),
			new RemoveLocalTask({ ...sharedOptions, key: 'old/' }),
			new RemoveRemoteTask({ ...sharedOptions, key: 'gone/' }),
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
	expect(tasks[1].key).toBe('old/');
});

test('keeps remote reupload steps ahead of local deletion', () => {
	const tasks = optimizeTasks(
		[
			new RemoveLocalTask({ ...sharedOptions, key: 'archive/file.md' }),
			new PushTask({ ...sharedOptions, key: 'archive/file.md' }),
			new MkdirRemoteTask({ ...sharedOptions, key: 'archive/' }),
		],
		dummyOption,
		dummyOption,
	).flat();

	expect(tasks[0]).toBeInstanceOf(RemoveLocalTask);
	expect(tasks[1]).toBeInstanceOf(MkdirRemoteTask);
	expect(tasks[2]).toBeInstanceOf(PushTask);
});
