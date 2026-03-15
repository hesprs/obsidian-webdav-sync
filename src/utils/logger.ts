export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerLogObject {
	date: Date;
	type: LoggerLevel;
	args: unknown[];
}

export interface LoggerReporter {
	log: (logObj: LoggerLogObject) => void;
}

class Logger {
	private reporters: LoggerReporter[] = [];

	debug(...args: unknown[]) {
		this.write('debug', args);
	}

	info(...args: unknown[]) {
		this.write('info', args);
	}

	warn(...args: unknown[]) {
		this.write('warn', args);
	}

	error(...args: unknown[]) {
		this.write('error', args);
	}

	addReporter(reporter: LoggerReporter) {
		this.reporters.push(reporter);
	}

	setReporters(reporters: LoggerReporter[]) {
		this.reporters = [...reporters];
	}

	private write(type: LoggerLevel, args: unknown[]) {
		const logObj: LoggerLogObject = {
			date: new Date(),
			type,
			args,
		};

		const consoleMethod = console[type] as (...consoleArgs: unknown[]) => void;
		consoleMethod(...args);

		for (const reporter of this.reporters) {
			reporter.log(logObj);
		}
	}
}

export default new Logger();
