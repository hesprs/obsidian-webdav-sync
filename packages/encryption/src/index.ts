import type { RemoteFsWrapperEntry, SelectFromContext } from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import encryptionWrapper from '@/wrapper';

export default class Encryption {
	private readonly cleanup: Array<() => void> = [];

	constructor(
		private readonly ctx: SelectFromContext<{
			registerRemoteFsWrapper: (entry: RemoteFsWrapperEntry) => () => void;
			app: App;
		}>,
	) {}

	moduleSettings = {
		enabled: false,
		password: '',
	};

	readonly start = () => {
		const {
			registerRemoteFsWrapper,
			app: { secretStorage },
		} = this.ctx;
		this.cleanup.push(
			registerRemoteFsWrapper({
				apply: (fs) => {
					const { enabled, password: pwd } = this.moduleSettings;
					if (!enabled) return fs;
					const password = secretStorage.getSecret(pwd);
					if (!password) throw new Error('Please configure encryption password!');
					return encryptionWrapper(fs, password);
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
