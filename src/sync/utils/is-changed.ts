import type { StatModel, StatsMap } from '~/types';
import { SyncMode } from '~/settings';
import { isSub } from '~/utils/is-sub';
import type { BaseTask } from '../tasks/task.interface';
import MergeTask from '../tasks/merge.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
import { isSameTime } from './is-same-time';

export default async function isChanged({
	path,
	source,
	records,
	tasks,
	currentStats,
	getBaseText,
	compareFileContent,
	syncMode,
}: {
	path: string;
	source: 'local' | 'remote';
	records: Map<string, { local: StatModel; remote: StatModel }>;
	currentStats: StatsMap;
	tasks?: BaseTask[];
	syncMode?: SyncMode;
	getBaseText?: (path: string) => Promise<string | undefined>;
	compareFileContent?: (path: string, baseText: string) => Promise<boolean>;
}) {
	const thisRecord = records.get(path)?.[source];
	const target = currentStats.get(path);
	if (!thisRecord || !target) return true;
	// unable to compare between directories and files
	if (target.isDir !== thisRecord.isDir) return true;
	if (!target.isDir && !thisRecord.isDir) {
		// compare files
		if (isSameTime(target.mtime, thisRecord.mtime)) return false;
		// compare real content on local changes
		if (source === 'local') {
			if (!getBaseText || !compareFileContent) return false;
			if (syncMode === SyncMode.STRICT) {
				const baseText = await getBaseText(path);
				if (baseText) return !(await compareFileContent(path, baseText));
			} else if (thisRecord.size === target.size) return false;
		}
		return true;
	} else {
		// compare folders
		if (tasks)
			// reuse tracked file changes
			for (const task of tasks)
				if (
					(task instanceof MergeTask ||
						task instanceof PullTask ||
						task instanceof PushTask) &&
					isSub(path, task.localPath)
				)
					return true;
		for (const [subPath, stats] of currentStats) {
			// check for subfolder changes
			if (!stats.isDir || !isSub(path, subPath)) continue;
			const recorded = records.get(subPath)?.[source];
			if (!recorded) return true;
		}
	}
	return false;
}
