import type { Translations } from '@hesprs/sync-engine-sdk';

const zhTW: Translations = {
	add: '新增',
	addRecord: '新增紀錄',
	addSecretHeader: '新增加密標頭',
	asymmetricStorage: '非對稱儲存',
	asymmetricStorageDescription: (frag) => {
		frag.appendText('使用');
		frag.createEl('a', {
			attr: {
				href: 'https://sync.consensia.cc/deep-dive/asymmetric-storage',
			},
			text: '非對稱儲存',
		});
		frag.appendText('來大幅提升同步速度。');
	},
	asymmetricStorageMigration: (frag, flag) => {
		if (flag === 'enable') {
			frag.createEl('p', {
				text: '⚠️ 在啟用非對稱儲存前，請務必留意以下幾點：',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: '遠端儲存將不再保留本地的層級結構。所有檔案都會直接上傳至根目錄，並附上隨機字串標記。',
			});
			ol.createEl('li', {
				text: '若您需要讓遠端檔案保持可讀的目錄結構，請勿啟用此功能。',
			});
			ol.createEl('li', {
				text: '啟用後，請確保所有裝置皆已開啟非對稱儲存。',
			});
			ol.createEl('li', {
				text: '若此儲存庫先前未啟用非對稱儲存即進行過上傳，則必須執行遷移。',
			});
		} else {
			frag.createEl('p', {
				text: '⚠️ 在停用非對稱儲存前，請務必留意以下幾點：',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: '後續的所有上傳將會還原為本地的層級結構。',
			});
			ol.createEl('li', {
				text: '請確保所有裝置皆已停用非對稱儲存。',
			});
			ol.createEl('li', {
				text: '若此儲存庫先前是在啟用非對稱儲存的狀態下上傳，則必須執行遷移。',
			});
		}
	},
	awaitingConfirmation: '等待確認',
	backend: '儲存後端',
	backendDescription: '選擇要使用的雲端服務。後端支援由模組提供。',
	bidirectional: '雙向同步',
	cancel: '取消',
	cancelled: '已取消',
	checkConnection: '測試連線',
	checkConnectionFailed: '連線測試失敗',
	checkConnectionSuccess: '連線測試成功',
	clear: '清除',
	clearRecords: '清除紀錄',
	clearRecordsDescription:
		'Sync Engine 會記錄同步狀態以處理本地與遠端檔案之間的變更。此選項允許您選擇性地清除紀錄。警告：此操作可能會導致資料遺失。',
	completed: '已完成',
	completedNoop: '已是最新狀態',
	configurations: '設定項目',
	configure: '設定',
	confirm: '確認',
	confirmDeleteDescription: '請確認要刪除的檔案，未勾選的任務將會重新上傳。',
	confirmDeleteInAutoSync: '自動同步時確認刪除',
	confirmDeleteInAutoSyncDescription:
		'在自動同步過程中刪除本地檔案前顯示確認視窗。您可以選擇刪除或重新上傳。',
	confirmTasksDescription: '請確認以下操作。',
	confirmTasksInSync: '手動同步時確認操作',
	confirmTasksInSyncDescription: '顯示待處理的操作，並在您確認後執行（不影響自動同步）。',
	conflictResolveStrategy: '衝突解決策略',
	conflictResolveStrategyDescription:
		'選擇當遠端與本地檔案自上次同步後皆有修改時的解決方式。更多策略可透過模組提供。',
	controls: '控制項',
	createLocalDir: '建立本地資料夾',
	createRemoteDir: '建立遠端資料夾',
	customHeaders: '自訂標頭',
	customHeadersDescription:
		'新增每次請求時要包含的自訂標頭，可選擇以明文儲存或儲存於 Obsidian 金鑰圈中。',
	delete: '刪除',
	deleteModule: '刪除模組',
	description: '說明',
	descriptionPlaceholder: '此模組是用於...',
	development: '開發者選項',
	diffMatchPatch: '文字合併',
	disableModule: '停用模組',
	disabled: '已停用',
	done: '完成',
	download: '下載',
	downloadModule: '下載模組',
	edit: '編輯',
	editHeaders: '編輯標頭',
	editModuleInformation: '編輯模組資訊',
	editSources: '編輯來源',
	enable: '啟用',
	enableModule: '啟用模組',
	enabled: '已啟用',
	exclusionRules: '排除規則',
	exclusionRulesDescription:
		'符合這些 Glob 萬用字元模式的檔案或資料夾將不會進行同步。若要排除特定檔案，請記得加上副檔名（例如 .md）。',
	executing: '執行中',
	export: '匯出',
	exportLogsDescription: '將外掛程式紀錄匯出至儲存庫中的檔案。',
	exportLogsFailed: '匯出紀錄失敗',
	exportLogsToFile: '匯出紀錄至檔案',
	failed: '失敗',
	failedTasksDescription: '以下任務在同步過程中失敗：',
	failedToDownloadModule: '下載模組 "{{name}}" 失敗',
	failedToFetchSource: '無法從 "{{url}}" 取得來源',
	failedToLoadModule: '載入模組 "{{name}}" 失敗',
	features: '功能特徵',
	filterPlaceholder: '例如 temp.md, .trash/**/*',
	filterRules: '過濾規則',
	headerKeyPlaceholder: '標頭名稱',
	headerValuePlaceholder: '標頭數值',
	hide: '隱藏',
	httpInsecureWarning: '請避免使用不安全的 HTTP 協定。',
	icon: '圖示',
	iconDescription: (frag) => {
		frag.appendText('設定此模組顯示於模組管理面板中的圖示，完整圖示清單可參考 ');
		frag.createEl('a', {
			attr: { href: 'https://lucide.dev/icons/' },
			text: 'Lucide Icons 目錄',
		});
		frag.appendText('。');
	},
	iconPlaceholder: '輸入 Lucide Icons 代碼（例如 puzzle）',
	idle: '待命',
	inclusionRules: '包含規則',
	inclusionRulesDescription:
		'即使符合排除規則，只要符合這些 Glob 萬用字元模式的檔案或資料夾仍會進行同步。',
	installed: '已安裝',
	integrityVerification: '完整性驗證',
	integrityVerificationDescription: (frag) => {
		frag.appendText('設定是否將模組的二進位檔案鎖定至特定雜湊值，並在每次載入時驗證該雜湊值。');
		frag.createEl('strong', {
			text: '強烈不建議關閉完整性驗證，否則將使系統暴露於極大的安全風險中。',
		});
	},
	invalidValue: '數值無效，已還原為原設定。',
	keepLocal: '保留本地',
	keepRemote: '保留遠端',
	latestSurvive: '以最新修改為主',
	loadingModules: '正在載入模組…',
	maxFileSize: '檔案大小上限',
	maxFileSizeDescription:
		'同步時跳過超過此大小的檔案。此選項適用於有容量限制的雲端服務。請在欄位中修改限制大小。',
	maxFileSizePlaceholder: '輸入大小限制（例如 10MB, 0.5GB）',
	maxMemoryConsumption: '記憶體用量上限',
	maxMemoryConsumptionDescription:
		'限制同步過程中使用的記憶體容量。此選項適用於記憶體有限的裝置。請在欄位中修改限制容量。',
	maxMemoryConsumptionPlaceholder: '輸入記憶體限制（例如 1GB, 200MB）',
	maxRequestConcurrency: '最大併發請求數',
	maxRequestConcurrencyDescription:
		'限制同步過程中的同時請求數量。此選項適用於有請求速率限制的服務。請在欄位中修改併發限制。',
	maxRequestConcurrencyPlaceholder: '輸入併發限制',
	migrationDescription:
		'根據儲存庫的大小，遷移過程可能需要數秒至數分鐘。若您已在其他裝置上完成遠端遷移，可以跳過此步驟。\n\n是否立即開始遷移？',
	migrationFailed: '遷移失敗',
	migrationPhase1Description: '確保本地狀態為最新',
	migrationPhase2Description: '清理遠端檔案與紀錄',
	migrationPhase3Description: '以新結構建置遠端內容',
	migrationProcess: '遷移進度',
	minRequestInterval: '最小請求間隔',
	minRequestIntervalDescription:
		'限制同步過程中連續請求之間的最小時間間隔。此選項適用於有請求速率限制的服務。請在欄位中修改間隔時間。',
	minRequestIntervalPlaceholder: '輸入間隔時間（例如 1s, 500ms）',
	miscellaneous: '雜項設定',
	moduleAutoUpdate: '自動更新模組',
	moduleAutoUpdateDescription: '自動從模組來源更新已安裝的模組。',
	moduleManagement: '模組管理',
	moduleManagementDescription:
		'在專屬面板中管理模組。您可以進行安裝、卸載、更新、啟用、停用、編輯模組或編輯模組來源。',
	moduleSourcePlaceholder: 'https://example.com/modules.json',
	moveLocal: '移動本地',
	moveRemote: '移動遠端',
	name: '名稱',
	namePlaceholder: '輸入模組顯示名稱',
	noInstalledModulesFound: '未找到已安裝的模組。',
	noMatchingModulesFound: '未找到符合條件的模組。',
	noModulesAvailable: '無可用模組。',
	none: '無',
	notInstalled: '未安裝',
	noticeStatusOnMobile: '行動裝置同步狀態通知',
	noticeStatusOnMobileDescription: '同步進行時於行動裝置上顯示通知訊息（取代桌面版的狀態列）。',
	omittedInvalidEntry: '已忽略 {{count}} 項無效條目。',
	openPanel: '開啟面板',
	realtimeSync: '即時同步',
	realtimeSyncDescription:
		'當檔案經修改後立即自動觸發同步。請在欄位中修改檔案變更到觸發同步之間的延遲時間。',
	realtimeSyncFastMode: '即時同步極速模式',
	realtimeSyncFastModeDescription:
		'在即時同步過程中重複使用快取資料並跳過不必要的遠端掃描，以加快同步速度。',
	realtimeSyncPlaceholder: '輸入同步延遲（例如 500ms, 5s）',
	recordsCleared: '紀錄已清除',
	remoteMigration: '遠端遷移',
	remove: '移除',
	removeLocal: '移除本地',
	removeRecord: '移除紀錄',
	removeRemote: '移除遠端',
	renameAndKeepBoth: '重新命名並保留兩者',
	resolveConflict: '解決衝突',
	save: '儲存',
	scheduledSync: '定時同步',
	scheduledSyncDescription: '按照設定的時間間隔定期觸發同步。請在欄位中修改間隔時間。',
	scheduledSyncPlaceholder: '輸入間隔時間（例如 10min, 0.5h）',
	searchModules: '搜尋模組',
	selectAll: '全選',
	showInstalledOnly: '僅顯示已安裝',
	showProgress: '顯示進度',
	skip: '跳過',
	sourcesDescription: '新增模組來源 URL。儲存時將自動忽略空白與無效的資料列。',
	startMigration: '開始遷移',
	startNonInteractiveSync: '啟動非互動式同步',
	startSync: '開始同步',
	startupSync: '啟動時同步',
	startupSyncDescription:
		'外掛程式啟動後，在經過指定的延遲時間自動觸發同步。請在欄位中修改延遲時間。',
	startupSyncPlaceholder: '輸入延遲時間（例如 5s, 1min）',
	stopSync: '停止同步',
	syncProgress: '同步進度',
	syncStrategy: '同步策略',
	syncStrategyDescription: '選擇用來處理檔案變更的同步策略。更多策略可透過模組提供。',
	toggleWithoutMigration: '直接切換（不執行遷移）',
	unknownModule: '未知模組',
	unknownModuleDescription: (frag, { fileName, size, path, mtime, ctime }) => {
		const p1 = frag.createEl('p');
		p1.appendText('Sync Engine 在模組目錄中偵測到名為 ');
		p1.createEl('code', { text: fileName });
		p1.appendText(
			' 的已安裝模組。此模組既未在 Sync Engine 模組面板中安裝，也未在任何地方註冊以豁免來源驗證。',
		);
		p1.createEl('strong', { text: '在繼續操作前，請仔細核對以下資訊：' });
		const ul = frag
			.createDiv(
				'rounded-lg border border-[--background-modifier-border] bg-[--background-secondary] px-2',
			)
			.createEl('ul');
		const li1 = ul.createEl('li');
		li1.appendText('檔案名稱：');
		li1.createEl('code', { text: fileName });
		const li2 = ul.createEl('li');
		li2.appendText('檔案路徑：');
		li2.createEl('code', { text: path });
		const li3 = ul.createEl('li');
		li3.appendText('檔案大小：');
		li3.createEl('code', { text: size });
		const li4 = ul.createEl('li');
		li4.appendText('建立時間：');
		li4.createEl('code', { text: ctime });
		const li5 = ul.createEl('li');
		li5.appendText('修改時間：');
		li5.createEl('code', { text: mtime });
		const p2 = frag.createEl('p');
		p2.createEl('strong', {
			text: '請避免載入來源不明的模組，這可能是惡意攻擊。',
		});
		p2.appendText(
			' 若您不清楚其來源，直接刪除是最好的做法。若此模組是由您掌控且為預期行為，您可以選擇「設定」並將其啟用。',
		);
	},
	updateAvailable: '有可用更新',
	updateModule: '更新模組',
	updateSource: '更新來源',
	updateSourceDescription: '設定此模組接收更新的模組來源。留空則停用更新。',
	updateSourcePlaceholder: 'https://example.com/modules.json',
	upload: '上傳',
	walkingRemote: '正在掃描遠端檔案',
};

export default zhTW;
