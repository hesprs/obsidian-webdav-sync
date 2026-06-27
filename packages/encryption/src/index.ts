import type {
	DatabaseSync,
	MemoryDBMeta,
	MemoryDBSchema,
	RemoteFsWrapperEntry,
	SelectFromContext,
} from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import type { EncryptionDB } from '@/wrapper';
import encryptionWrapper from '@/wrapper';

export default class Encryption {
	private readonly cleanup: Array<() => boolean> = [];

	constructor(
		private readonly ctx: SelectFromContext<{
			registerRemoteFsWrapper: (entry: RemoteFsWrapperEntry) => () => boolean;
			app: App;
			memoryDB: DatabaseSync<MemoryDBSchema, MemoryDBMeta>;
		}>,
	) {}

	moduleSettings = {
		enabled: false,
		password: '',
	};

	readonly start = () => {
		const { app, memoryDB, registerRemoteFsWrapper } = this.ctx;
		const typedMemoryDB = memoryDB as unknown as EncryptionDB;
		this.cleanup.push(
			registerRemoteFsWrapper({
				apply: (fs) => {
					const { enabled, password: pwd } = this.moduleSettings;
					if (!enabled) return fs;
					const password = app.secretStorage.getSecret(pwd);
					if (!password) throw new Error('Please configure encryption password!');
					return encryptionWrapper(fs, { memoryDB: typedMemoryDB, password });
				},
				order: 6919,
			}),
		);
	};

	readonly dispose = () => {
		this.cleanup.forEach((fn) => fn());
		this.cleanup.length = 0;
	};
}
