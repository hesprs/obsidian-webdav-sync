import type { SyncRunSnapshot } from '~/events';
import i18n from '~/i18n';

export function formatSyncRunType(run: Pick<SyncRunSnapshot, 'mode' | 'runKind'>): string {
	const modeLabel = run.mode === 'manual' ? i18n.t('sync.mode.manual') : i18n.t('sync.mode.auto');
	const runKindLabel = i18n.t(`sync.runKind.${run.runKind}`);

	return i18n.t('sync.typeLabel', {
		mode: modeLabel,
		runKind: runKindLabel,
	});
}
