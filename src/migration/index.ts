import type WebDAVSyncPlugin from '~';
import { getLanguage } from 'obsidian';
import V3MigrationModal from '~/components/V3MigrationModal';
import t from '~/i18n';
import { SyncRunKind } from '~/types';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import requestUrl from '~/utils/request-url';
import v3Exists from '~/utils/v3-exists';
import type { V3ModuleMeta } from './modules';
import { resolveMigrationModules } from './modules';
import { getRemoteUidStat } from './remote-stat';
import { buildV3PluginData } from './settings';
import {
	buildV3Namespace,
	cleanupCurrentNamespaceStorage,
	migrateCurrentNamespaceStorage,
	toV3UnifiedKey,
} from './storage';

export type V3MigrationProgressStep =
	| 'prepSync'
	| 'fetchCatalog'
	| 'resolveModules'
	| 'downloadModules'
	| 'writePluginData'
	| 'migrateStorage'
	| 'cleanupSource'
	| 'completed';

export type V3MigrationResult =
	| { ok: true; encryptionEnabled: boolean }
	| { ok: false; error: Error; rolledBack: boolean };

export type V3MigrationProgress = {
	step: V3MigrationProgressStep;
	completed: number;
	total: number;
	detail?: string;
};

const MODULE_CATALOG_URL = 'https://sync.consensia.cc/modules.json';
const TARGET_PLUGIN_DIR = 'plugins/sync-engine';
const TARGET_MODULES_DIR = `${TARGET_PLUGIN_DIR}/modules`;
const TARGET_DATA_PATH = `${TARGET_PLUGIN_DIR}/data.json`;
const TARGET_DATABASE_NAME = 'sync-engine';
const MIGRATION_PROGRESS_TOTAL = 8;
const SMART_MERGE_CONFLICT_STRATEGY =
	'diffMatchPatch' as WebDAVSyncPlugin['settings']['conflictStrategy'];

function normalizeError(error: unknown): Error {
	if (error instanceof Error) return error;
	return new Error(String(error));
}

async function deleteIndexedDatabase(name: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		request.addEventListener('error', () => {
			reject(request.error ?? new Error(`Failed to delete database: ${name}`));
		});
		request.addEventListener('blocked', () =>
			reject(new Error(`Failed to delete database: ${name}`)),
		);
		request.addEventListener('success', () => resolve());
	});
}

async function ensureDirectory(adapter: WebDAVSyncPlugin['app']['vault']['adapter'], path: string) {
	if (path === '' || path === '.') return;
	const segments = path.split('/');
	let current = '';
	for (const segment of segments) {
		if (segment === '') continue;
		current = current === '' ? segment : `${current}/${segment}`;
		if (!(await adapter.exists(current))) await adapter.mkdir(current);
	}
}

async function rollbackTargetArtifacts(
	plugin: WebDAVSyncPlugin,
	deleteTargetDatabase: boolean,
): Promise<boolean> {
	const adapter = plugin.app.vault.adapter;
	const targetPluginPath = `${plugin.app.vault.configDir}/${TARGET_PLUGIN_DIR}`;

	try {
		if (await adapter.exists(targetPluginPath)) await adapter.rmdir(targetPluginPath, true);
		if (deleteTargetDatabase) await deleteIndexedDatabase(TARGET_DATABASE_NAME);
		return true;
	} catch {
		return false;
	}
}

async function fetchModuleCatalog(): Promise<Array<V3ModuleMeta>> {
	const response = await requestUrl(MODULE_CATALOG_URL);
	let payload: unknown;
	try {
		payload = JSON.parse(response.text);
	} catch {
		throw new Error('Failed to parse module catalog.');
	}

	if (!Array.isArray(payload)) throw new Error('Invalid module catalog.');

	return payload.map((entry): V3ModuleMeta => {
		if (!entry || typeof entry !== 'object') throw new Error('Invalid module catalog entry.');
		const { description, main, name, version } = entry as Record<string, unknown>;
		if (
			typeof name !== 'string' ||
			typeof version !== 'string' ||
			typeof description !== 'string' ||
			typeof main !== 'string'
		)
			throw new Error('Invalid module catalog entry.');
		return { description, main, name, version };
	});
}

export default class V3MigrationService {
	private startupTimeout?: number;
	private disposed = false;
	private modal?: V3MigrationModal;

