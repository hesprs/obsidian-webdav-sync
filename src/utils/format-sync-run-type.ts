import type { SyncRunSnapshot } from '~/events';
import i18n from '~/i18n';
import { SyncRunKind } from '~/model/sync-record.model';

export function formatSyncRunType(run: Pick<SyncRunSnapshot, 'mode' | 'runKind'>): string {
	const modeLabel = run.mode === 'manual' ? i18n.t('sync.mode.manual') : i18n.t('sync.mode.auto');
	const runKindLabel =
		run.runKind === SyncRunKind.NUMB
			? i18n.t('sync.runKind.numb')
			: i18n.t('sync.runKind.normal');

	return i18n.t('sync.typeLabel', {
		mode: modeLabel,
		runKind: runKindLabel,
	});
}
