import type { EventMap } from '~';
import { apiVersion, Platform } from 'obsidian';
import { ref } from 'synthkernel';
import { VERSION } from '~/consts';
import { formatDateTime } from '~/utils/format-date';
import { formatTime } from '~/utils/unit-converter';
import type { SyncTrigger } from './Sync';

// oxlint-disable-next-line sort-keys
const OS = {
	'Android Tablet': Platform.isTablet && Platform.isAndroidApp,
	iPadOS: Platform.isTablet && Platform.isMacOS,
	Android: Platform.isAndroidApp,
	iOS: Platform.isIosApp,
	Linux: Platform.isLinux,
	macOS: Platform.isMacOS,
	Windows: Platform.isWin,
};
const MAX_SYNC_LOGS = 100;

export type Dispatch = EventBus['dispatch'];
export type On = EventBus['on'];
type SyncStats = {
	trigger: SyncTrigger;
	started: number;
	outcome?: 'noop' | 'completed' | 'cancelled' | 'failed';
	ended?: number;
	totalTasks?: number;
	succeededTasks?: number;
	failedTasks?: number;
	logs: Array<string>;
};

export default class EventBus {
	declare readonly events: { log: string };
	private readonly cleanupCallbacks: Array<() => void> = [];
	private readonly isIdle = ref(true);
	private readonly syncLogs: Array<SyncStats> = [];
	private readonly generalLogs: Array<string> = [];

	constructor() {
		this.cleanupCallbacks.push(
			this.on('syncStarted', ({ trigger }) => {
				this.isIdle(false);
				this.syncLogs.push({ logs: [], started: Date.now(), trigger });
				if (this.syncLogs.length > MAX_SYNC_LOGS) this.syncLogs.shift();
				this.putLog(`Sync triggered by \`${trigger}\` started`);
			}),
			this.on('log', (log) => this.putLog(log)),
			this.on('executionStarted', (tasks) => {
				this.getThisSync().totalTasks = tasks.length;
				this.putLog(`Execution of ${tasks.length} sync tasks started.`);
			}),
			this.on('taskCompleted', ({ key, name }) => {
				const thisSync = this.getThisSync();
				if (!thisSync.succeededTasks) thisSync.succeededTasks = 1;
				else thisSync.succeededTasks += 1;
				this.putLog(`Task \`${name}\` of \`${key}\` succeeded.`);
			}),
			this.on('taskFailed', ({ key, name, error }) => {
				const thisSync = this.getThisSync();
				if (!thisSync.failedTasks) thisSync.failedTasks = 1;
				else thisSync.failedTasks += 1;
				this.putLog(
					`Task \`${name}\` of \`${key}\` failed with error: \`${error}\`.`,
					'error',
				);
			}),
			this.on('tasksConfirmed', (tasks) => this.putLog(`Confirmed ${tasks.length} tasks.`)),
			this.on('syncCanceled', () => this.putLog('Sync is forced to stop.')),
			this.on('deleteConfirmed', ({ reupload, delete: D }) =>
				this.putLog(
					`Confirmed to delete ${D.length} files, reupload ${reupload.length} files.`,
				),
			),
			this.on('syncTerminate', (reason) => {
				const { result } = reason;
				const thisSync = this.getThisSync();
				thisSync.outcome = result;
				thisSync.ended = Date.now();
				if (result === 'failed')
					this.putLog(`Sync ended with error: \`${reason.error}\`.`, 'error');
				else this.putLog(`Sync ended with result: \`${result}\`.`);
				this.isIdle(true);
			}),
		);
	}

	private readonly getThisSync = () => this.syncLogs.at(-1) as SyncStats;
	private readonly putLog = (log: string, level: 'info' | 'error' = 'info') => {
		const message = `- \`${level.toLocaleUpperCase()}\` - ${log}`;
		if (this.isIdle()) this.generalLogs.push(message);
		else this.getThisSync().logs.push(message);
	};

	private readonly subscribers: { [K in keyof EventMap]?: Set<(event: EventMap[K]) => void> } =
		{};

	private readonly on = <E extends keyof EventMap>(
		event: E,
		callback: (payload: EventMap[E]) => void,
	) => {
		this.subscribers[event] ??= new Set<(event: EventMap[E]) => void>() as never;
		this.subscribers[event].add(callback);
		return () => this.subscribers[event]?.delete(callback);
	};

	private readonly dispatch = <E extends keyof EventMap>(
		...[event, payload]: undefined extends EventMap[E] ? [E] : [E, EventMap[E]]
	) => {
		this.subscribers[event]?.forEach((listener) => listener(payload as never));
	};

	private readonly getLogs = () => {
		const operatingSystem =
			Object.entries(OS).find(([, isActive]) => isActive)?.[0] ?? 'Unknown';
		const lines: Array<string> = [
			`Generated at: ${formatDateTime(Date.now())}`,
			`Plugin version: ${VERSION}`,
			`Obsidian API version: ${apiVersion}`,
			`Operating system: ${operatingSystem}`,
			'',
		];
		for (const {
			trigger,
			started,
			outcome,
			ended,
			totalTasks,
			succeededTasks,
			failedTasks,
			logs,
		} of this.syncLogs.toReversed()) {
			lines.push(
				'---',
				'',
				`Trigger: \`${trigger}\``,
				`Started at: ${formatDateTime(started)}`,
			);
			if (ended)
				lines.push(
					`Ended at: ${formatDateTime(ended)}`,
					`Duration: ${formatTime(ended - started)}`,
				);
			if (totalTasks) lines.push(`Total tasks: ${totalTasks}`);
			if (succeededTasks) lines.push(`Succeed: ${succeededTasks}`);
			if (failedTasks) lines.push(`Failed: ${failedTasks}`);
			if (outcome) lines.push(`Outcome: \`${outcome}\``);
			lines.push('Logs:', '');
			for (const log of logs) lines.push(log);
			lines.push('');
		}
		if (this.generalLogs.length)
			lines.push('---', '', 'General logs:', '', ...this.generalLogs, '');
		return lines.join('\n');
	};

	dispose = () => {
		this.cleanupCallbacks.forEach((cleanup) => cleanup());
		if (!this.isIdle()) this.dispatch('syncCanceled');
	};

	root = { dispatch: this.dispatch, getLogs: this.getLogs, isIdle: this.isIdle, on: this.on };
}
