const en = {
	deleteConfirm: {
		deleteAndReupload: 'Delete selected, re-upload unchecked',
		filePath: 'File path',
		instruction:
			'⚠️ The following local files will be deleted during auto-sync (because they were deleted remotely).\n\nCheck files to delete; unchecked files will be re-uploaded:',
		select: 'Select',
		skipForNow: 'Skip for now',
		title: 'Confirm local file deletion',
		warningNotice: 'Local files will be deleted, please confirm',
	},
	dirSelector: {
		cancel: 'Cancel',
		confirm: 'Confirm',
		currentPath: 'Current path: {{path}}',
		goBack: 'Go back',
		newFolder: 'New folder',
	},
	errors: {
		filenameUnsupportedChars: 'File {{path}} contains unsupported characters: {{chars}}',
	},
	settings: {
		account: {
			desc: 'Enter your WebDAV account',
			name: 'Account',
			placeholder: 'Enter your account',
		},
		checkConnection: {
			desc: 'Click to check WebDAV connection',
			failure: 'WebDAV connection failed',
			failureButton: 'Failed ×',
			failureWithReason: 'WebDAV connection failed: {{reason}}',
			name: 'Check connection',
			success: 'WebDAV connection successful',
			successButton: 'Connected ✓',
		},
		clearRecords: {
			allButton: 'Clear all records',
			allCleared: 'All records cleared',
			desc: 'WebDAV sync records sync states to resolve sync operations between local and remote files. This option allows you to selectively clear records. Warning: this action is likely to cause data loss.',
			name: 'Clear records',
			vaultButton: 'Clear vault records',
			vaultCleared: 'Vault records cleared',
		},
		confirmBeforeDeleteInAutoSync: {
			desc: 'Show a confirmation dialog when local files are about to be deleted during auto-sync, allowing you to choose to delete or re-upload them.',
			name: 'Confirm before deleting files during auto-sync',
		},
		confirmBeforeSync: {
			desc: 'Show pending tasks and execute after confirmation (does not affect auto-sync)',
			name: 'Confirm before manual sync execution',
		},
		conflictStrategy: {
			desc: 'Choose how to resolve file conflicts. \nNote: we recommend backing up important files before using auto-merge to prevent data loss.',
			diffMatchPatch: 'Smart merge',
			keepLocal: 'Keep local version',
			keepRemote: 'Keep remote version',
			latestTimestamp: 'Use latest version',
			name: 'Conflict resolution strategy',
			skip: 'Skip conflicts',
		},
		credential: {
			desc: 'Enter your WebDAV credential',
			name: 'Credential',
			placeholder: 'Enter your credential',
		},
		customHeaders: {
			desc: 'Optional. One per line, as "Header-Name: value". Sent on every WebDAV request.',
			name: 'Custom headers',
			placeholder: 'X-Api-Key: abc123',
		},
		encryption: {
			desc: 'Encrypt files before upload and decrypt files when download. Encryption password will be stored in Obsidian keychain.',
			name: 'Encryption',
			reminderModal: {
				acknowledge: 'I understand',
				messageDisabled:
					'⚠️ You should be cautious about following points before disabling encryption:\n\n1. All subsequent uploads will be in plaintext without encryption.\n2. Please ensure all devices have encryption disabled.\n3. If this vault was previously uploaded with encryption, delete the remote base directory entirely including the root folder, and re-upload the vault.',
				messageEnabled:
					"⚠️ You should be cautious about following points before enabling encryption:\n\n1. All subsequent uploads will be encrypted.\n\n2. If this vault was previously uploaded without encryption, delete the remote directory entirely including the root folder, and re-upload the entire vault.\n\n3. You should ensure all the four items are identical on all your devices:\n    • encryption password\n    • server URL\n    • account name\n    • remote directory\n\n4. The encryption algorithm binds the decryption key to the file location and server identity, this provides much better security and data integrity. But it also means that if you use a different server or moving a file to a different location without using this plugin, you won't be able to decrypt it.\n\n5. Please avoid managing files manually on the server. If you change a server later, please re-upload the vault with encryption enabled.\n\n6. Due to the encryption, the sync process will take slightly longer to complete.",
				titleDisabled: 'Encryption disabled',
				titleEnabled: 'Encryption enabled',
			},
		},
		exhaustiveRemoteTraversal: {
			desc: 'Traverse the entire remote directory tree within one WebDAV request, including all subdirectories. This could drastically reduce traversal time for large directories, but may have compatibility issues with some WebDAV servers. (This is to send "Depth: infinity" in PROPFIND request)',
			name: 'Exhaustive remote traversal',
		},
		fastRealtimeSync: {
			desc: "Assume remote content doesn't change during a fast sync to reuse cached data and avoid unnecessary requests. This can improve sync performance but ignores remote changes. Recommend to use with startup sync periodic sync",
			name: 'Fast mode for real-time sync',
		},
		filters: {
			add: 'Add rule',
			cancel: 'Cancel',
			confirmRemove: 'Confirm remove',
			desc: 'Add paths to filter files or folders',
			description:
				'Files or folders matching these patterns will be ignored during sync. Use * for wildcard matching.',
			edit: 'Edit rules',
			exclude: {
				desc: 'Files/folders matching these glob patterns will not be synced. Please remember to add file extensions (for example, .md) if you want to exclude files.',
				name: 'Exclusion rules',
			},
			include: {
				desc: 'Files/folders matching these glob patterns will be synced (if defined). Please remember to add file extensions (for example, .md) if you want to include files.',
				name: 'Inclusion rules',
			},
			name: 'Sync filters',
			placeholder: 'E.g.: .DS_Store, *.pdf',
			remove: 'Remove',
			save: 'Save',
		},
		invalidValue: 'Invalid value, reset to the previous value',
		log: {
			button: 'View logs',
			desc: 'Export a readable support report grouped by sync run',
			name: 'Support report',
			saveError: 'Failed to save support report',
			saveToNote: 'Export to note',
			savedToNote: 'Support report saved to note: {{fileName}}',
		},
		maxSyncTaskConcurrency: {
			desc: 'Sync tasks are atomic sync operations, such as download a file or remove a directory. This setting limits the maximum number of tasks to be executed concurrently, which is useful to reduce CPU and disk usage. Alter the limit in the field.',
			name: 'Max concurrent sync tasks',
			placeholder: 'Enter number',
		},
		maxThroughputConcurrency: {
			desc: 'Limit the maximum total size of files that are uploaded or downloaded concurrently. This option is useful to control memory usage and prevent crashes. Alter the size in the field.',
			name: 'Max concurrent throughput',
			placeholder: 'Enter file size (e.g. 100MB, 0.5GB)',
		},
		maxWebDAVConcurrency: {
			desc: 'Limit the maximum number of concurrent WebDAV requests. This option is useful for services with rate limits. Alter the maximum concurrency allowed in the field.',
			name: 'Max concurrent WebDAV requests',
			placeholder: 'Enter number',
		},
		minWebDAVRequestInterval: {
			desc: 'Limit the minimum time between WebDAV requests. This option is useful for services with rate limits. Alter the interval in the field.',
			name: 'Min time between WebDAV requests',
			placeholder: 'Enter interval (e.g. 1s, 300ms)',
		},
		realtimeSync: {
			desc: 'Trigger syncs automatically as soon as files are modified. Alter the delay between a file being modified and the sync being triggered in the field.',
			name: 'Real-time sync',
			placeholder: 'Sync delay (e.g. 1s, 500ms)',
		},
		remoteDir: {
			desc: 'Enter the remote directory',
			edit: 'Edit',
			name: 'Remote directory',
			placeholder: 'Enter the remote directory',
		},
		scheduledSync: {
			desc: 'Periodically trigger background synchronization. Set the interval for periodic background sync in the field.',
			name: 'Scheduled sync',
			placeholder: 'Enter delay (e.g. 10min, 0.5h)',
		},
		sections: {
			common: 'General',
			control: 'Limits & controls',
			development: 'Development settings',
			filters: 'Filter rules',
		},
		serverUrl: {
			desc: 'Base URL of your WebDAV service.',
			name: 'WebDAV server URL',
			placeholder: 'https://example.com/webdav',
		},
		showSyncStatusInNotificationOnMobile: {
			desc: 'Keep a mobile notice visible during sync and hide it two seconds after sync ends',
			name: 'Show sync status in mobile notification',
		},
		skipLargeFiles: {
			desc: 'Skip files exceeding this size during synchronization. This option is useful for services with storage space limitations. Alter the size limit in the field.',
			name: 'Skip large files',
			placeholder: 'Enter size limit (e.g. 10MB, 0.5GB)',
		},
		startupSync: {
			desc: 'Automatically trigger a sync after startup. Set the delay after startup to automatically perform a sync in the field.',
			name: 'Startup sync',
			placeholder: 'Enter delay (e.g. 10s, 1min)',
		},
		tips: {
			desc: '⚠️ Sync process will modify or delete local files. Please backup important files before syncing.',
			name: 'Tips',
		},
		unmergeableStrategy: {
			desc: 'Choose the alternative strategy for files that are not resolvable by smart merge (all non-markdown files).',
			name: 'Unmergeable conflict resolution strategy',
		},
		useGitStyle: {
			desc: 'Use  <<<<<<< and  >>>>>>> markers for conflicts instead of HTML tags',
			name: 'Use Git-style conflict markers',
		},
		v3Migration: {
			button: 'Migrate now',
			desc: 'WebDAV Sync v3 (renamed to Sync Engine) has been released. It is rewritten from scratch and achieves far better performance and extensibility. This option allows you to migrate your plugin settings and records from v2 to v3 with minimal friction.',
			failure: {
				body: 'Migration failed: {{error}}',
				close: 'Close',
				partialCleanup: 'Source cleanup may already have started.',
				rolledBack: 'The migration is reverted, nothing is destroyed.',
				title: 'Migration failed',
			},
			name: 'Migrate to v3',
			progress: {
				stats: '{{completed}} / {{total}}',
				step: 'Progress',
				title: 'Migrating to Sync Engine',
			},
			prompt: {
				bottom: `No vault files will be modified or deleted except in the first step. Migration is irreversible. Start migration now?`,
				cancel: 'Cancel',
				dontShowAgain: "Don't show again",
				middleEncrypted: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: 'The migration will perform the following steps:',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', {
						text: 'Launch a normal sync to ensure local has latest copy of vault files.',
					});
					ol.createEl('li', {
						text: 'Convert your settings into v3 format, and save it to Sync Engine plugin folder.',
					});
					ol.createEl('li', {
						text: 'Install necessary Sync Engine modules and save to the plugin folder to ensure consistent experience between v2 and v3.',
					});
					ol.createEl('li', {
						text: 'Clean up legacy v2 record storage for this vault.',
					});
					const p2 = frag.createEl('p');
					p2.createSpan({
						text: 'After migration, you need to uninstall WebDAV Sync plugin, install and enable ',
					});
					p2.createEl('strong', { text: 'Sync Engine' });
					p2.createSpan({
						text: ' from Obsidian plugin store. Sync Engine will automatically pick up your data and settings.',
					});
					const p3 = frag.createEl('p');
					p3.createEl('strong', {
						text: 'Note: since you enabled encryption, but the algorithm changed in v3, you need to manually delete your WebDAV base directory and re-upload your vault after installing Sync Engine.',
					});
				},
				middleNormal: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: 'The migration will perform the following steps:',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', {
						text: 'Launch a normal sync to ensure local has latest copy of vault files.',
					});
					ol.createEl('li', {
						text: 'Convert your settings into v3 format, and save it to Sync Engine plugin folder.',
					});
					ol.createEl('li', {
						text: 'Install necessary Sync Engine modules and save to the plugin folder to ensure consistent experience between v2 and v3.',
					});
					ol.createEl('li', {
						text: 'Perform a read-only WebDAV scan to gather necessary information and save to v3 record storage.',
					});
					ol.createEl('li', {
						text: 'Clean up legacy v2 record storage for this vault.',
					});
					const p2 = frag.createEl('p');
					p2.createSpan({
						text: 'After migration, you need to uninstall WebDAV Sync plugin and install and enable ',
					});
					p2.createEl('strong', { text: 'Sync Engine' });
					p2.createSpan({
						text: ' from Obsidian plugin store. Sync Engine will automatically pick up your data and settings.',
					});
				},
				proceed: 'Proceed',
				title: 'WebDAV Sync v3 is available',
				top: (frag: DocumentFragment) => {
					const p1 = frag.createEl('p');
					p1.createEl('strong', { text: 'WebDAV Sync v3' });
					p1.createSpan({ text: ' (now renamed to ' });
					p1.createEl('strong', { text: 'Sync Engine' });
					p1.createSpan({
						text: ') has been released to Obsidian plugin store. Rewritten from scratch, it now achieves far better performance and allows easy extension via modules. Access ',
					});
					p1.createEl('a', {
						attr: { href: 'https://sync.consensia.cc' },
						text: 'Sync Engine Website',
					});
					p1.createSpan({ text: ' for more about the update.' });

					frag.createEl('p', {
						text: 'Sync Engine uses a completely different setting and storage schema compared with v2. To adapt Sync Engine with minimum friction, existing users need to migrate settings and records to the new format.',
					});
				},
			},
			steps: {
				cleanupSource: 'Cleaning up WebDAV Sync data',
				completed: 'Migration completed',
				downloadModule: 'Downloading {{name}}',
				downloadModules: 'Downloading modules',
				fetchCatalog: 'Fetching module catalog',
				migrateStorage: 'Migrating storage',
				prepSync: 'Running prerequisite sync',
				resolveModules: 'Resolving required modules',
				writePluginData: 'Writing Sync Engine data',
			},
			success: {
				bodyEncrypted: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: 'Now perform the following steps:',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', {
						text: 'Uninstall WebDAV Sync.',
					});
					ol.createEl('li', {
						text: 'Go to your WebDAV file management UI, manually delete the folder that you used to store your encrypted vault files.',
					});
					const li3 = ol.createEl('li');
					li3.createSpan({ text: 'Install and enable ' });
					li3.createEl('strong', { text: 'Sync Engine' });
					li3.createSpan({ text: ' from Obsidian plugin store.' });
					ol.createEl('li', {
						text: 'Launch a fresh sync to upload your vault to the same folder, newly uploaded files will remain encrypted. (If you enabled startup sync, this sync will happen automatically)',
					});
					frag.createEl('p', {
						text: 'Migration is done after performing above four steps. If you have migrated your WebDAV files, you can skip step 2 and 4.',
					});
				},
				bodyNormal: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: 'Now perform the following steps:',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', { text: 'Uninstall WebDAV Sync.' });
					const li2 = ol.createEl('li');
					li2.createSpan({ text: 'Install and enable ' });
					li2.createEl('strong', { text: 'Sync Engine' });
					li2.createSpan({ text: ' from Obsidian plugin store.' });
					const p2 = frag.createEl('p');
					p2.createSpan({
						text: 'Migration is done after performing above two steps. Note: for seamless migration, Asymmetric Storage feature of plugin v3 is disabled. Enabling it could drastically accelerate syncing, but requires migrating the file structure on WebDAV.',
					});
				},
				close: 'Close',
				title: 'Migration completed',
			},
		},
	},
	sync: {
		alreadyUpToDate: '✅ Already up to date',
		awaitingConfirmation: '💤 Waiting for confirmation',
		cancelled: '⭕ Sync cancelled',
		closeButton: 'Close',
		complete: '✅ Sync completed',
		completeWithFailed: '❌ Sync completed with {{failedCount}} failed tasks',
		confirmModal: {
			cancel: 'Cancel',
			confirm: 'Confirm sync',
			message:
				'⚠️ Please note:\n\n1. Sync operation may modify or delete local files\n2. We recommend backing up important files before syncing\n3. In case of file conflicts, manual resolution may be required\n4. Initial sync will process all files and may take longer, please be patient\n\nAre you sure you want to start syncing?',
			remoteDir: 'Remote directory: {{dir}}',
			strategy: 'Sync strategy: {{strategy}}',
			title: 'Sync confirmation',
		},
		error: {
			accountNotConfigured:
				'WebDAV account is not configured. Please configure your server URL, account name, and credential in settings first.',
			conflictsMarkedInFile: 'Conflicts found and marked in file',
			failedToAutoMerge: 'Failed to auto merge',
			failedToUploadMerged: 'Failed to upload merged content',
			folderButFile: 'Expected folder but found file: {{path}}',
			localPathNotFound: 'Local path not found: {{path}}',
			notFound: 'Not found: {{path}}',
		},
		failed: 'Sync failed!',
		failedDescription: 'The following tasks failed during sync:',
		failedStatus: '❌ Sync failed',
		failedWithError: '❌ Sync failed with error: {{error}}',
		fileFolderConflict: {
			file: 'file',
			folder: 'folder',
			message:
				'Unable to sync: {{path}} is a {{remoteForm}} at remote but a {{localForm}} at local',
		},
		fileOp: {
			addRecord: 'Add Record',
			cleanRecord: 'Clean record',
			createLocalDir: 'Create local directory',
			createRemoteDir: 'Create remote directory',
			download: 'Download',
			merge: 'Merge',
			removeLocal: 'Remove local',
			removeLocalRecursively: 'Remove local recursively',
			removeRemote: 'Remove remote',
			removeRemoteRecursively: 'Remove remote recursively',
			sync: 'Sync',
			upload: 'Upload',
		},
		hideButton: 'Hide',
		manualConfirmation: 'Review the tasks below. Confirm to execute the selected tasks.',
		notSyncing: 'No sync currently in progress',
		preConnecting: '☎️ Pre-connecting',
		progress: '⌛️ Sync progress: {{percent}}%',
		progressStats: 'Completed {{completed}} / {{total}}',
		progressTitle: 'Sync progress',
		runKind: {
			fast: 'Fast',
			normal: 'Normal',
		},
		showProgressButton: 'Show sync progress',
		startButton: 'Start sync',
		stopButton: 'Stop sync',
		syncingFiles: '⌛️ Syncing files...',
		upToDate: '✅ Up to date',
		walkingRemote: '🔍 Walking remote',
	},
	time: {
		daysAgo: '{{count}}d ago',
		hoursAgo: '{{count}}h ago',
		justNow: 'Just now',
		longAgo: 'Long ago',
		minutesAgo: '{{count}}min ago',
	},
};

export default en;
