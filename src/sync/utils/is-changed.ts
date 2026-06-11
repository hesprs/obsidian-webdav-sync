import type { RecordStatsMap, StatsMap } from '~/types';
import isSub from '~/utils/is-sub';
import type { BaseTask } from '../tasks/task.interface';
import MergeTask from '../tasks/merge.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';

export default function isChanged({
	path,
	source,
	records,
	tasks,
	currentStats,
}: {
	path: string;
	source: 'local' | 'remote';
	records: RecordStatsMap;
	currentStats: StatsMap;
	tasks?: Array<BaseTask>;
}) {
	const inRecords = records.get(path);
	const record = inRecords
		? inRecords.isDir
			? { isDir: true }
			: { isDir: false, uid: inRecords[source] }
		: undefined;
	const target = currentStats.get(path);
	if (!record || !target) return true;
	// Unable to compare between directories and files
	if (target.isDir !== record.isDir) return true;
	// Compare files
	if (!target.isDir && !record.isDir) return target.uid !== record.uid;
	else {
		// Compare folders
		if (tasks)
			// Reuse tracked file changes
			for (const task of tasks)
				if (
					(task instanceof MergeTask ||
						task instanceof PushTask ||
						task instanceof PullTask) &&
					isSub(path, task.key)
				)
					return true;
		for (const [subPath, stats] of currentStats) {
			// Check for subfolder changes
			if (!stats.isDir || !isSub(path, subPath)) continue;
			if (!records.get(subPath)) return true;
		}
	}
	return false;
}
