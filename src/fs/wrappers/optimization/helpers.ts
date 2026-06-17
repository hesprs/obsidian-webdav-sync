import { isSub } from '~/utils/path';

function selectShallowestDeleteKeys(keys: Array<string>): Array<string> {
	if (keys.length <= 1) return [...keys];
	const uniqueKeys = [...new Set(keys)];
	const sortedKeys = uniqueKeys.sort((left, right) => {
		const leftDepth = getKeyDepth(left);
		const rightDepth = getKeyDepth(right);
		if (leftDepth !== rightDepth) return leftDepth - rightDepth;
		return left.localeCompare(right);
	});

	const selectedKeys: Array<string> = [];
	for (const key of sortedKeys) {
		const isCovered = selectedKeys.some(
			(selectedKey) => selectedKey === key || isSub(selectedKey, key),
		);
		if (!isCovered) selectedKeys.push(key);
	}
	return selectedKeys;
}

type WithKey = { key: string };

type KeyGroup<T extends WithKey> = {
	items: Array<T>;
	key: string;
};

export function collapseDeleteGroups<T extends WithKey>(items: Array<T>): Array<KeyGroup<T>> {
	return selectShallowestDeleteKeys(items.map((item) => item.key)).map((key) => ({
		items: items.filter((item) => item.key === key || isSub(key, item.key)),
		key,
	}));
}

export function groupMkdirGroupsByDepth<T extends WithKey>(
	items: Array<T>,
): Array<Array<KeyGroup<T>>> {
	return groupByDepth(groupByKey(items));
}

export function countQueuedJobs(...groups: Array<Array<unknown>>) {
	return groups.reduce((sum, group) => sum + group.length, 0);
}

export async function runGroupedJobs<T extends WithKey>(
	groups: Array<KeyGroup<T>>,
	run: (key: string) => Promise<void>,
	onResolve: (item: T) => void,
	onReject: (item: T, error: unknown) => void,
) {
	await Promise.all(
		groups.map(async ({ items, key }) => {
			try {
				await run(key);
				for (const item of items) onResolve(item);
			} catch (error) {
				for (const item of items) onReject(item, error);
			}
		}),
	);
}

export async function runSingleQueuedJob<T>(queue: Array<T>, run: (job: T) => Promise<void>) {
	const job = queue.shift();
	if (!job) return false;
	await run(job);
	return true;
}

function groupByKey<T extends WithKey>(items: Array<T>): Array<KeyGroup<T>> {
	const groups = new Map<string, KeyGroup<T>>();
	for (const item of items) {
		const existingGroup = groups.get(item.key);
		if (existingGroup) existingGroup.items.push(item);
		else groups.set(item.key, { items: [item], key: item.key });
	}
	return [...groups.values()];
}

function groupByDepth<T extends WithKey>(items: Array<T>): Array<Array<T>> {
	const groups = new Map<number, Array<T>>();
	for (const item of items) {
		const depth = getKeyDepth(item.key);
		const group = groups.get(depth);
		if (group) group.push(item);
		else groups.set(depth, [item]);
	}
	return [...groups.entries()]
		.sort(([leftDepth], [rightDepth]) => leftDepth - rightDepth)
		.map(([, group]) => group);
}

function getKeyDepth(key: string) {
	return key === '/' ? 0 : key.split('/').length;
}
