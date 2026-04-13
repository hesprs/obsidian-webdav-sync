import type { TAbstractFile } from 'obsidian';
import WebDAVSyncPlugin from '~';
import { syncRun } from '~/events';
import { useSettings } from '~/settings';
import { SyncStartMode } from '~/sync';
import { SyncRunKind } from '~/types';
import { buildRules, needIncludeFromGlobRules } from '~/utils/glob-match';
import type SyncSchedulerService from './sync-scheduler.service';

export default class RealtimeSyncService {
	private onChange = async (file: TAbstractFile, old?: string) => {
		const { useFastSyncOnLocalChange, realtimeSync, filterRules } = await useSettings();
		const exclusions = buildRules(filterRules.exclusionRules);
		const inclusions = buildRules(filterRules.inclusionRules);
		if (!realtimeSync) return;
		if (
			!needIncludeFromGlobRules(file.path, inclusions, exclusions) &&
			!(old && needIncludeFromGlobRules(old, inclusions, exclusions))
		)
			return;

		const currentRun = syncRun();
		if (currentRun?.stage === 'executing') return;

		await this.syncScheduler.requestSync({
			mode: SyncStartMode.AUTO_SYNC,
			runKind: useFastSyncOnLocalChange ? SyncRunKind.fast : SyncRunKind.normal,
			source: 'realtime',
		});
	};

	constructor(
		private plugin: WebDAVSyncPlugin,
		private syncScheduler: SyncSchedulerService,
	) {
		this.plugin.registerEvent(this.vault.on('create', this.onChange));
		this.plugin.registerEvent(this.vault.on('delete', this.onChange));
		this.plugin.registerEvent(this.vault.on('modify', this.onChange));
		this.plugin.registerEvent(this.vault.on('rename', this.onChange));
	}

	get vault() {
		return this.plugin.app.vault;
	}
}
