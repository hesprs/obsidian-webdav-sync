import type { Translations } from '@';

const en: Translations = {
	add: 'Add',
	addRecord: 'Add record',
	addSecretHeader: 'Add secret header',
	asymmetricStorage: 'Asymmetric storage',
	asymmetricStorageDescription: (frag) => {
		frag.appendText('Use ');
		frag.createEl('a', {
			attr: {
				href: 'https://sync.consensia.cc/deep-dive/asymmetric-storage',
			},
			text: 'asymmetric storage',
		});
		frag.appendText(' to substantially accelerate syncing.');
	},
	asymmetricStorageMigration: (frag, flag) => {
		if (flag === 'enable') {
			frag.createEl('p', {
				text: '⚠️ You should be cautious about following points before enabling asymmetric storage:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: 'Remote storage will no longer mirror local hierarchical structure. All files will be uploaded flatly to the base directory with random string anchors appended.',
			});
			ol.createEl('li', {
				text: "If you need the remote to remain readable by humans, please don't enable this feature.",
			});
			ol.createEl('li', {
				text: 'After enabling, please ensure all devices have asymmetric storage enabled.',
			});
			ol.createEl('li', {
				text: 'Migration is necessary if this vault was previously uploaded without asymmetric storage.',
			});
		} else {
			frag.createEl('p', {
				text: '⚠️ You should be cautious about following points before disabling asymmetric storage:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: 'All subsequent uploads will mirror local hierarchical structure.',
			});
			ol.createEl('li', {
				text: 'Please ensure all devices have asymmetric storage disabled.',
			});
			ol.createEl('li', {
				text: 'Migration is necessary if this vault was previously uploaded with asymmetric storage enabled.',
			});
		}
	},
	awaitingConfirmation: 'Awaiting confirmation',
	backend: 'Storage backend',
	backendDescription: 'Select the cloud service to use. Backends are provided by modules.',
	bidirectional: 'Bidirectional',
	cancel: 'Cancel',
	cancelled: 'Cancelled',
	checkConnection: 'Check connection',
	checkConnectionFailed: 'Check connection failed',
	checkConnectionSuccess: 'Check connection succeeded',
	clear: 'Clear',
	clearRecords: 'Clear records',
	clearRecordsDescription:
		'Sync Engine records sync states to resolve sync operations between local and remote files. This option allows you to clear records. Warning: this action is likely to cause changes in sync decisions.',
	completed: 'Completed',
	completedNoop: 'Already synced',
	configurations: 'Configurations',
	configure: 'Configure',
	confirm: 'Confirm',
	confirmDeleteDescription:
		'Please confirm files that will be deleted, unselected tasks will be re-uploaded.',
	confirmDeleteInAutoSync: 'Confirm deletions during auto-sync',
	confirmDeleteInAutoSyncDescription:
		'Show a confirmation of local files that will be deleted during auto-triggered syncs. You can choose to delete or re-upload them.',
	confirmTasksDescription: 'Please confirm the operations below.',
	confirmTasksInSync: 'Confirm operations in manual sync',
	confirmTasksInSyncDescription:
		'Show pending operations and execute after confirmation (does not affect auto-sync).',
	conflictResolveStrategy: 'Conflict resolve strategy',
	conflictResolveStrategyDescription:
		'Select how to resolve the conflict when both remote and local have been modified since last sync. More strategies can be found in modules.',
	controls: 'Controls',
	createLocalDir: 'Create local folder',
	createRemoteDir: 'Create remote folder',
	customHeaders: 'Custom headers',
	customHeadersDescription:
		'Add custom headers to be included with each request, they can either be stored in plaintext or in Obsidian keychain.',
	delete: 'Delete',
	deleteModule: 'Delete module',
	description: 'Description',
	descriptionPlaceholder: 'This module is ...',
	development: 'Development',
	diffMatchPatch: 'Merge',
	disableModule: 'Disable module',
	disabled: 'Disabled',
	done: 'Done',
	download: 'Download',
	downloadModule: 'Download module',
	edit: 'Edit',
	editHeaders: 'Edit headers',
	editModuleInformation: 'Edit module information',
	editSources: 'Edit sources',
	enable: 'Enable',
	enableModule: 'Enable module',
	enabled: 'Enabled',
	exclusionRules: 'Exclusion rules',
	exclusionRulesDescription:
		'Files / folders matching these glob patterns will not be synced. Please remember to add file extensions (for example, .md) if you want to exclude files.',
	executing: 'Executing',
	export: 'Export',
	exportLogsDescription: 'Export plugin logs to a file in the vault.',
	exportLogsFailed: 'Failed to export logs',
	exportLogsToFile: 'Export logs to file',
	failed: 'Failed',
	failedTasksDescription: 'The following tasks failed during sync:',
	failedToDownloadModule: 'Failed to download module "{{name}}"',
	failedToFetchSource: 'Failed to fetch source from "{{url}}"',
	failedToLoadModule: 'Failed to load module "{{name}}"',
	features: 'Features',
	filterPlaceholder: 'E.g. temp.md, .trash/**/*',
	filterRules: 'Filter rules',
	headerKeyPlaceholder: 'Header key',
	headerValuePlaceholder: 'Header value',
	hide: 'Hide',
	httpInsecureWarning: 'Please avoid using insecure HTTP protocol.',
	icon: 'Icon',
	iconDescription: (frag) => {
		frag.appendText(
			'Set the icon for this module to be displayed in the module management panel, full icons can be found in ',
		);
		frag.createEl('a', {
			attr: { href: 'https://lucide.dev/icons/' },
			text: 'Lucide Icons catalog',
		});
		frag.appendText('.');
	},
	iconPlaceholder: 'Enter Lucide Icons code (e.g. puzzle)',
	idle: 'Idle',
	inclusionRules: 'Inclusion rules',
	inclusionRulesDescription:
		'Files / folders matching exclusion rules but also matching these glob patterns will still be synced.',
	installed: 'Installed',
	integrityVerification: 'Integrity verification',
	integrityVerificationDescription: (frag) => {
		frag.appendText(
			"Set whether to pin the module's binary file to a specific hash, and verify the hash each time it is loaded. ",
		);
		frag.createEl('strong', {
			text: 'It is strongly discouraged to turn off integrity verification, since it will expose you to a large attack surface.',
		});
	},
	invalidValue: 'Invalid value, reverted to original.',
	keepLocal: 'Keep local',
	keepRemote: 'Keep remote',
	latestSurvive: 'Latest survives',
	loadingModules: 'Loading modules…',
	maxFileSize: 'Max file size',
	maxFileSizeDescription:
		'Skip files exceeding this size during synchronization. This option is useful for services with storage space limitations. Alter the size limit in the field.',
	maxFileSizePlaceholder: 'Enter size limit (e.g. 10MB, 0.5GB)',
	maxMemoryConsumption: 'Max memory consumption',
	maxMemoryConsumptionDescription:
		'Limit the amount of memory used during synchronization. This option is useful for devices with memory limitations. Alter the memory limit in the field.',
	maxMemoryConsumptionPlaceholder: 'Enter memory limit (e.g. 1GB, 200MB)',
	maxRequestConcurrency: 'Max request concurrency',
	maxRequestConcurrencyDescription:
		'Limit the number of simultaneous requests during synchronization. This option is useful for services with request rate limits. Alter the concurrency limit in the field.',
	maxRequestConcurrencyPlaceholder: 'Enter concurrency limit',
	migrationDescription:
		'Migration may take seconds to minutes depending on the vault size. If you have migrated the remote on other devices, you can skip the migration.\n\nStart migration now?',
	migrationFailed: 'Migration failed',
	migrationPhase1Description: 'Ensure local state is up-to-date',
	migrationPhase2Description: 'Clean up remote and records',
	migrationPhase3Description: 'Populate remote with new structure',
	migrationProcess: 'Migration process',
	minRequestInterval: 'Min request interval',
	minRequestIntervalDescription:
		'Limit the minimum time between consecutive requests during synchronization. This option is useful for services with request rate limits. Alter the interval in the field.',
	minRequestIntervalPlaceholder: 'Enter interval (e.g. 1s, 500ms)',
	miscellaneous: 'Miscellaneous',
	moduleAutoUpdate: 'Auto-update modules',
	moduleAutoUpdateDescription: 'Automatically update installed modules from module sources.',
	moduleManagement: 'Module management',
	moduleManagementDescription:
		'Manage modules in a dedicated panel. You can install, uninstall, update, enable, disable, edit modules, or edit module sources.',
	moduleSourcePlaceholder: 'https://example.com/modules.json',
	moveLocal: 'Move local',
	moveRemote: 'Move remote',
	name: 'Name',
	namePlaceholder: 'Enter module display name',
	noInstalledModulesFound: 'No installed modules found.',
	noMatchingModulesFound: 'No matching modules found.',
	noModulesAvailable: 'No modules available.',
	none: 'None',
	notInstalled: 'Not installed',
	noticeStatusOnMobile: 'Notice sync status on mobile',
	noticeStatusOnMobileDescription:
		'Display a notice on mobile devices when synchronization is in progress. Replaces the status bar on desktop.',
	omittedInvalidEntry: 'Omitted {{count}} invalid entry(s).',
	openPanel: 'Open panel',
	realtimeSync: 'Realtime sync',
	realtimeSyncDescription:
		'Trigger syncs automatically as soon as files are modified. Alter the delay between a file being modified and the sync being triggered in the field.',
	realtimeSyncFastMode: 'Realtime sync fast mode',
	realtimeSyncFastModeDescription:
		'Reuse cached data and avoid unnecessary remote discovery during real-time sync to accelerate sync.',
	realtimeSyncPlaceholder: 'Enter sync delay (e.g. 500ms, 5s)',
	recordsCleared: 'Records cleared',
	remoteMigration: 'Remote migration',
	remove: 'Remove',
	removeLocal: 'Remove local',
	removeRecord: 'Remove record',
	removeRemote: 'Remove remote',
	renameAndKeepBoth: 'Rename and keep both',
	resolveConflict: 'Resolve conflict',
	save: 'Save',
	scheduledSync: 'Scheduled sync',
	scheduledSyncDescription:
		'Periodically trigger synchronizations over specified intervals. Alter the interval in the field.',
	scheduledSyncPlaceholder: 'Enter interval (e.g. 10min, 0.5h)',
	searchModules: 'Search modules',
	selectAll: 'Select all',
	showInstalledOnly: 'Show installed only',
	showProgress: 'Show progress',
	skip: 'Skip',
	sourcesDescription: 'Add module source URLs. Empty and invalid rows are omitted when saved.',
	startMigration: 'Start migration',
	startNonInteractiveSync: 'Start non-interactive sync',
	startSync: 'Start sync',
	startupSync: 'Startup sync',
	startupSyncDescription:
		'Automatically trigger a sync at plugin startup after specified delay. Alter the delay in the field.',
	startupSyncPlaceholder: 'Enter delay (e.g. 5s, 1min)',
	stopSync: 'Stop sync',
	syncProgress: 'Sync progress',
	syncStrategy: 'Sync strategy',
	syncStrategyDescription:
		'Select the synchronization strategy to resolve file changes. More strategies can be found in modules.',
	toggleWithoutMigration: 'Toggle without migration',
	unknownModule: 'Unknown module',
	unknownModuleDescription: (frag, { fileName, size, path, mtime, ctime }) => {
		const p1 = frag.createEl('p');
		p1.appendText('Sync Engine detected an installed module named ');
		p1.createEl('code', { text: fileName });
		p1.appendText(
			' in its module directory. This module is neither installed in Sync Engine module panel, nor registered anywhere to be exempt from provenance validation. ',
		);
		p1.createEl('strong', { text: 'Please review following information before proceeding:' });
		const ul = frag
			.createDiv(
				'rounded-lg border border-[--background-modifier-border] bg-[--background-secondary] px-2',
			)
			.createEl('ul');
		const li1 = ul.createEl('li');
		li1.appendText('File name: ');
		li1.createEl('code', { text: fileName });
		const li2 = ul.createEl('li');
		li2.appendText('File path: ');
		li2.createEl('code', { text: path });
		const li3 = ul.createEl('li');
		li3.appendText('Size: ');
		li3.createEl('code', { text: size });
		const li4 = ul.createEl('li');
		li4.appendText('Created at: ');
		li4.createEl('code', { text: ctime });
		const li5 = ul.createEl('li');
		li5.appendText('Modified at: ');
		li5.createEl('code', { text: mtime });
		const p2 = frag.createEl('p');
		p2.createEl('strong', {
			text: 'Please avoid loading modules with unknown sources, as this could be a malicious attack.',
		});
		p2.appendText(
			' If you do not know where does it come from, directly deleting it is the best option. If you control the module and it is intentional, you can choose "Configure" and enable it.',
		);
	},
	updateAvailable: 'Update available',
	updateModule: 'Update module',
	updateSource: 'Update source',
	updateSourceDescription:
		'Set the module source from which this module receives updates. Leave empty to disable update.',
	updateSourcePlaceholder: 'https://example.com/modules.json',
	upload: 'Upload',
	walkingRemote: 'Discovering remote files',
};

export default en;
