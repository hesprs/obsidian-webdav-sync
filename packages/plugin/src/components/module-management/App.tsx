import type { SearchResult } from 'obsidian';
import { prepareFuzzySearch } from 'obsidian';
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { AugmentedModuleMeta } from '@/modules/Extensibility';
import type { MaybePromise } from '@/types';
import type { ModuleManagementContext, ModuleManagementHooks, PendingAction } from './index';
import Card from './Card';

export default function App(props: {
	ctx: ModuleManagementContext;
	hooks: ModuleManagementHooks;
	isUnmounted: () => boolean;
}) {
	const t = props.ctx.translate;
	const [sourceModules, setSourceModules] = createSignal<Array<AugmentedModuleMeta>>([]);
	const [installedModules, setInstalledModules] = createSignal<
		Record<string, AugmentedModuleMeta>
	>({});
	const [loadedIds, setLoadedIds] = createSignal<Set<string>>(new Set());
	const [query, setQuerySignal] = createSignal('');
	const [showInstalledOnly, setShowInstalledOnlySignal] = createSignal(false);
	const [hasLoaded, setHasLoaded] = createSignal(false);
	const [isLoading, setIsLoading] = createSignal(false);
	const [pendingByName, setPendingByName] = createSignal<
		Record<string, PendingAction | undefined>
	>({});

	const syncSnapshots = () => {
		if (props.isUnmounted()) return;
		setInstalledModules(Object.fromEntries(props.ctx.discoveredModules));
		setLoadedIds(new Set(props.ctx.loadedModules.keys()));
	};

	const refreshSources = async () => {
		if (props.isUnmounted()) return;
		setIsLoading(true);
		try {
			const modules = await props.ctx.fetchSources();
			if (props.isUnmounted()) return;
			setSourceModules(modules);
			syncSnapshots();
			setHasLoaded(true);
		} finally {
			if (!props.isUnmounted()) setIsLoading(false);
		}
	};

	const mergedModules = createMemo<Array<AugmentedModuleMeta>>(() =>
		mergeModules(sourceModules(), installedModules()),
	);

	const visibleModules = createMemo<Array<AugmentedModuleMeta>>(() => {
		const normalizedQuery = query().trim();
		const filtered = mergedModules().filter((module) => {
			if (!showInstalledOnly()) return true;
			return module.id in installedModules();
		});

		if (!normalizedQuery) return filtered.sort(sortModulesAlphabetically);

		const match = prepareFuzzySearch(normalizedQuery);
		return filtered
			.map((module) => ({ module, score: getModuleScore(match, module) }))
			.filter(
				(entry): entry is { module: AugmentedModuleMeta; score: number } =>
					entry.score !== undefined,
			)
			.sort((a, b) => b.score - a.score || sortModulesAlphabetically(a.module, b.module))
			.map(({ module }) => module);
	});

	const runAction = async (id: string, action: PendingAction, op: () => MaybePromise<void>) => {
		if (props.isUnmounted()) return;
		setPendingByName((current) => ({ ...current, [id]: action }));
		try {
			await op();
			syncSnapshots();
		} finally {
			if (!props.isUnmounted())
				setPendingByName((current) => ({
					...current,
					[id]: undefined,
				}));
		}
	};

	const unsubscribeQuery = props.hooks.onQuery.subscribe((nextQuery) =>
		setQuerySignal(nextQuery),
	);
	const unsubscribeShowInstalledOnly = props.hooks.onShowInstalledOnlyChange.subscribe(
		(enabled) => setShowInstalledOnlySignal(enabled),
	);
	const unsubscribeSourcesChange = props.hooks.onSourcesChange.subscribe(() => {
		void refreshSources();
	});

	onCleanup(() => {
		unsubscribeQuery();
		unsubscribeShowInstalledOnly();
		unsubscribeSourcesChange();
	});

	onMount(() => {
		syncSnapshots();
		void refreshSources();
	});

	return (
		<div class="flex flex-col gap-3 pb-1">
			<Show
				when={visibleModules().length > 0}
				fallback={
					<div class="flex min-h-40 items-center justify-center rounded-md border border-[--background-modifier-border] px-4 py-6 text-center text-[--text-muted] bg-[--background-primary-alt]">
						{getEmptyStateText({
							hasLoaded: hasLoaded(),
							isLoading: isLoading(),
							query: query(),
							showInstalledOnly: showInstalledOnly(),
							translate: t,
						})}
					</div>
				}
			>
				<div
					class="grid gap-3"
					style={{
						'grid-template-columns': 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
					}}
				>
					<For each={visibleModules()}>
						{(module) => (
							<Card
								ctx={props.ctx}
								installedMeta={installedModules()[module.id]}
								isLoaded={loadedIds().has(module.id)}
								module={module}
								pendingAction={pendingByName()[module.id]}
								runAction={(action, op) => {
									void runAction(module.id, action, op);
								}}
							/>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}

function getEmptyStateText(ctx: {
	hasLoaded: boolean;
	isLoading: boolean;
	query: string;
	showInstalledOnly: boolean;
	translate: ModuleManagementContext['translate'];
}) {
	if (ctx.isLoading && !ctx.hasLoaded) return ctx.translate('loadingModules');
	if (ctx.query.trim()) return ctx.translate('noMatchingModulesFound');
	if (ctx.showInstalledOnly) return ctx.translate('noInstalledModulesFound');
	return ctx.translate('noModulesAvailable');
}

function getModuleScore(match: (text: string) => SearchResult | null, module: AugmentedModuleMeta) {
	const nameScore = match(module.name)?.score ?? undefined;
	const descriptionScore = module.description
		? (match(module.description)?.score ?? undefined)
		: undefined;
	if (nameScore === undefined && descriptionScore === undefined) return;
	return (nameScore ?? 0) + (descriptionScore ?? 0);
}

function mergeModules(
	sourceModules: Array<AugmentedModuleMeta>,
	installedModules: Record<string, AugmentedModuleMeta>,
): Array<AugmentedModuleMeta> {
	const merged = new Map<string, AugmentedModuleMeta>();
	for (const module of sourceModules) merged.set(module.id, module);
	for (const module of Object.values(installedModules)) merged.set(module.id, module);
	return [...merged.values()];
}

function sortModulesAlphabetically(a: AugmentedModuleMeta, b: AugmentedModuleMeta) {
	return a.name.localeCompare(b.name);
}
