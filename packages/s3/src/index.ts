import type {
	RemoteFsEntry,
	FsWrapperEntry,
	Translate,
	Translations,
	SelectFromContext,
	SettingEntry,
	ObsidianLanguageCode,
	TranslationResource,
	Settings,
	OptimizerEntry,
	RemoteRequestMiddlewareEntry,
} from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import { digOriginal, prefixWrapper } from '@hesprs/sync-engine-sdk';
import type { UrlStyle } from '@/s3/sigv4';
import type { S3Translations } from '@/setting';
import { sigv4Middleware } from '@/s3/sigv4';
import { en, zh, zhTW, ru } from './i18n';
import s3BatchDeleteOptimizer from './optimizer';
import { checkConnection } from './s3/check-connection';
import S3Fs from './s3/fs';
import s3Setting from './setting';

export type S3Settings = {
	endpoint: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	urlStyle: UrlStyle;
	prefix: string;
	proxyUrl: {
		enabled: boolean;
		value: string;
	};
};

export default class S3 {
	private readonly cleanup: Array<() => void> = [];

	constructor(
		private readonly ctx: SelectFromContext<{
			translate: Translate<Translations & S3Translations>;
			registerRemoteFs: (id: string, entry: RemoteFsEntry) => () => void;
			app: App;
			registerRemoteFsWrapper: (entry: FsWrapperEntry) => () => void;
			registerSetting: (entry: SettingEntry) => () => void;
			registerI18n: (lang: ObsidianLanguageCode, translations: TranslationResource) => void;
			registerRemoteOptimizer: (entry: OptimizerEntry) => () => void;
			registerRemoteRequestMiddleware: (entry: RemoteRequestMiddlewareEntry) => () => void;
			saveSettings: () => Promise<void>;
			settings: { remoteFs: string };
		}>,
	) {
		ctx.registerI18n('en', en);
		ctx.registerI18n('zh', zh);
		ctx.registerI18n('zh-TW', zhTW);
		ctx.registerI18n('ru', ru);
	}

	readonly moduleSettings: S3Settings = {
		accessKeyId: '',
		bucket: '',
		endpoint: '',
		prefix: '/',
		proxyUrl: {
			enabled: false,
			value: '',
		},
		region: 'us-east-1',
		secretAccessKey: '',
		urlStyle: 'virtualHosted',
	};

	declare settings: Settings;

	readonly start = () => {
		const {
			translate,
			registerRemoteFs,
			app: { secretStorage },
			registerRemoteFsWrapper,
			registerSetting,
			registerRemoteOptimizer,
			registerRemoteRequestMiddleware,
		} = this.ctx;
		const resolveConfig = () => {
			const { endpoint, region, accessKeyId, bucket, urlStyle, prefix } = this.moduleSettings;
			const secretAccessKey = secretStorage.getSecret(this.moduleSettings.secretAccessKey);
			if (secretAccessKey === null || !endpoint || !bucket)
				throw new Error('Please configure S3 account!');
			return { accessKeyId, bucket, endpoint, prefix, region, secretAccessKey, urlStyle };
		};
		const resolvePublicConfig = () => {
			const { secretAccessKey: _, ...config } = resolveConfig();
			return config;
		};
		this.cleanup.push(
			registerRemoteFs('s3', {
				checkConnection: (request) => checkConnection(resolvePublicConfig(), request),
				instantiate: (request) => new S3Fs({ ...resolvePublicConfig(), request }),
				prettyName: () => translate('s3'),
			}),
			registerRemoteFsWrapper({
				apply: (fs) => {
					if (digOriginal(fs) instanceof S3Fs)
						return prefixWrapper(fs, this.moduleSettings.prefix);
				},
				priority: 6298,
			}),
			registerRemoteOptimizer({
				apply: s3BatchDeleteOptimizer,
				priority: 3343,
			}),
			registerRemoteRequestMiddleware({
				apply: (request) => {
					if (this.ctx.settings.remoteFs !== 's3') return;
					const { accessKeyId, region, secretAccessKey } = resolveConfig();
					return sigv4Middleware(request, {
						accessKeyId,
						region,
						secretAccessKey,
						service: 's3',
					});
				},
				priority: 304,
			}),
			registerRemoteRequestMiddleware({
				apply: (request) => {
					if (this.ctx.settings.remoteFs !== 's3') return;
					const { value, enabled } = this.moduleSettings.proxyUrl;
					if (!enabled) return;
					let proxy: URL;
					try {
						proxy = new URL(value);
					} catch {
						throw new Error('Please enter a valid S3 proxy URL!');
					}
					return (params) => {
						const originalUrl = typeof params === 'string' ? params : params.url;
						const original = new URL(originalUrl);
						const rewritten = `${proxy.protocol}//${proxy.host}${original.pathname}${original.search}`;
						if (typeof params === 'string') return request(rewritten);
						return request({ ...params, url: rewritten });
					};
				},
				priority: 303,
			}),
			registerSetting({
				apply: (el) => s3Setting(el, this.ctx, this.moduleSettings),
				priority: 604,
			}),
		);
	};

	readonly dispose = () => {
		this.cleanup.forEach((fn) => fn());
		this.cleanup.length = 0;
	};
}
