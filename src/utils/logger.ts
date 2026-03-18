import { SyncRunKind } from '~/model/sync-record.model';
import { formatDateTime } from '~/utils/format-date';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
	runId?: string;
	category?: string;
}

type LogValue = string | number | boolean | null | LogValue[] | { [key: string]: LogValue };

export interface LogEntry {
	timestamp: string;
	timestampMs: number;
	level: LogLevel;
	category: string;
	message: string;
	runId?: string;
	metadata?: LogValue;
}

interface RunReportSummary {
	trigger?: string;
	mode?: string;
	runKind?: string;
	stage?: string;
	sources?: string[];
	queuedAt?: number;
	planningStartedAt?: number;
	executionStartedAt?: number;
	endedAt?: number;
	durationMs?: number;
	planSummary?: {
		totalTasks: number;
		actionableTasks: number;
		noopTasks: number;
		skippedTasks: number;
		warnings?: Array<{ code?: string; messageKey?: string }>;
	};
	resultSummary?: {
		totalTasks: number;
		succeededTasks: number;
		failedTasks: number;
		failed?: Array<{
			taskName?: string;
			localPath?: string;
			errorMessage?: string;
		}>;
	};
	errorSummary?: {
		message?: string;
		name?: string;
	};
}

const MAX_LOG_ENTRIES = 1000;
const MARKDOWN_EXPORT_LEVELS: LogLevel[] = ['info', 'warn', 'error'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeLogValue(value: unknown, depth: number = 0): LogValue | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}

	if (value instanceof Error) {
		return sanitizeLogValue(
			{
				name: value.name,
				message: value.message,
				stack: value.stack,
			},
			depth + 1,
		);
	}

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
			if (sanitizedValue !== undefined) {
				sanitizedObject[key] = sanitizedValue;
			}
		}
		return sanitizedObject;
	}

	return JSON.stringify(value) ?? '[unserializable metadata]';
}

function formatMode(mode?: string): string | undefined {
	if (mode === undefined) return undefined;
	return mode === 'manual' ? 'manual' : 'auto';
}

function formatRunKind(runKind?: string): string | undefined {
	if (runKind === undefined) return undefined;
	return runKind === SyncRunKind.NUMB ? 'fast' : 'normal';
}

function formatDuration(durationMs?: number): string | undefined {
	if (durationMs === undefined) return undefined;
	if (durationMs < 1000) return `${durationMs}ms`;
	if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
	return `${(durationMs / 60000).toFixed(1)}m`;
}

function formatTimestamp(timestamp?: number): string | undefined {
	if (timestamp === undefined) return undefined;
	return formatDateTime(timestamp);
}

class Logger {
	private logs: LogEntry[] = [];
	private contextStack: LogContext[] = [];

	pushContext(context: LogContext) {
		const current = this.getCurrentContext();
		this.contextStack.push({
			...current,
			...context,
		});
	}

	popContext() {
		this.contextStack.pop();
	}

	info(message: string, metadata?: unknown, context?: LogContext) {
		this.write('info', message, metadata, context);
	}

	warn(message: string, metadata?: unknown, context?: LogContext) {
		this.write('warn', message, metadata, context);
	}

	error(message: string, metadata?: unknown, context?: LogContext) {
		this.write('error', message, metadata, context);
	}

	debug(messageOrMetadata: unknown, metadata?: unknown, context?: LogContext) {
		if (typeof messageOrMetadata === 'string') {
			this.write('debug', messageOrMetadata, metadata, context);
			return;
		}

		this.write('debug', 'Debug data', messageOrMetadata, context);
	}

	clear() {
		this.logs = [];
	}

	getEntries(): LogEntry[] {
		return [...this.logs];
	}

	stringify(): string {
		return this.logs
			.map((log) => {
				const metadata =
					log.metadata === undefined ? '' : ` ${JSON.stringify(log.metadata)}`;
				const runId = log.runId === undefined ? '' : ` [run:${log.runId}]`;
				return `${log.timestamp} [${log.level}] [${log.category}]${runId} ${log.message}${metadata}`;
			})
			.join('\n');
	}

