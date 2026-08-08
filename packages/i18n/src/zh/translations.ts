import type { Translations } from '@hesprs/sync-engine-sdk';

const zh: Translations = {
	add: '添加',
	addRecord: '添加记录',
	addSecretHeader: '添加机密请求头',
	asymmetricStorage: '非对称存储',
	asymmetricStorageDescription: (frag) => {
		frag.appendText('使用 ');
		frag.createEl('a', {
			attr: {
				href: 'https://sync.consensia.cc/deep-dive/asymmetric-storage',
			},
			text: '非对称存储',
		});
		frag.appendText(' 来大幅提升同步速度。');
	},
	asymmetricStorageMigration: (frag, flag) => {
		if (flag === 'enable') {
			frag.createEl('p', { text: '⚠️ 在启用非对称存储之前，您需要注意以下几点：' });
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: '远程存储将不再镜像本地的层级结构。所有文件都将被平铺上传到基目录，并附加随机字符串锚点。',
			});
			ol.createEl('li', { text: '如果您需要远程端保持人类可读性，请不要启用此功能。' });
			ol.createEl('li', { text: '启用后，请确保所有设备都已启用非对称存储。' });
			ol.createEl('li', {
				text: '如果该库此前在未启用非对称存储的情况下上传过，则必须进行迁移。',
			});
		} else {
			frag.createEl('p', { text: '⚠️ 在禁用非对称存储之前，您需要注意以下几点：' });
			const ol = frag.createEl('ol');
			ol.createEl('li', { text: '后续的所有上传都将镜像本地的层级结构。' });
			ol.createEl('li', { text: '请确保所有设备都已禁用非对称存储。' });
			ol.createEl('li', {
				text: '如果该库此前在启用非对称存储的情况下上传过，则必须进行迁移。',
			});
		}
	},
	awaitingConfirmation: '等待确认',
	backend: '存储后端',
	backendDescription: '选择要使用的云服务。后端由模块提供。',
	bidirectional: '双向同步',
	cancel: '取消',
	cancelled: '已取消',
	checkConnection: '测试连接',
	checkConnectionFailed: '测试连接失败',
	checkConnectionSuccess: '测试连接成功',
	clear: '清除',
	clearRecords: '清除记录',
	clearRecordsDescription:
		'Sync Engine 会记录同步状态，以便在本地和远程文件之间解析同步操作。此选项允许您选择性地清除记录。警告：此操作很可能会导致数据丢失。',
	completed: '已完成',
	completedNoop: '已是最新状态',
	configurations: '配置',
	configure: '配置',
	confirm: '确认',
	confirmDeleteDescription: '请确认将被删除的文件，未勾选的任务将会被重新上传。',
	confirmDeleteInAutoSync: '自动同步时确认删除',
	confirmDeleteInAutoSyncDescription:
		'在自动触发的同步过程中，显示将被删除的本地文件的确认提示。您可以选择删除或重新上传它们。',
	confirmTasksDescription: '请确认以下操作。',
	confirmTasksInSync: '手动同步时确认操作',
	confirmTasksInSyncDescription: '显示待处理的操作并在确认后执行（不影响自动同步）。',
	conflictResolveStrategy: '冲突解决策略',
	conflictResolveStrategyDescription:
		'选择当本地和远程自上次同步以来都被修改过时，如何解决冲突。更多策略可以在模块中找到。',
	controls: '控制',
	createLocalDir: '创建本地文件夹',
	createRemoteDir: '创建远程文件夹',
	customHeaders: '自定义请求头',
	customHeadersDescription:
		'添加要随每次请求一起发送的自定义请求头，它们可以明文存储，也可以存储在 Obsidian keychain 中。',
	delete: '删除',
	deleteModule: '删除模块',
	description: '描述',
	descriptionPlaceholder: '此模块是…',
	development: '开发',
	diffMatchPatch: '合并',
	disableModule: '禁用模块',
	disabled: '已禁用',
	done: '完成',
	download: '下载',
	downloadModule: '下载模块',
	edit: '编辑',
	editHeaders: '编辑请求头',
	editModuleInformation: '编辑模块信息',
	editSources: '编辑源',
	enable: '启用',
	enableModule: '启用模块',
	enabled: '已启用',
	exclusionRules: '排除规则',
	exclusionRulesDescription:
		'匹配这些 Glob 模式的文件 / 文件夹将不会被同步。如果您想排除文件，请记得添加文件扩展名（例如 .md）。',
	executing: '正在执行',
	export: '导出',
	exportLogsDescription: '将插件日志导出到库中的文件中。',
	exportLogsFailed: '导出日志失败',
	exportLogsToFile: '导出日志到文件',
	failed: '失败',
	failedTasksDescription: '以下任务在同步过程中失败：',
	failedToDownloadModule: '下载模块 “{{name}}” 失败',
	failedToFetchSource: '从 “{{url}}” 获取源失败',
	failedToLoadModule: '加载模块 “{{name}}” 失败',
	features: '功能',
	filterPlaceholder: '例如 temp.md, .trash/**/*',
	filterRules: '过滤规则',
	headerKeyPlaceholder: '请求头键',
	headerValuePlaceholder: '请求头值',
	hide: '隐藏',
	httpInsecureWarning: '请避免使用不安全的 HTTP 协议。',
	icon: '图标',
	iconDescription: (frag) => {
		frag.appendText('设置此模块在模块管理面板中显示的图标，完整图标可在 ');
		frag.createEl('a', {
			attr: { href: 'https://lucide.dev/icons/' },
			text: 'Lucide 图标目录',
		});
		frag.appendText(' 中找到。');
	},
	iconPlaceholder: '输入 Lucide 图标代码（例如 puzzle）',
	idle: '空闲',
	inclusionRules: '包含规则',
	inclusionRulesDescription: '匹配排除规则但同时也匹配这些 Glob 模式的文件 / 文件夹仍会被同步。',
	installed: '已安装',
	integrityVerification: '完整性验证',
	integrityVerificationDescription: (frag) => {
		frag.appendText('设置是否将模块的二进制文件固定到特定哈希值，并在每次加载时验证该哈希值。');
		frag.createEl('strong', {
			text: '强烈不建议关闭完整性验证，因为这会使您暴露于巨大的攻击面。',
		});
	},
	invalidValue: '无效值，已恢复为原始值。',
	keepLocal: '保留本地',
	keepRemote: '保留远程',
	latestSurvive: '保留最新修改',
	loadingModules: '正在加载模块…',
	maxFileSize: '最大文件大小',
	maxFileSizeDescription:
		'在同步过程中跳过超过此大小的文件。此选项对于有存储空间限制的服务非常有用。在输入框中修改大小限制。',
	maxFileSizePlaceholder: '输入大小限制（例如 10MB, 0.5GB）',
	maxMemoryConsumption: '最大内存消耗',
	maxMemoryConsumptionDescription:
		'限制同步过程中使用的内存量。此选项对于有内存限制的设备非常有用。在输入框中修改内存限制。',
	maxMemoryConsumptionPlaceholder: '输入内存限制（例如 1GB, 200MB）',
	maxRequestConcurrency: '最大并发请求数',
	maxRequestConcurrencyDescription:
		'限制同步过程中的同时请求数。此选项对于有请求频率限制的服务非常有用。在输入框中修改并发限制。',
	maxRequestConcurrencyPlaceholder: '输入并发限制',
	migrationDescription:
		'迁移可能需要几秒钟到几分钟不等，具体取决于库的大小。如果您已在其他设备上迁移了远程端，可以跳过此迁移。\n\n现在开始迁移吗？',
	migrationFailed: '迁移失败',
	migrationPhase1Description: '确保本地状态是最新的',
	migrationPhase2Description: '清理远程端和记录',
	migrationPhase3Description: '使用新结构填充远程端',
	migrationProcess: '迁移进程',
	minRequestInterval: '最小请求间隔',
	minRequestIntervalDescription:
		'限制同步过程中连续请求之间的最小时间间隔。此选项对于有请求频率限制的服务非常有用。在输入框中修改间隔。',
	minRequestIntervalPlaceholder: '输入间隔（例如 1s, 500ms）',
	miscellaneous: '杂项',
	moduleAutoUpdate: '自动更新模块',
	moduleAutoUpdateDescription: '从模块源自动更新已安装的模块。',
	moduleManagement: '模块管理',
	moduleManagementDescription:
		'在专用面板中管理模块。您可以安装、卸载、更新、启用、禁用、编辑模块，或编辑模块源。',
	moduleSourcePlaceholder: 'https://example.com/modules.json',
	moveLocal: '移动本地',
	moveRemote: '移动远程',
	name: '名称',
	namePlaceholder: '输入模块显示名称',
	noInstalledModulesFound: '未找到已安装的模块。',
	noMatchingModulesFound: '未找到匹配的模块。',
	noModulesAvailable: '没有可用模块。',
	none: '无',
	notInstalled: '未安装',
	noticeStatusOnMobile: '移动端同步状态提示',
	noticeStatusOnMobileDescription:
		'同步进行时在移动设备上显示通知提示。在桌面端则会替换状态栏显示。',
	omittedInvalidEntry: '已忽略 {{count}} 条无效条目。',
	openPanel: '打开面板',
	realtimeSync: '实时同步',
	realtimeSyncDescription:
		'文件一旦修改即刻自动触发同步。在输入框中修改文件修改到触发同步之间的延迟时间。',
	realtimeSyncFastMode: '实时同步快速模式',
	realtimeSyncFastModeDescription:
		'在实时同步过程中复用缓存数据并避免不必要的远程探测，以加速同步。',
	realtimeSyncPlaceholder: '输入同步延迟（例如 500ms, 5s）',
	recordsCleared: '记录已清除',
	remoteMigration: '远程迁移',
	remove: '移除',
	removeLocal: '移除本地',
	removeRecord: '移除记录',
	removeRemote: '移除远程',
	renameAndKeepBoth: '重命名并保留两者',
	resolveConflict: '解决冲突',
	save: '保存',
	scheduledSync: '定时同步',
	scheduledSyncDescription: '按照指定的时间间隔定期触发同步。在输入框中修改间隔时间。',
	scheduledSyncPlaceholder: '输入间隔（例如 10min, 0.5h）',
	searchModules: '搜索模块',
	selectAll: '全选',
	showInstalledOnly: '仅显示已安装',
	showProgress: '显示进度',
	skip: '跳过',
	sourcesDescription: '添加模块源 URL。保存时将忽略空白行和无效行。',
	startMigration: '开始迁移',
	startNonInteractiveSync: '开始静默同步',
	startSync: '开始同步',
	startupSync: '启动同步',
	startupSyncDescription: '在插件启动后的指定延迟时间后自动触发同步。在输入框中修改延迟时间。',
	startupSyncPlaceholder: '输入延迟（例如 5s, 1min）',
	stopSync: '停止同步',
	syncProgress: '同步进度',
	syncStrategy: '同步策略',
	syncStrategyDescription: '选择用于解决文件更改的同步策略。更多策略可以在模块中找到。',
	toggleWithoutMigration: '直接切换（不进行迁移）',
	unknownModule: '未知模块',
	unknownModuleDescription: (frag, { fileName, size, path, mtime, ctime }) => {
		const p1 = frag.createEl('p');
		p1.appendText('Sync Engine 在其模块目录中检测到一个名为 ');
		p1.createEl('code', { text: fileName });
		p1.appendText(
			' 的已安装模块。该模块既未安装在 Sync Engine 模块面板中，也未在任何地方注册以豁免出处验证。',
		);
		p1.createEl('strong', { text: '在继续操作之前，请核对以下信息：' });
		const ul = frag
			.createDiv(
				'rounded-lg border border-[--background-modifier-border] bg-[--background-secondary] px-2',
			)
			.createEl('ul');
		const li1 = ul.createEl('li');
		li1.appendText('文件名：');
		li1.createEl('code', { text: fileName });
		const li2 = ul.createEl('li');
		li2.appendText('文件路径：');
		li2.createEl('code', { text: path });
		const li3 = ul.createEl('li');
		li3.appendText('大小：');
		li3.createEl('code', { text: size });
		const li4 = ul.createEl('li');
		li4.appendText('创建时间：');
		li4.createEl('code', { text: ctime });
		const li5 = ul.createEl('li');
		li5.appendText('修改时间：');
		li5.createEl('code', { text: mtime });
		const p2 = frag.createEl('p');
		p2.createEl('strong', {
			text: '请避免加载来源不明的模块，因为这可能是一种恶意攻击。',
		});
		p2.appendText(
			'如果您不知道它来自何处，直接删除是最佳选择。如果您了解该模块且此操作符合预期，您可以选择"配置"并启用它。',
		);
	},
	updateAvailable: '有可用更新',
	updateModule: '更新模块',
	updateSource: '更新源',
	updateSourceDescription: '设置此模块接收更新的模块源。留空以禁用更新。',
	updateSourcePlaceholder: 'https://example.com/modules.json',
	upload: '上传',
	walkingRemote: '正在探测远程文件',
};

export default zh;
