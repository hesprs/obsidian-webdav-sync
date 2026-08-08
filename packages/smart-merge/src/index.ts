import type {
	ConflictResolverEntry,
	DatabaseAsync,
	ObsidianLanguageCode,
	Fs,
	FsWrapperEntry,
	SelectFromContext,
	SettingEntry,
	StoreAsync,
	TranslationResource,
	Translate,
} from '@hesprs/sync-engine-sdk';
import type { SmartMergeTranslations } from './i18n';
import type { SmartMergeSettings } from './setting';
import { en, zh, zhTW, ru } from './i18n';
import smartMergeResolver from './resolver';
import smartMergeSetting from './setting';
import smartMergeBaseTextWrapper from './wrapper';

type SmartMergeStoreSchema = Record<`base-text-${string}`, string>;
type SmartMergeStoreMeta = Record<string, never>;

export type SmartMergeDatabase = DatabaseAsync<SmartMergeStoreSchema, SmartMergeStoreMeta>;
export type BaseTextStore = StoreAsync<string>;

export default class SmartMerge {
	private readonly cleanup: Array<() => void> = [];

	constructor(
		private readonly ctx: SelectFromContext<{
			indexedDB: SmartMergeDatabase;
			translate: Translate<SmartMergeTranslations>;
			saveSettings: () => Promise<void>;
			getNamespace: (localFs?: Fs, remoteFs?: Fs) => string;
			registerI18n: (locale: ObsidianLanguageCode, resource: TranslationResource) => void;
			registerRemoteFsWrapper: (entry: FsWrapperEntry) => () => void;
			registerConflictResolver: (id: string, entry: ConflictResolverEntry) => () => void;
			registerSetting: (entry: SettingEntry) => () => void;
		}>,
	) {
		ctx.registerI18n('en', en);
		ctx.registerI18n('zh', zh);
		ctx.registerI18n('zh-TW', zhTW);
		ctx.registerI18n('ru', ru);
	}

	readonly moduleSettings: SmartMergeSettings = {
		conflictAEnd: '</mark>',
		conflictAStart: '<mark class="conflict ours">',
		conflictBEnd: '</mark>',
		conflictBStart: '<mark class="conflict theirs">',
		deletionEnd: '</mark>',
		deletionStart: '<mark class="conflict deleted">',
	};

	readonly start = () => {
		const {
			indexedDB,
			getNamespace,
			registerConflictResolver,
			registerRemoteFsWrapper,
			registerSetting,
			saveSettings,
			translate,
		} = this.ctx;
		this.cleanup.push(
			registerRemoteFsWrapper({
				apply: (fs) =>
					smartMergeBaseTextWrapper(
						fs,
						indexedDB.getStore(`base-text-${getNamespace(undefined, fs)}`),
					),
				priority: 20_098,
			}),
			registerConflictResolver('smartMerge', {
				prettyName: () => translate('smartMerge'),
				resolver: smartMergeResolver(this.moduleSettings, indexedDB, getNamespace),
			}),
			registerSetting({
				apply: (el) =>
					smartMergeSetting(el, { saveSettings, translate }, this.moduleSettings),
				priority: 4048,
			}),
		);
	};

	readonly dispose = () => this.cleanup.splice(0).forEach((fn) => fn());
}
