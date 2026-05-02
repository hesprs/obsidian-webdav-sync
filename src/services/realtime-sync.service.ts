import type { TAbstractFile } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import { syncRun } from '~/events';
import { useSettings } from '~/settings';
import { SyncStartMode } from '~/sync';
import { SyncRunKind } from '~/types';
import { buildRules, needIncludeFromGlobRules } from '~/utils/glob-match';
import type SyncSchedulerService from './sync-scheduler.service';

export default class RealtimeSyncService {
	private readonly onChange = async (file: TAbstractFile, old?: string) => {
		const { fastRealtimeSync, realtimeSync, filterRules } = await useSettings();
		const exclusions = buildRules(filterRules.exclusionRules);
		const inclusions = buildRules(filterRules.inclusionRules);
		if (!realtimeSync.enabled) return;
		if (
			!needIncludeFromGlobRules(file.path, inclusions, exclusions) &&
			!(old && needIncludeFromGlobRules(old, inclusions, exclusions))
		)
			return;

		const currentRun = syncRun();
		if (currentRun?.stage === 'executing') return;

		await this.syncScheduler.requestSync({
			mode: SyncStartMode.AUTO_SYNC,
			runKind: fastRealtimeSync ? SyncRunKind.fast : SyncRunKind.normal,
			source: 'realtime',
		});
	};

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly syncScheduler: SyncSchedulerService,
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
