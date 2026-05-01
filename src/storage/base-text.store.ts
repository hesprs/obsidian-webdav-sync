import { BASE_TEXT_STORE_NAME, BaseStore } from './store.interface';

export default class IndexedDbBaseTextStore extends BaseStore {
	constructor() {
		super(BASE_TEXT_STORE_NAME);
	}

	async get(namespace: string, path: string): Promise<string | undefined> {
		return await this.run(
			'read base text',
			async () =>
				(await this.store.getItem<string>(this.getKey(namespace, path))) ?? undefined,
		);
	}

	async set(namespace: string, path: string, baseText: string): Promise<void> {
		await this.run('write local base text', async () => {
			await this.store.setItem(this.getKey(namespace, path), baseText);
		});
	}
}
