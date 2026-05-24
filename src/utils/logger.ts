import { apiVersion, Platform } from 'obsidian';
import type { SyncRunSnapshot } from '~/events';
import { VERSION } from '~/consts';
import { syncRun } from '~/events';
import formatDateTime from '~/utils/format-date';
import { isNil } from './fns';
import { formatTime } from './input-converters';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogValue = string | number | boolean | null | Array<LogValue> | { [key: string]: LogValue };

export type LogEntry = {
	timestamp: string;
	timestampMs: number;
	level: LogLevel;
	message: string;
	runId?: string;
	metadata?: LogValue;
};

const MAX_LOG_ENTRIES = 1000;
const MAX_RUNS = 200;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeLogValue(value: unknown, depth = 0): LogValue | undefined {
	if (isNil(value)) return;
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
		return value;

	if (value instanceof Error)
		return sanitizeLogValue(
			{ message: value.message, name: value.name, stack: value.stack },
			depth + 1,
		);

	if (Array.isArray(value)) {
		if (depth >= 4) return value.map((item) => String(item));
		return value
			.map((item) => sanitizeLogValue(item, depth + 1))
			.filter((item): item is LogValue => item !== undefined);
	}

	if (isPlainObject(value)) {
		if (depth >= 4) return '[truncated metadata]';
		const sanitizedObject: Record<string, LogValue> = {};
		for (const [key, entryValue] of Object.entries(value)) {
			const sanitizedValue = sanitizeLogValue(entryValue, depth + 1);
			if (sanitizedValue !== undefined) sanitizedObject[key] = sanitizedValue;
		}
		return sanitizedObject;
	}

	return JSON.stringify(value) ?? '[unserializable metadata]';
}

class Logger {
	private readonly logs: Array<LogEntry> = [];
	private readonly runs: Record<string, SyncRunSnapshot> = {};
	private readonly contextStack: Array<string> = [];

	constructor() {
		syncRun.subscribe(this.receiveRun);
	}

	pushRunId(context: string) {
		this.contextStack.push(context);
	}

	popRunId() {
		this.contextStack.pop();
	}

	info(message: string, metadata?: unknown) {
		this.write({ level: 'info', message, metadata });
	}

	warn(message: string, metadata?: unknown) {
		this.write({ level: 'warn', message, metadata });
	}

	error(message: string, metadata?: unknown) {
		this.write({ level: 'error', message, metadata });
	}

	debug(message: string, metadata?: unknown) {
		this.write({ level: 'debug', message, metadata });
	}

	exportMarkdownReport(): string {
		const runGroups = new Map<string, Array<LogEntry>>();
		const generalLogs: Array<LogEntry> = [];

		for (const log of this.logs) {
			if (!log.runId) {
				generalLogs.push(log);
				continue;
			}

			const group = runGroups.get(log.runId) ?? [];
			group.push(log);
			runGroups.set(log.runId, group);
		}

		const operatingSystem =
			Object.entries(OS).find(([, isActive]) => isActive)?.[0] ?? 'Unknown';

		const lines: Array<string> = [
			'# WebDAV Sync Support Report',
			'',
			`Generated at: ${formatDateTime(Date.now())}`,
			`Plugin version: ${VERSION}`,
			`Obsidian API version: ${apiVersion}`,
			`Operating system: ${operatingSystem}`,
			'',
		];

		if (runGroups.size === 0) lines.push('## Sync runs', '', 'No sync runs recorded.', '');
		else {
			lines.push('## Sync runs', '');
			const sortedRuns = [...runGroups.entries()].sort(([, left], [, right]) => {
				const leftTime = left[0]?.timestampMs ?? 0;
				const rightTime = right[0]?.timestampMs ?? 0;
				return rightTime - leftTime;
			});

			for (const [runId, entries] of sortedRuns)
				lines.push(...this.buildRunReport(runId, entries));
		}

		lines.push('## General logs', '');
		if (generalLogs.length === 0) lines.push('No general logs recorded.', '');
		else {
			for (const entry of generalLogs) lines.push(this.formatTimelineLine(entry));
			lines.push('');
		}

		return lines.join('\n');
	}

