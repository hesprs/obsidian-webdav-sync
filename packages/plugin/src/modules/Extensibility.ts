import type { Context, Events, Translations } from '@';
import type { App } from 'obsidian';
import type { Ref } from 'synthkernel';
import obsidian, { Notice, requestUrl } from 'obsidian';
import type { General, TogglableValue } from '@/types';
import { untilTrue } from '@/utils/sleep';
import type { Dispatch } from './EventBus';
import type { Translate } from './I18n';
import { toErrorMessage } from './Sync';

type ModuleMeta = {
	id: string;
	version: string;
	description: string;
	main: string; // Download link
};
type ModuleSourceSchema = Array<ModuleMeta>;

type NameVersion = { name: string; version: string };
type ModuleInstance = {
	moduleSettings: object;
	dispose?: () => void;
	start?: () => void;
};
type ModuleCtor = new (ctx: object) => ModuleInstance;

const MODULE_EXTENSION = '.js';

export default class Extensibility {
	private readonly moduleDir: string;
	private readonly sourceCache = new Map<string, ModuleSourceSchema>(); // URL -> content
	private readonly discoveredModules = new Map<string, string>(); // ID -> version
	private readonly loadedModules = new Map<string, ModuleCtor>(); // ID -> ctor
	private autoUpdateTimeout?: number;

	declare readonly settings: {
		moduleSources: Array<string>;
		modules: Record<string, boolean>;
		moduleAutoUpdate: TogglableValue;
	};
	declare readonly i18n: {
		failedToLoadModule: string;
		failedToDownloadModule: string;
		failedToFetchSource: string;
	};
	declare readonly events: {
		moduleUpdateStarted: number;
		moduleUpdateTerminated: undefined;
	};

	constructor(
		private readonly ctx: {
			app: App;
			__addModule__: Context['__addModule__'];
			__getModule__: Context['__getModule__'];
			dispatch: Dispatch<Events>;
			translate: Translate<Translations>;
			allModules: Set<General>;
			isIdle: Ref<boolean>;
		},
	) {
		this.moduleDir = `${ctx.app.vault.configDir}/plugins/sync-engine/modules`;
		(window as General).syncEngineApiBridge = obsidian;
	}

	readonly start = () => {
		const { enabled, value } = this.settings.moduleAutoUpdate;
		if (!enabled) return;
		this.autoUpdateTimeout = window.setTimeout(this.updateModules, value);
	};

	private readonly createOperationFactory = () => {
		const operations: Array<() => Promise<void>> = [];
		const execute = () => Promise.all(operations.splice(0).map(async (op) => await op()));
		const { adapter } = this.ctx.app.vault;
		const factory = {
			delete: (path: string) => operations.push(() => adapter.remove(path)),
			download: (name: string, version: string, url: string) =>
				operations.push(() => this.downloadModule(name, version, url)),
			load: (name: string) => operations.push(() => this.loadModule(name)),
			rename: (source: string, target: string) =>
				operations.push(() => adapter.rename(source, target)),
		};
		return { execute, factory, operations };
	};

	private readonly loadAllModules = async () => {
		const { adapter } = this.ctx.app.vault;
		if (!(await adapter.exists(this.moduleDir))) {
			await adapter.mkdir(this.moduleDir);
			return;
		}
		const { factory, execute } = this.createOperationFactory();
		const { files, folders } = await adapter.list(this.moduleDir);
		folders.forEach((path) => factory.delete(path));
		const foundModules: Array<NameVersion> = [];
		files.forEach((path) => {
			if (!path.includes(MODULE_EXTENSION)) factory.delete(path);
			else if (!path.includes('~')) {
				const versionedPath = `${path.slice(0, -MODULE_EXTENSION.length)}~0.0.1${MODULE_EXTENSION}`;
				factory.rename(path, versionedPath);
				foundModules.push(this.parseModulePath(versionedPath));
			} else foundModules.push(this.parseModulePath(path));
		});
		foundModules.forEach(({ name, version }) => {
			const existingVersion = this.discoveredModules.get(name);
			if (!existingVersion) this.discoveredModules.set(name, version);
			else if (compareVersions(version, existingVersion) === 1) {
				factory.delete(this.getModulePath(name));
				this.discoveredModules.set(name, version);
			} else factory.delete(this.getModulePath(name, version));
		});
		await execute();
		this.discoveredModules.keys().forEach((name) => {
			const enabled = this.settings.modules[name];
			if (enabled === undefined) this.settings.modules[name] = false;
			else if (enabled) factory.load(name);
		});
		await execute();
	};

	private readonly loadModule = async <N extends string>(name: N, start = false) => {
		if (this.loadedModules.get(name)) return;
		const { dispatch, translate, app, __addModule__, __getModule__, allModules } = this.ctx;
		dispatch('log', `Loading module \`${name}\`.`);
		try {
			const { default: ctor } = await import(
				app.vault.adapter.getResourcePath(this.getModulePath(name))
			);
			__addModule__(ctor);
			const instance: ModuleInstance = __getModule__(ctor);
			const settings = this.settings as Partial<Record<N, General>>;
			const existingSettings = settings[name];
			if (existingSettings) {
				Object.assign(instance.moduleSettings, existingSettings);
				settings[name] = instance.moduleSettings;
			} else settings[name] = instance.moduleSettings;
			if (start) instance.start?.();
			allModules.add(ctor);
			this.loadedModules.set(name, ctor);
		} catch (error) {
			const message = toErrorMessage(error);
			dispatch('error', `Module \`${name}\` failed to load: ${message}`);
			new Notice(`${translate('failedToLoadModule', { name })}: ${message}`);
		}
	};

