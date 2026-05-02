import type { StatModel, StatsMap } from '~/types';
import isSub from '~/utils/is-sub';
import type { BaseTask } from '../tasks/task.interface';
import MergeTask from '../tasks/merge.task';
import PushTask from '../tasks/push.task';
import isSameTime from './is-same-time';

export default function isChanged({
	path,
	source,
	records,
	tasks,
	currentStats,
}: {
	path: string;
	source: 'local' | 'remote';
	records: Map<string, { local: StatModel; remote: StatModel }>;
	currentStats: StatsMap;
	tasks?: Array<BaseTask>;
}) {
	const thisRecord = records.get(path)?.[source];
	const target = currentStats.get(path);
	if (!thisRecord || !target) return true;
	// Unable to compare between directories and files
	if (target.isDir !== thisRecord.isDir) return true;
	// Compare files
	if (!target.isDir && !thisRecord.isDir) return !isSameTime(target.mtime, thisRecord.mtime);
	else {
		// Compare folders
		if (tasks)
			// Reuse tracked file changes
			for (const task of tasks)
				if (
					(task instanceof MergeTask || task instanceof PushTask) &&
					isSub(path, task.localPath)
				)
					return true;
		for (const [subPath, stats] of currentStats) {
			// Check for subfolder changes
			if (!stats.isDir || !isSub(path, subPath)) continue;
			const recorded = records.get(subPath)?.[source];
			if (!recorded) return true;
		}
	}
	return false;
}
