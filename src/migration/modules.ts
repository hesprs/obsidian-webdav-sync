export type V3ModuleMeta = {
	id: string;
	name: string;
	version: string;
	description: string;
	main: string;
	icon?: string;
	minPluginVersion?: string;
};

export type ResolveMigrationModulesOptions = {
	catalog: Array<V3ModuleMeta>;
	encryptionEnabled: boolean;
	locale: string;
	smartMergeEnabled: boolean;
};

const REQUIRED_MODULE_IDS = ['webdav'] as const;

function normalizeLocaleCode(locale: string): string {
	const normalized = locale.trim().replaceAll('_', '-');
	if (normalized === '') return '';

	const [language, ...segments] = normalized.split('-');
	return [language.toLowerCase(), ...segments.map((segment) => segment.toUpperCase())].join('-');
}

function getLocaleCandidateIds(locale: string): Array<string> {
	const normalized = normalizeLocaleCode(locale);
	if (normalized === '' || normalized === 'en') return [];

	const [language, ...segments] = normalized.split('-');
	const candidates = new Set<string>([normalized]);
	if (segments.length > 0) candidates.add(language);
	return [...candidates];
}

function getRequiredModule(catalog: Map<string, V3ModuleMeta>, id: string): V3ModuleMeta {
	const moduleMeta = catalog.get(id.normalize('NFC'));
	if (!moduleMeta) throw new Error(`Required module not found: ${id}`);
	return moduleMeta;
}

export function resolveMigrationModules({
	catalog,
	encryptionEnabled,
	locale,
	smartMergeEnabled,
}: ResolveMigrationModulesOptions): Array<V3ModuleMeta> {
	const catalogById = new Map<string, V3ModuleMeta>();
	for (const moduleMeta of catalog) {
		const normalizedId = moduleMeta.id.normalize('NFC');
		if (!catalogById.has(normalizedId))
			catalogById.set(normalizedId, { ...moduleMeta, id: normalizedId });
	}

	const resolvedModules: Array<V3ModuleMeta> = [];
	for (const requiredModuleId of REQUIRED_MODULE_IDS)
		resolvedModules.push(getRequiredModule(catalogById, requiredModuleId));

	if (encryptionEnabled) resolvedModules.push(getRequiredModule(catalogById, 'encryption'));
	if (smartMergeEnabled) resolvedModules.push(getRequiredModule(catalogById, 'smart-merge'));

	for (const localeCode of getLocaleCandidateIds(locale)) {
		const localeModule = catalogById.get(`i18n-${localeCode}`);
		if (localeModule) {
			resolvedModules.push(localeModule);
			break;
		}
	}

	return resolvedModules;
}