	private readonly unloadModule = (name: string) => {
		const ctor = this.loadedModules.get(name);
		if (!ctor) return;
		const { __getModule__, dispatch, allModules } = this.ctx;
		dispatch('log', `Unloading module \`${name}\`.`);
		const instance: ModuleInstance = __getModule__(ctor as General);
		instance.dispose?.();
		this.loadedModules.delete(name);
		allModules.delete(ctor);
	};

	private readonly downloadModule = async (name: string, version: string, url: string) => {
		const { dispatch, translate, app } = this.ctx;
		try {
			const legacyVersion = this.discoveredModules.get(name);
			if (legacyVersion === version) return;
			dispatch('log', `Downloading module \`${name}\` of version \`${version}\`.`);
			const { adapter } = app.vault;
			const { arrayBuffer: module } = await requestUrl(url);
			const isRunning = this.loadedModules.has(name);
			if (isRunning) this.unloadModule(name);
			await Promise.all([
				legacyVersion ? adapter.remove(this.getModulePath(name)) : Promise.resolve(),
				adapter.writeBinary(this.getModulePath(name, version), module),
			]);
			this.discoveredModules.set(name, version);
			if (isRunning || this.settings.modules[name]) await this.loadModule(name, true);
		} catch (error) {
			const message = toErrorMessage(error);
			dispatch('error', `Failed to download module \`${name}\`: ${message}`);
			new Notice(`${translate('failedToDownloadModule', { name })}: ${message}`);
		}
	};

	private readonly deleteModule = async (name: string) => {
		const version = this.discoveredModules.get(name);
		if (!version) return;
		this.unloadModule(name);
		await this.ctx.app.vault.adapter.remove(this.getModulePath(name));
		this.discoveredModules.delete(name);
		delete this.settings.modules[name];
	};

	private readonly fetchSources = async (cached = true) => {
		const { dispatch, translate } = this.ctx;
		const { moduleSources } = this.settings;
		const contents = (
			await Promise.all(
				moduleSources.map(async (url) => {
					if (cached) {
						const cachedContent = this.sourceCache.get(url);
						if (cachedContent) return cachedContent;
					}
					try {
						const content = await requestUrl(url).json;
						if (isValidSource(content)) {
							content.forEach((meta) => (meta.id = meta.id.normalize('NFC')));
							this.sourceCache.set(url, content);
							return content;
						}
						throw new Error('Wrong source schema!');
					} catch (error) {
						const message = toErrorMessage(error);
						dispatch('error', `Failed to fetch source from \`${url}\`: ${message}`);
						new Notice(`${translate('failedToFetchSource', { url })}: ${message}`);
						return [];
					}
				}),
			)
		).flat();
		const modules = new Map<string, ModuleMeta>();
		contents.forEach((meta) => {
			const { id, version } = meta;
			const existingModule = modules.get(id);
			if (existingModule && compareVersions(existingModule.version, version) === 1) return;
			modules.set(id, meta);
		});
		const moduleList = [...modules.values()];
		dispatch(
			'log',
			`Discovered ${moduleList.length} module(s) from ${moduleSources.length} source(s).`,
		);
		return moduleList;
	};

	private readonly updateModules = async () => {
		const { execute, factory, operations } = this.createOperationFactory();
		const { dispatch, isIdle } = this.ctx;
		(await this.fetchSources()).forEach(({ id, version, main }) => {
			const existingVersion = this.discoveredModules.get(id);
			if (!existingVersion) return;
			if (compareVersions(version, existingVersion) === 1)
				factory.download(id, version, main);
		});
		if (!operations.length) return;
		await untilTrue(isIdle);
		dispatch('moduleUpdateStarted', operations.length);
		await execute();
		dispatch('moduleUpdateTerminated');
	};

	private readonly getModulePath = (name: string, version = this.discoveredModules.get(name)) =>
		`${this.moduleDir}/${name}~${version}${MODULE_EXTENSION}`;

	private readonly parseModulePath = (path: string): NameVersion => {
		const name = path.slice(this.moduleDir.length + 1, -MODULE_EXTENSION.length);
		const segments = name.split('~').map((segment) => segment.normalize('NFC'));
		return { name: segments[0], version: segments[1] };
	};

	readonly dispose = () => {
		window.clearTimeout(this.autoUpdateTimeout);
		(window as General).syncEngineApiBridge = undefined;
		this.loadedModules.clear();
	};

	readonly root = {
		deleteModule: this.deleteModule,
		discoveredModules: this.discoveredModules,
		downloadModule: this.downloadModule,
		fetchSources: this.fetchSources,
		loadAllModules: this.loadAllModules,
		loadModule: this.loadModule,
		loadedModules: this.loadedModules,
		unloadModule: this.unloadModule,
		updateModules: this.updateModules,
	};
}

// 1 = a > b
function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const va = pa[i] ?? 0;
		const vb = pb[i] ?? 0;
		if (va > vb) return 1;
		if (va < vb) return -1;
	}
	return 0;
}

function isValidSource(d: unknown): d is ModuleSourceSchema {
	return (
		Array.isArray(d) &&
		d.every(
			(i) =>
				i &&
				['id', 'version', 'description', 'main'].every((k) => typeof i[k] === 'string'),
		)
	);
}
