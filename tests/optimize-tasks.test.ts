import { describe, expect, it } from 'vitest';
import MkdirLocalTask from '~/sync/tasks/mkdir-local.task';
import MkdirRemoteTask from '~/sync/tasks/mkdir-remote.task';
import MkdirsRemoteTask from '~/sync/tasks/mkdirs-remote.task';
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
	remoteBaseDir: '/remote',
};

describe('optimizeSync', () => {
	it('creates directories before file writes and merges subtree removals', () => {
		const tasks = optimizeTasks([
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
		]);

		expect(tasks[0]).toBeInstanceOf(MkdirLocalTask);
		expect(tasks[1]).toBeInstanceOf(MkdirsRemoteTask);
		expect(tasks[2]).toBeInstanceOf(PushTask);
		expect(tasks[3]).toBeInstanceOf(PullTask);
		expect(tasks[4]).toBeInstanceOf(RemoveRemoteRecursivelyTask);
		expect(tasks[5]).toBeInstanceOf(RemoveLocalRecursivelyTask);
		expect(tasks).toHaveLength(6);
		expect(tasks[5].localPath).toBe('old');
	});

	it('keeps remote reupload dependencies ahead of local deletion', () => {
		const tasks = optimizeTasks([
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
		]);

		expect(tasks[0]).toBeInstanceOf(MkdirsRemoteTask);
		expect(tasks[1]).toBeInstanceOf(PushTask);
		expect(tasks[2]).toBeInstanceOf(RemoveLocalTask);
	});

	it('deduplicates repeated task instances', () => {
		const mkdirTask = new MkdirRemoteTask({
			...sharedOptions,
			localPath: 'dup',
			remotePath: 'dup',
		});

		const tasks = optimizeTasks([mkdirTask, mkdirTask]);

		expect(tasks).toHaveLength(1);
		expect(tasks[0]).toBeInstanceOf(MkdirsRemoteTask);
	});
});
