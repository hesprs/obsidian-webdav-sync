import logger from './logger';

export default function runAsync(task: () => Promise<void>, context: string): void {
	void task().catch((error) => {
		logger.error(context, { error }, { category: 'async.callback' });
	});
}