	private readonly receiveRun = (run?: SyncRunSnapshot) => {
		if (run) this.runs[run.runId] = run;
		const keys = Object.keys(this.runs);
		if (keys.length > MAX_RUNS) {
			const oldestRunId = keys[0];
			delete this.runs[oldestRunId];
		}
	};

	private buildRunReport(runId: string, entries: Array<LogEntry>): Array<string> {
		const run = this.runs[runId];
		const { planSummary, timestamps, resultSummary, errorSummary } = run;
		const lines: Array<string> = [`### Run \`${runId}\``, ''];

		lines.push(`- Trigger: ${run.trigger}`);
		lines.push(`- Run kind: ${run.runKind}`);
		lines.push(`- Outcome: ${run.stage ?? 'unknown'}`);
		if (run.serverUrl) lines.push(`- Server URL: \`${run.serverUrl}\``);
		if (run.sources.length > 0) lines.push(`- Sources: ${run.sources.join(', ')}`);

		if (timestamps.queuedAt) lines.push(`- Queued at: ${formatDateTime(timestamps.queuedAt)}`);
		if (timestamps.planningStartedAt)
			lines.push(`- Planning started: ${formatDateTime(timestamps.planningStartedAt)}`);
		if (timestamps.executionStartedAt)
			lines.push(`- Execution started: ${formatDateTime(timestamps.executionStartedAt)}`);
		if (timestamps.endedAt) lines.push(`- Ended at: ${formatDateTime(timestamps.endedAt)}`);
		if (timestamps.durationMs) lines.push(`- Duration: ${formatTime(timestamps.durationMs)}`);

		if (planSummary) lines.push(`- Total tasks: ${planSummary.totalTasks}`);
		lines.push('');

		const warnings = planSummary?.warnings ?? [];
		if (warnings.length > 0) {
			lines.push('#### Important warnings', '');
			for (const warning of warnings)
				lines.push(`- ${warning.code ?? warning.messageKey ?? 'warning'}`);
			lines.push('');
		}

		if (resultSummary) {
			lines.push('#### Outcome', '');
			lines.push(`- Succeeded: ${resultSummary.succeededTasks}`);
			lines.push(`- Failed: ${resultSummary.failedTasks}`, '');
		}

		const failures = resultSummary?.failed ?? [];
		if (failures.length > 0) {
			lines.push('#### Failures', '');
			for (const failure of failures) {
				const task = failure.name;
				const path = failure.localPath;
				const errorMessage = failure.errorMessage ?? 'Unknown error';
				lines.push(`- ${task} — ${path} — ${errorMessage}`);
			}
			lines.push('');
		}

		if (errorSummary?.message)
			lines.push('#### Terminal error', '', `- ${errorSummary.message}`, '');

		lines.push('#### Timeline', '');
		for (const entry of entries) lines.push(this.formatTimelineLine(entry));
		lines.push('');

		return lines;
	}

	private formatTimelineLine(entry: LogEntry): string {
		const parts = [`- ${entry.timestamp}`, `**${entry.level.toUpperCase()}**`, entry.message];
		if (entry.metadata !== undefined) parts.push(`— \`${JSON.stringify(entry.metadata)}\``);
		return parts.join(' ');
	}

	private write({
		level,
		message,
		metadata,
	}: {
		level: LogLevel;
		message: string;
		metadata?: unknown;
	}) {
		const timestampMs = Date.now();
		const entry: LogEntry = {
			level,
			message,
			metadata: sanitizeLogValue(metadata),
			runId: this.currentId,
			timestamp: formatDateTime(timestampMs),
			timestampMs,
		};

		this.logs.push(entry);
		if (this.logs.length > MAX_LOG_ENTRIES)
			this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
	}

	private get currentId() {
		return this.contextStack.at(-1) ?? '';
	}
}

const logger = new Logger();
export default logger;