	exportMarkdownReport(): string {
		const exportedLogs = this.logs.filter((log) => MARKDOWN_EXPORT_LEVELS.includes(log.level));
		const runGroups = new Map<string, LogEntry[]>();
		const generalLogs: LogEntry[] = [];

		for (const log of exportedLogs) {
			if (!log.runId) {
				generalLogs.push(log);
				continue;
			}

			const group = runGroups.get(log.runId) ?? [];
			group.push(log);
			runGroups.set(log.runId, group);
		}

		const lines: string[] = [
			'# WebDAV Sync Support Report',
			'',
			`Generated at: ${formatDateTime(Date.now())}`,
			'',
			`Stored records: ${this.logs.length}`,
			'',
		];

		if (runGroups.size === 0) {
			lines.push('## Sync runs', '', 'No sync runs recorded.', '');
		} else {
			lines.push('## Sync runs', '');
			const sortedRuns = Array.from(runGroups.entries()).sort(([, left], [, right]) => {
				const leftTime = left[0]?.timestampMs ?? 0;
				const rightTime = right[0]?.timestampMs ?? 0;
				return rightTime - leftTime;
			});

			for (const [runId, entries] of sortedRuns) {
				lines.push(...this.buildRunReport(runId, entries));
			}
		}

		lines.push('## General logs', '');
		if (generalLogs.length === 0) {
			lines.push('No general logs recorded.', '');
		} else {
			for (const entry of generalLogs) {
				lines.push(this.formatTimelineLine(entry));
			}
			lines.push('');
		}

		return lines.join('\n');
	}

	private buildRunReport(runId: string, entries: LogEntry[]): string[] {
		const summary = this.extractRunSummary(entries);
		const lines: string[] = [`### Run ${runId}`, ''];

		lines.push(`- Trigger: ${summary.trigger ?? 'unknown'}`);
		lines.push(`- Mode: ${formatMode(summary.mode) ?? 'unknown'}`);
		lines.push(`- Run kind: ${formatRunKind(summary.runKind) ?? 'unknown'}`);
		lines.push(`- Outcome: ${summary.stage ?? 'unknown'}`);
		if (summary.sources && summary.sources.length > 0) {
			lines.push(`- Sources: ${summary.sources.join(', ')}`);
		}
		lines.push(`- Queued at: ${formatTimestamp(summary.queuedAt) ?? 'unknown'}`);
		if (summary.planningStartedAt !== undefined) {
			lines.push(`- Planning started: ${formatTimestamp(summary.planningStartedAt)}`);
		}
		if (summary.executionStartedAt !== undefined) {
			lines.push(`- Execution started: ${formatTimestamp(summary.executionStartedAt)}`);
		}
		lines.push(`- Ended at: ${formatTimestamp(summary.endedAt) ?? 'unknown'}`);
		if (summary.durationMs !== undefined) {
			lines.push(`- Duration: ${formatDuration(summary.durationMs)}`);
		}
		lines.push('');

		if (summary.planSummary) {
			lines.push('#### Plan', '');
			lines.push(`- Total tasks: ${summary.planSummary.totalTasks}`);
			lines.push(`- Actionable tasks: ${summary.planSummary.actionableTasks}`);
			lines.push(`- No-op tasks: ${summary.planSummary.noopTasks}`);
			lines.push(`- Skipped tasks: ${summary.planSummary.skippedTasks}`, '');
		}

		const warnings = summary.planSummary?.warnings ?? [];
		if (warnings.length > 0) {
			lines.push('#### Important warnings', '');
			for (const warning of warnings) {
				lines.push(`- ${warning.code ?? warning.messageKey ?? 'warning'}`);
			}
			lines.push('');
		}

		if (summary.resultSummary) {
			lines.push('#### Outcome', '');
			lines.push(`- Total tasks: ${summary.resultSummary.totalTasks}`);
			lines.push(`- Succeeded: ${summary.resultSummary.succeededTasks}`);
			lines.push(`- Failed: ${summary.resultSummary.failedTasks}`, '');
		}

		const failures = summary.resultSummary?.failed ?? [];
		if (failures.length > 0) {
			lines.push('#### Failures', '');
			for (const failure of failures) {
				const task = failure.taskName ?? 'Unknown task';
				const path = failure.localPath ?? 'Unknown path';
				const errorMessage = failure.errorMessage ?? 'Unknown error';
				lines.push(`- ${task} — ${path} — ${errorMessage}`);
			}
			lines.push('');
		}

		if (summary.errorSummary?.message) {
			lines.push('#### Terminal error', '', `- ${summary.errorSummary.message}`, '');
		}

		lines.push('#### Timeline', '');
		for (const entry of entries) {
			lines.push(this.formatTimelineLine(entry));
		}
		lines.push('');

		return lines;
	}

