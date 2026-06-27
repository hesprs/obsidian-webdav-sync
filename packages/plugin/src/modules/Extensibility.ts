import type { Context, Events, Translations } from '@';
import type { App } from 'obsidian';
import obsidian, { Notice } from 'obsidian';
import type { General, MaybePromise } from '@/types';
import type { Dispatch } from './EventBus';
import type { Translate } from './I18n';
import { toErrorMessage } from './Sync';

type ModuleSourceSchema = Array<{
	id: string;
	version: string;
	description: string;
	main: string;
}>;

type NameVersion = { name: string; version: string };
type LoadedModuleInstance = {
	moduleSettings: object;
	dispose?: () => void;
};

const MODULE_EXTENSION = '.js';

export default class Extensibility {
	private readonly moduleDir: string;
	private readonly modules: Record<string, string> = {}; // ID + version
	private readonly sourceCache: Record<string, ModuleSourceSchema> = {};

	declare readonly settings: {
		moduleSources: Array<string>;
		modules: Record<string, boolean>;
	};

	declare readonly i18n: { failedToLoadModule: string };

	constructor(
		private readonly ctx: {
			app: App;
			__addModule__: Context['__addModule__'];
			__getModule__: Context['__getModule__'];
			dispatch: Dispatch<Events>;
			translate: Translate<Translations>;
			allModules: Set<General>;
		},
	) {
		this.moduleDir = `${ctx.app.vault.configDir}/plugins/sync-engine/modules`;
		(window as General).syncEngineApiBridge = obsidian;
	}

	private readonly loadAllModules = async () => {
		const adapter = this.ctx.app.vault.adapter;
		if (!(await adapter.exists(this.moduleDir))) {
			await adapter.mkdir(this.moduleDir);
			return;
		}
		const operations: Array<() => MaybePromise<void>> = [];
		const executeOperations = () =>
			Promise.all(operations.splice(0).map(async (op) => await op()));
		const factory = {
			delete: (path: string) => operations.push(() => adapter.remove(path)),
			load: (name: string) => operations.push(() => this.loadModule(name)),
			rename: (source: string, target: string) =>
				operations.push(() => adapter.rename(source, target)),
		};
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
			if (!this.modules[name]) this.modules[name] = version;
			else {
				const entry = this.modules[name];
				if (compareVersions(version, entry) === 1) {
					factory.delete(this.getModulePath(name));
					this.modules[name] = version;
				} else factory.delete(this.getModulePath(name, version));
			}
		});
		await executeOperations();
		Object.keys(this.modules).forEach((name) => {
			const enabled = this.settings.modules[name];
			if (enabled === undefined) this.settings.modules[name] = false;
			else if (enabled) factory.load(name);
		});
		await executeOperations();
	};

	private readonly loadModule = async <N extends string>(name: N, start = false) => {
		const { dispatch, translate, app, __addModule__, __getModule__, allModules } = this.ctx;
		dispatch('log', `Loading module \`${name}\`.`);
		try {
			const { default: module } = await import(
				app.vault.adapter.getResourcePath(this.getModulePath(name))
			);
			__addModule__(module);
			const instance = __getModule__(module) as LoadedModuleInstance;
			const settings = this.settings as Partial<Record<N, General>>;
			const existingSettings = settings[name];
			if (existingSettings) {
				Object.assign(instance.moduleSettings, existingSettings);
				settings[name] = instance.moduleSettings;
			} else settings[name] = instance.moduleSettings;
			allModules.add(module);
			if (start && 'start' in instance && typeof instance.start === 'function')
				instance.start();
		} catch (error) {
			const message = toErrorMessage(error);
			dispatch('log', `Module \`${name}\` failed to load: ${message}`);
			new Notice(`${translate('failedToLoadModule')}: ${message}`);
		}
	};

	private readonly getModulePath = (name: string, version = this.modules[name]) =>
		`${this.moduleDir}/${name}~${version}${MODULE_EXTENSION}`;

	private readonly parseModulePath = (path: string): NameVersion => {
		const name = path.slice(this.moduleDir.length + 1, -MODULE_EXTENSION.length);
		const segments = name.split('~').map((segment) => segment.normalize('NFC'));
		return { name: segments[0], version: segments[1] };
	};

	readonly dispose = () => {
		(window as General).syncEngineApiBridge = undefined;
	};

	readonly root = {
		customModules: this.modules,
		loadAllModules: this.loadAllModules,
		loadModule: this.loadModule,
	};
}

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
