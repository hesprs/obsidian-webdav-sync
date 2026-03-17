import { formatDateTime } from '~/utils/format-date';
import deepStringify from './deep-stringify';

type LogLevels = 'info' | 'warn' | 'error' | 'debug';

type Log<T extends LogLevels> = {
	date: string;
	level: T;
	args: T extends 'debug' ? Array<unknown> : string;
};

// TODO: make it a service
class Logger {
	// oxlint-disable-next-line typescript/no-explicit-any
	private logs: Array<Log<any>> = [];

	debug(...args: unknown[]) {
		this.write('debug', args);
	}

	info(args: string) {
		this.write('info', args);
	}

	warn(args: string) {
		this.write('warn', args);
	}

	error(args: string) {
		this.write('error', args);
	}

	clear() {
		this.logs = [];
	}

	stringify(): string {
		const logs = this.logs.map((log) => {
			const { args, level, date } = log;
			if (level === 'debug') {
				const arg = args.length === 1 ? args[0] : args;
				return `${date} - [${level}] - ${JSON.stringify(arg) ?? deepStringify(arg) ?? '[error]'}`;
			} else return `${date} - [${level}] - ${args as string}`;
		});
		return logs.join('\n');
	}

	private write<T extends LogLevels>(level: T, args: Log<T>['args']) {
		const logObj: Log<T> = {
			date: formatDateTime(new Date()),
			level,
			args,
		};
		this.logs.push(logObj);

		const consoleMethod = console[level] as (...consoleArgs: unknown[]) => void;
		consoleMethod(args);
	}
}

export default new Logger();
