import type { LoggerLevel, LoggerLogObject } from '~/utils/logger';
import { IN_DEV } from '~/consts';
import { formatDateTime } from '~/utils/format-date';
import logger from '~/utils/logger';
import WebDAVSyncPlugin from '..';

type FormattedLogEntry = [string, LoggerLevel, unknown[]];

export default class LoggerService {
	logs: Array<FormattedLogEntry | LoggerLogObject> = [];

	constructor(private plugin: WebDAVSyncPlugin) {
		if (IN_DEV) {
			logger.addReporter({
				log: (logObj) => {
					const log: FormattedLogEntry = [
						formatDateTime(logObj.date),
						logObj.type,
						logObj.args,
					];
					this.logs.push(log);
				},
			});
		} else {
			logger.setReporters([
				{
					log: (logObj) => {
						this.logs.push(logObj);
					},
				},
			]);
		}
	}

	clear() {
		this.logs = [];
	}
}