	private extractRunSummary(entries: LogEntry[]): RunReportSummary {
		const summary: RunReportSummary = {};

		for (const entry of entries) {
			const metadata = isPlainObject(entry.metadata) ? entry.metadata : undefined;
			if (!metadata) continue;

			summary.trigger ??= this.readString(metadata.trigger);
			summary.mode ??= this.readString(metadata.mode);
			summary.runKind ??= this.readString(metadata.runKind);
			summary.stage = this.readString(metadata.stage) ?? summary.stage;
			summary.sources ??= this.readStringArray(metadata.sources);

			const timestamps = isPlainObject(metadata.timestamps) ? metadata.timestamps : undefined;
			summary.queuedAt ??= this.readNumber(timestamps?.queuedAt ?? metadata.queuedAt);
			summary.planningStartedAt ??= this.readNumber(
				timestamps?.planningStartedAt ?? metadata.planningStartedAt,
			);
			summary.executionStartedAt ??= this.readNumber(
				timestamps?.executionStartedAt ?? metadata.executionStartedAt,
			);
			summary.endedAt =
				this.readNumber(timestamps?.endedAt ?? metadata.endedAt) ?? summary.endedAt;
			summary.durationMs =
				this.readNumber(timestamps?.durationMs ?? metadata.durationMs) ??
				summary.durationMs;

			const planSummary = this.readPlanSummary(metadata.planSummary);
			if (planSummary) summary.planSummary = planSummary;

			const resultSummary = this.readResultSummary(metadata.resultSummary);
			if (resultSummary) summary.resultSummary = resultSummary;

			const errorSummary = this.readErrorSummary(metadata.errorSummary);
			if (errorSummary) summary.errorSummary = errorSummary;
		}

		return summary;
	}

	private readPlanSummary(value: unknown): RunReportSummary['planSummary'] {
		if (!isPlainObject(value)) return undefined;
		const warnings = Array.isArray(value.warnings)
			? value.warnings
					.filter((warning): warning is Record<string, unknown> => isPlainObject(warning))
					.map((warning) => ({
						code: this.readString(warning.code),
						messageKey: this.readString(warning.messageKey),
					}))
			: undefined;

		return {
			totalTasks: this.readNumber(value.totalTasks) ?? 0,
			actionableTasks: this.readNumber(value.actionableTasks) ?? 0,
			noopTasks: this.readNumber(value.noopTasks) ?? 0,
			skippedTasks: this.readNumber(value.skippedTasks) ?? 0,
			warnings,
		};
	}

	private readResultSummary(value: unknown): RunReportSummary['resultSummary'] {
		if (!isPlainObject(value)) return undefined;
		const failed = Array.isArray(value.failed)
			? value.failed
					.filter((failure): failure is Record<string, unknown> => isPlainObject(failure))
					.map((failure) => ({
						taskName: this.readString(failure.taskName),
						localPath: this.readString(failure.localPath),
						errorMessage: this.readString(failure.errorMessage),
					}))
			: undefined;

		return {
			totalTasks: this.readNumber(value.totalTasks) ?? 0,
			succeededTasks: this.readNumber(value.succeededTasks) ?? 0,
			failedTasks: this.readNumber(value.failedTasks) ?? 0,
			failed,
		};
	}

	private readErrorSummary(value: unknown): RunReportSummary['errorSummary'] {
		if (!isPlainObject(value)) return undefined;
		return {
			message: this.readString(value.message),
			name: this.readString(value.name),
		};
	}

	private readString(value: unknown): string | undefined {
		return typeof value === 'string' ? value : undefined;
	}

	private readNumber(value: unknown): number | undefined {
		return typeof value === 'number' ? value : undefined;
	}

	private readStringArray(value: unknown): string[] | undefined {
		if (!Array.isArray(value)) return undefined;
		return value.filter((item): item is string => typeof item === 'string');
	}

	private formatTimelineLine(entry: LogEntry): string {
		const parts = [
			`- ${entry.timestamp}`,
			`[${entry.level}]`,
			`[${entry.category}]`,
			entry.message,
		];
		if (entry.metadata !== undefined) {
			parts.push(`— ${JSON.stringify(entry.metadata)}`);
		}
		return parts.join(' ');
	}

	private write(level: LogLevel, message: string, metadata?: unknown, context?: LogContext) {
		const timestampMs = Date.now();
		const mergedContext = {
			category: 'app',
			...this.getCurrentContext(),
			...context,
		};
		const entry: LogEntry = {
			timestamp: formatDateTime(timestampMs),
			timestampMs,
			level,
			category: mergedContext.category ?? 'app',
			message,
			runId: mergedContext.runId,
			metadata: sanitizeLogValue(metadata),
		};

		this.logs.push(entry);
		if (this.logs.length > MAX_LOG_ENTRIES) {
			this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
		}

		if (level === 'debug') {
			return;
		}

		const consoleMethod = console[level] as (...consoleArgs: unknown[]) => void;
		if (entry.metadata === undefined) {
			consoleMethod(`[${entry.category}] ${message}`);
			return;
		}

		consoleMethod(`[${entry.category}] ${message}`, entry.metadata);
	}

	private getCurrentContext(): LogContext {
		return this.contextStack.at(-1) ?? {};
	}
}

export default new Logger();
