import { IN_DEV } from '~/consts';
import { formatDateTime } from '~/utils/format-date';
import logger from '~/utils/logger';
import WebDAVSyncPlugin from '..';

export default class LoggerService {
	// oxlint-disable-next-line typescript/no-explicit-any
	logs: Array<any> = [];

	constructor(private plugin: WebDAVSyncPlugin) {
		if (IN_DEV) {
			logger.addReporter({
				log: (logObj) => {
					const log = [formatDateTime(logObj.date), logObj.type, logObj.args];
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