	constructor(private readonly plugin: WebDAVSyncPlugin) {}

	checkAndPromptOnStartup(): void {
		if (this.plugin.settings.v3Exists) {
			if (!this.plugin.settings.neverShowV3Migration) this.openMigrationModal('startup');
			return;
		}

		this.startupTimeout = window.setTimeout(() => {
			void this.runStartupDetection().catch(() => undefined);
		}, 10_000);
	}

	dispose(): void {
		this.disposed = true;
		if (this.startupTimeout !== undefined) {
			window.clearTimeout(this.startupTimeout);
			this.startupTimeout = undefined;
		}
		this.modal?.close();
	}

	openMigrationModal(source: 'startup' | 'development'): void {
		void source;
		this.modal ??= new V3MigrationModal(this.plugin, {
			onDontShowAgain: async () => {
				this.plugin.settings.neverShowV3Migration = true;
				await this.plugin.saveSettings();
			},
			onProceed: async (onProgress) => await this.runMigration(onProgress),
		});
		this.modal.renderPrompt();
		if (!this.modal.containerEl.isConnected) this.modal.open();
	}

	async runMigration(
		onProgress: (progress: V3MigrationProgress) => void,
	): Promise<V3MigrationResult> {
		if (this.plugin.isSyncing)
			return {
				error: new Error('Migration cannot start while sync is running.'),
				ok: false,
				rolledBack: false,
			};
		if (this.plugin.isV3MigrationRunning)
			return {
				error: new Error('Migration is already running.'),
				ok: false,
				rolledBack: false,
			};

		const sourceNamespace = getSyncStateKey({
			account: this.plugin.settings.account,
			remoteBaseDir: this.plugin.settings.remoteDir,
			serverUrl: this.plugin.settings.serverUrl,
			vaultName: this.plugin.app.vault.getName(),
		});
		const encryptionEnabled = this.plugin.settings.encryption.enabled;

		onProgress({
			completed: 0,
			detail: t('settings.v3Migration.steps.prepSync'),
			step: 'prepSync',
			total: MIGRATION_PROGRESS_TOTAL,
		});

		const syncResult = await this.plugin.syncSchedulerService.requestSync({
			runKind: SyncRunKind.normal,
			source: 'migration',
		});

		if (!syncResult.executed || !syncResult.run)
			return {
				error: new Error('Prerequisite sync did not complete.'),
				ok: false,
				rolledBack: false,
			};
		if (syncResult.run.stage === 'failed' || syncResult.run.stage === 'cancelled')
			return { error: new Error('Prerequisite sync failed.'), ok: false, rolledBack: false };

		this.plugin.isV3MigrationRunning = true;
		try {
			onProgress({
				completed: 1,
				detail: t('settings.v3Migration.steps.fetchCatalog'),
				step: 'fetchCatalog',
				total: MIGRATION_PROGRESS_TOTAL,
			});

			const catalog = await fetchModuleCatalog();

			onProgress({
				completed: 2,
				detail: t('settings.v3Migration.steps.resolveModules'),
				step: 'resolveModules',
				total: MIGRATION_PROGRESS_TOTAL,
			});

			const resolvedModules = resolveMigrationModules({
				catalog,
				encryptionEnabled,
				locale: getLanguage(),
				smartMergeEnabled:
					this.plugin.settings.conflictStrategy === SMART_MERGE_CONFLICT_STRATEGY,
			});
			const localeModuleNames = resolvedModules
				.filter((module) => module.name.startsWith('I18n '))
				.map((module) => module.name);

			onProgress({
				completed: 3,
				detail: t('settings.v3Migration.steps.downloadModules'),
				step: 'downloadModules',
				total: MIGRATION_PROGRESS_TOTAL,
			});

			const adapter = this.plugin.app.vault.adapter;
			const configDir = this.plugin.app.vault.configDir;
			await ensureDirectory(adapter, `${configDir}/${TARGET_MODULES_DIR}`);

			for (let index = 0; index < resolvedModules.length; index++) {
				const moduleMeta = resolvedModules[index];
				const moduleResponse = await requestUrl(moduleMeta.main);
				await adapter.write(
					`${configDir}/${TARGET_MODULES_DIR}/${moduleMeta.name}~${moduleMeta.version}.js`,
					moduleResponse.text,
				);
				onProgress({
					completed: Math.round((3 + (index + 1) / resolvedModules.length) * 100) / 100,
					detail: t('settings.v3Migration.steps.downloadModule', {
						name: moduleMeta.name,
					}),
					step: 'downloadModules',
					total: MIGRATION_PROGRESS_TOTAL,
				});
			}

			onProgress({
				completed: 4,
				detail: t('settings.v3Migration.steps.writePluginData'),
				step: 'writePluginData',
				total: MIGRATION_PROGRESS_TOTAL,
			});

			const pluginData = buildV3PluginData({
				locale: getLanguage(),
				localeModuleNames,
				settings: this.plugin.settings,
			});
			await ensureDirectory(adapter, `${configDir}/${TARGET_PLUGIN_DIR}`);
			await adapter.write(
				`${configDir}/${TARGET_DATA_PATH}`,
				JSON.stringify(pluginData, undefined, 2),
			);

			const migrationPhase: { current: 'targetWrite' | 'sourceCleanup' } = {
				current: 'targetWrite',
			};
			const beforeSourceCleanup = async () => {
				const previousNeverShow = this.plugin.settings.neverShowV3Migration;
				this.plugin.settings.neverShowV3Migration = true;
				try {
					await this.plugin.saveSettings();
					migrationPhase.current = 'sourceCleanup';
				} catch (error) {
					this.plugin.settings.neverShowV3Migration = previousNeverShow;
					throw error;
				}
			};
			try {
				if (encryptionEnabled) {
					onProgress({
						completed: 7,
						detail: t('settings.v3Migration.steps.cleanupSource'),
						step: 'cleanupSource',
						total: MIGRATION_PROGRESS_TOTAL,
					});
					await cleanupCurrentNamespaceStorage({ beforeSourceCleanup, sourceNamespace });
				} else {
					onProgress({
						completed: 5,
						detail: t('settings.v3Migration.steps.migrateStorage'),
						step: 'migrateStorage',
						total: MIGRATION_PROGRESS_TOTAL,
					});
					await migrateCurrentNamespaceStorage({
						beforeSourceCleanup,
						resolveRemoteUid: async (path) => {
							const stat = await getRemoteUidStat(this.plugin, path);
							if (stat.isDir) return '';
							return stat.etag ?? `${stat.mtime ?? 0}~${stat.size ?? 0}`;
						},
						sourceNamespace,
						targetNamespace: buildV3Namespace({
							baseDirectory: this.plugin.settings.remoteDir,
							endpoint: this.plugin.settings.serverUrl,
							username: this.plugin.settings.account,
							vaultName: this.plugin.app.vault.getName(),
						}),
						toV3Key: toV3UnifiedKey,
					});
				}
			} catch (error) {
				if (migrationPhase.current === 'sourceCleanup')
					return { error: normalizeError(error), ok: false, rolledBack: false };

				const rolledBack = await rollbackTargetArtifacts(this.plugin, !encryptionEnabled);
				return { error: normalizeError(error), ok: false, rolledBack };
			}

			if (!encryptionEnabled)
				onProgress({
					completed: 7,
					detail: t('settings.v3Migration.steps.cleanupSource'),
					step: 'cleanupSource',
					total: MIGRATION_PROGRESS_TOTAL,
				});

			onProgress({
				completed: 8,
				detail: t('settings.v3Migration.steps.completed'),
				step: 'completed',
				total: MIGRATION_PROGRESS_TOTAL,
			});

			return {
				encryptionEnabled,
				ok: true,
			};
		} catch (error) {
			const rolledBack = await rollbackTargetArtifacts(this.plugin, !encryptionEnabled);
			return { error: normalizeError(error), ok: false, rolledBack };
		} finally {
			this.plugin.isV3MigrationRunning = false;
		}
	}

	private async runStartupDetection(): Promise<void> {
		if (this.disposed || this.plugin.settings.v3Exists) return;
		try {
			if (!(await v3Exists()) || this.disposed) return;
			this.plugin.settings.v3Exists = true;
			await this.plugin.saveSettings();
			if (!this.plugin.settings.neverShowV3Migration && !this.disposed)
				this.openMigrationModal('startup');
		} finally {
			this.startupTimeout = undefined;
		}
	}
}
