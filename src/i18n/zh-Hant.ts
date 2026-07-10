import type en from './en';

const zhHant: typeof en = {
	deleteConfirm: {
		deleteAndReupload: '刪除已選項目，重新上傳未勾選項目',
		filePath: '檔案路徑',
		instruction:
			'⚠️ 以下本機檔案將在自動同步時被刪除（因為它們已在遠端被刪除）。\n\n請勾選要刪除的檔案；未勾選的檔案將被重新上傳：',
		select: '選擇',
		skipForNow: '暫時跳過',
		title: '確認刪除本機檔案',
		warningNotice: '本機檔案即將被刪除，請確認',
	},
	dirSelector: {
		cancel: '取消',
		confirm: '確認',
		currentPath: '目前路徑：{{path}}',
		goBack: '返回上層',
		newFolder: '新增資料夾',
	},
	errors: {
		filenameUnsupportedChars: '檔案 {{path}} 包含不支援的字元：{{chars}}',
	},
	settings: {
		account: {
			desc: '輸入您的 WebDAV 帳號',
			name: '帳號',
			placeholder: '請輸入帳號',
		},
		checkConnection: {
			desc: '點擊以檢查 WebDAV 連線',
			failure: 'WebDAV 連線失敗',
			failureButton: '失敗 ×',
			failureWithReason: 'WebDAV 連線失敗：{{reason}}',
			name: '檢查連線',
			success: 'WebDAV 連線成功',
			successButton: '已連線 ✓',
		},
		clearRecords: {
			allButton: '清除所有記錄',
			allCleared: '已清除所有記錄',
			desc: 'WebDAV 同步記錄用於追蹤同步狀態，以協調本機與遠端檔案的同步作業。此選項允許您選擇性地清除記錄。警告：此操作極可能導致資料遺失。',
			name: '清除記錄',
			vaultButton: '清除 Vault 記錄',
			vaultCleared: '已清除 Vault 記錄',
		},
		confirmBeforeDeleteInAutoSync: {
			desc: '在自動同步期間即將刪除本機檔案時顯示確認對話方塊，讓您選擇刪除或重新上傳這些檔案。',
			name: '自動同步前確認刪除檔案',
		},
		confirmBeforeSync: {
			desc: '顯示待處理任務並在確認後執行（不影響自動同步）',
			name: '手動同步前確認',
		},
		conflictStrategy: {
			desc: '選擇解決檔案衝突的方式。\n注意：建議在使用智慧合併前先備份重要檔案，以防止資料遺失。',
			diffMatchPatch: '智慧合併',
			keepLocal: '保留本機版本',
			keepRemote: '保留遠端版本',
			latestTimestamp: '使用最新版本',
			name: '衝突解決策略',
			skip: '跳過衝突',
		},
		credential: {
			desc: '輸入您的 WebDAV 憑證',
			name: '憑證',
			placeholder: '請輸入憑證',
		},
		customHeaders: {
			desc: '可選。每行一個，格式為「Header-Name: value」。隨每個 WebDAV 請求發送。',
			name: '自訂標頭',
			placeholder: 'X-Api-Key: abc123',
		},
		encryption: {
			desc: '上傳前加密檔案，下載時解密檔案。加密密碼將儲存於 Obsidian 鑰匙圈中。',
			name: '加密',
			reminderModal: {
				acknowledge: '我了解了',
				messageDisabled:
					'⚠️ 停用加密前請務必注意以下事項：\n\n1. 後續所有上傳都將以明文進行，不再加密。\n2. 請確保所有裝置都已停用加密功能。\n3. 若此 Vault 先前曾以加密方式上傳，請完全刪除遠端基底目錄（包含根資料夾），並重新上傳整個 Vault。',
				messageEnabled:
					'⚠️ 啟用加密前請務必注意以下事項：\n\n1. 後續所有上傳都將經過加密處理。\n\n2. 若此 Vault 先前曾以未加密方式上傳，請完全刪除遠端目錄（包含根資料夾），並重新上傳整個 Vault。\n\n3. 請確保所有裝置上的以下四項設定完全一致：\n    • 加密密碼\n    • 伺服器 URL\n    • 帳號名稱\n    • 遠端目錄\n\n4. 加密演算法會將解密金鑰與檔案位置及伺服器身分綁定，這能提供更高的安全性與資料完整性。但這也意味著，若您使用不同的伺服器，或未透過此外掛就將檔案移動到其他位置，將無法解密該檔案。\n\n5. 請避免在伺服器上手動管理檔案。若日後更換伺服器，請在啟用加密的狀態下重新上傳 Vault。\n\n6. 由於加密機制，同步過程所需時間會稍長一些。',
				titleDisabled: '已停用加密',
				titleEnabled: '已啟用加密',
			},
		},
		exhaustiveRemoteTraversal: {
			desc: '在單一 WebDAV 請求中遍歷整個遠端目錄樹，包含所有子目錄。這能大幅縮減大型目錄的遍歷時間，但可能與部分 WebDAV 伺服器存在相容性問題。（此功能會在 PROPFIND 請求中傳送 "Depth: infinity"）',
			name: '完整遠端遍歷',
		},
		fastRealtimeSync: {
			desc: '假設快速同步期間遠端內容不會變更，以便重複使用快取資料並避免不必要的請求。這可以提升同步效能，但會忽略遠端的變更。建議搭配啟動時同步及定期同步使用。',
			name: '即時同步快速模式',
		},
		filters: {
			add: '新增規則',
			cancel: '取消',
			confirmRemove: '確認移除',
			desc: '新增路徑以篩選檔案或資料夾',
			description:
				'符合這些模式的檔案或資料夾將在同步時被忽略。請使用 * 作為萬用字元進行比對。',
			edit: '編輯規則',
			exclude: {
				desc: '符合這些 Glob 模式的檔案／資料夾將不會被同步。若要排除特定檔案，請記得加入副檔名（例如 .md）。',
				name: '排除規則',
			},
			include: {
				desc: '僅同步符合這些 Glob 模式的檔案／資料夾（若有定義）。若要包含特定檔案，請記得加入副檔名（例如 .md）。',
				name: '包含規則',
			},
			name: '同步篩選器',
			placeholder: '例如：.DS_Store, *.pdf',
			remove: '移除',
			save: '儲存',
		},
		invalidValue: '數值無效，已重設為先前的值',
		log: {
			button: '檢視記錄',
			desc: '匯出依同步執行階段分組的可讀支援報告',
			name: '支援報告',
			saveError: '儲存支援報告失敗',
			saveToNote: '匯出至筆記',
			savedToNote: '支援報告已儲存至筆記：{{fileName}}',
		},
		maxSyncTaskConcurrency: {
			desc: '同步任務是指原子性的同步操作，例如下載檔案或移除目錄。此設定可限制同時執行的最大任務數，有助於降低 CPU 和磁碟使用率。請在欄位中調整限制值。',
			name: '最大同步任務併發數',
			placeholder: '輸入數量',
		},
		maxThroughputConcurrency: {
			desc: '限制同時上傳或下載的檔案總大小上限。此選項有助於控制記憶體使用量並防止當機。請在欄位中調整大小限制。',
			name: '最大併發傳輸量',
			placeholder: '輸入檔案大小（例如 100MB、0.5GB）',
		},
		maxWebDAVConcurrency: {
			desc: '限制同時發出的 WebDAV 請求數量上限。此選項對於有速率限制的服務相當實用。請在欄位中調整允許的最大併發數。',
			name: '最大 WebDAV 請求併發數',
			placeholder: '輸入數量',
		},
		minWebDAVRequestInterval: {
			desc: '限制 WebDAV 請求之間的最短間隔時間。此選項對於有速率限制的服務相當實用。請在欄位中調整間隔時間。',
			name: 'WebDAV 請求最短間隔',
			placeholder: '輸入間隔（例如 1s、300ms）',
		},
		realtimeSync: {
			desc: '檔案修改後立即自動觸發同步。請在欄位中調整從檔案修改到觸發同步之間的延遲時間。',
			name: '即時同步',
			placeholder: '同步延遲（例如 1s、500ms）',
		},
		remoteDir: {
			desc: '輸入遠端目錄',
			edit: '編輯',
			name: '遠端目錄',
			placeholder: '輸入遠端目錄',
		},
		scheduledSync: {
			desc: '定期觸發背景同步。請在欄位中設定定期背景同步的間隔時間。',
			name: '排程同步',
			placeholder: '輸入間隔（例如 10min、0.5h）',
		},
		sections: {
			common: '一般',
			control: '限制與控制',
			development: '開發者設定',
			filters: '篩選規則',
		},
		serverUrl: {
			desc: '您的 WebDAV 服務基礎 URL。',
			name: 'WebDAV 伺服器 URL',
			placeholder: 'https://example.com/webdav',
		},
		showSyncStatusInNotificationOnMobile: {
			desc: '同步期間在行動裝置上保持通知可見，並於同步結束後兩秒自動隱藏',
			name: '在行動裝置通知中顯示同步狀態',
		},
		skipLargeFiles: {
			desc: '同步時跳過超過指定大小的檔案。此選項對於儲存空間有限的服務相當實用。請在欄位中調整大小限制。',
			name: '跳過大型檔案',
			placeholder: '輸入大小限制（例如 10MB、0.5GB）',
		},
		startupSync: {
			desc: '啟動後自動觸發同步。請在欄位中設定啟動後自動執行同步的延遲時間。',
			name: '啟動時同步',
			placeholder: '輸入延遲（例如 10s、1min）',
		},
		tips: {
			desc: '⚠️ 同步過程可能會修改或刪除本機檔案。請在同步前備份重要檔案。',
			name: '提示',
		},
		unmergeableStrategy: {
			desc: '針對無法透過智慧合併解決的檔案（所有非 Markdown 檔案），選擇替代處理策略。',
			name: '無法合併時的衝突解決策略',
		},
		useGitStyle: {
			desc: '使用 <<<<<<< 和 >>>>>>> 標記來標示衝突，而非 HTML 標籤',
			name: '使用 Git 風格衝突標記',
		},
		v3Migration: {
			button: '立即遷移',
			desc: 'WebDAV Sync v3（現已重新命名為 Sync Engine）已正式發布。此版本完全重新編寫，帶來了更卓越的效能與擴充性。此選項可讓您以最低的轉換阻礙，將外掛程式設定與紀錄從 v2 遷移至 v3。',
			failure: {
				body: '遷移失敗：{{error}}',
				close: '關閉',
				partialCleanup: '來源資料清理可能已經開始。',
				rolledBack: '遷移已還原，未毀損任何資料。',
				title: '遷移失敗',
			},
			name: '遷移至 v3',
			progress: {
				stats: '{{completed}} / {{total}}',
				step: '進度',
				title: '正在遷移至 Sync Engine',
			},
			prompt: {
				bottom: `除了第一步之外，不會修改或刪除任何 vault 檔案。遷移程序不可逆。要立即開始遷移嗎？`,
				cancel: '取消',
				dontShowAgain: '不再顯示',
				middleEncrypted: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: '遷移將執行以下步驟：',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', {
						text: '啟動一般同步，以確保本機擁有儲存庫檔案的最新複本。',
					});
					ol.createEl('li', {
						text: '將您的設定轉換為 v3 格式，並儲存至 Sync Engine 外掛程式資料夾。',
					});
					ol.createEl('li', {
						text: '安裝必要的 Sync Engine 模組並儲存至外掛程式資料夾，以確保 v2 與 v3 之間的使用體驗一致。',
					});
					ol.createEl('li', {
						text: '清理此儲存庫舊有的 v2 紀錄儲存空間。',
					});
					const p2 = frag.createEl('p');
					p2.createSpan({
						text: '遷移完成後，您需要解除安裝 WebDAV Sync 外掛程式，並從 Obsidian 外掛程式商店安裝並啟用 ',
					});
					p2.createEl('strong', { text: 'Sync Engine' });
					p2.createSpan({
						text: '。Sync Engine 將會自動讀取您的資料與設定。',
					});
					const p3 = frag.createEl('p');
					p3.createEl('strong', {
						text: '注意：由於您啟用了加密功能，且 v3 的加密演算法有所變更，您需要在安裝 Sync Engine 後，手動刪除 WebDAV 根目錄並重新上傳您的儲存庫。',
					});
				},
				middleNormal: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: '遷移將執行以下步驟：',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', {
						text: '啟動一般同步，以確保本機擁有儲存庫檔案的最新複本。',
					});
					ol.createEl('li', {
						text: '將您的設定轉換為 v3 格式，並儲存至 Sync Engine 外掛程式資料夾。',
					});
					ol.createEl('li', {
						text: '安裝必要的 Sync Engine 模組並儲存至外掛程式資料夾，以確保 v2 與 v3 之間的使用體驗一致。',
					});
					ol.createEl('li', {
						text: '執行唯讀的 WebDAV 掃描以收集必要資訊，並儲存至 v3 紀錄儲存空間。',
					});
					ol.createEl('li', {
						text: '清理此儲存庫舊有的 v2 紀錄儲存空間。',
					});
					const p2 = frag.createEl('p');
					p2.createSpan({
						text: '遷移完成後，您需要解除安裝 WebDAV Sync 外掛程式，並從 Obsidian 外掛程式商店安裝並啟用 ',
					});
					p2.createEl('strong', { text: 'Sync Engine' });
					p2.createSpan({
						text: '。Sync Engine 將會自動讀取您的資料與設定。',
					});
				},
				proceed: '繼續',
				title: 'WebDAV Sync v3 更新',
				top: (frag: DocumentFragment) => {
					const p1 = frag.createEl('p');
					p1.createEl('strong', { text: 'WebDAV Sync v3' });
					p1.createSpan({ text: '（現已重新命名為 ' });
					p1.createEl('strong', { text: 'Sync Engine' });
					p1.createSpan({
						text: '）已正式發布至 Obsidian 外掛程式商店。此版本完全重新編寫，不僅效能大幅提升，還能透過模組輕鬆擴充。歡迎造訪 ',
					});
					p1.createEl('a', {
						attr: { href: 'https://sync.consensia.cc' },
						text: 'Sync Engine 官方網站',
					});
					p1.createSpan({ text: ' 以了解更多關於本次更新的資訊。' });

					frag.createEl('p', {
						text: '與 v2 相比，Sync Engine 使用了完全不同的設定與儲存架構。為了讓現有使用者能以最低的流暢度摩擦換用 Sync Engine，需要將既有的設定與紀錄遷移至新格式。',
					});
				},
			},
			steps: {
				cleanupSource: '正在清理 WebDAV Sync 資料',
				completed: '遷移完成',
				downloadModule: '正在下載 {{name}}',
				downloadModules: '正在下載模組',
				fetchCatalog: '正在取得模組目錄',
				migrateStorage: '正在遷移儲存空間',
				prepSync: '正在執行必要的前置同步',
				resolveModules: '正在剖析所需的模組',
				writePluginData: '正在寫入 Sync Engine 資料',
			},
			success: {
				bodyEncrypted: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: '現在請執行以下步驟：',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', {
						text: '解除安裝 WebDAV Sync。',
					});
					ol.createEl('li', {
						text: '前往您的 WebDAV 檔案管理介面，手動刪除原先用來儲存加密儲存庫檔案的資料夾。',
					});
					const li3 = ol.createEl('li');
					li3.createSpan({ text: '從 Obsidian 外掛程式商店安裝並啟用 ' });
					li3.createEl('strong', { text: 'Sync Engine' });
					li3.createSpan({ text: '。' });
					ol.createEl('li', {
						text: '啟動全新同步以將您的儲存庫上傳至同一個資料夾，新上傳的檔案將會保持加密。（如果您啟用了啟動時同步，此同步程序將會自動執行）',
					});
					frag.createEl('p', {
						text: '執行完上述四個步驟後，遷移即告完成。如果您先前已經遷移過 WebDAV 檔案，則可以跳過步驟 2 與步驟 4。',
					});
				},
				bodyNormal: (frag: DocumentFragment) => {
					frag.createEl('p', {
						text: '現在請執行以下步驟：',
					});
					const ol = frag.createEl('ol');
					ol.createEl('li', { text: '解除安裝 WebDAV Sync。' });
					const li2 = ol.createEl('li');
					li2.createSpan({ text: '從 Obsidian 外掛程式商店安裝並啟用 ' });
					li2.createEl('strong', { text: 'Sync Engine' });
					li2.createSpan({ text: '。' });
					const p2 = frag.createEl('p');
					p2.createSpan({
						text: '執行完上述兩個步驟後，遷移即告完成。注意：為了確保無縫遷移，v3 外掛程式的「非對稱儲存（Asymmetric Storage）」功能目前為停用狀態。啟用此功能雖可大幅加快同步速度，但需要遷移 WebDAV 上的檔案結構。',
					});
				},
				close: '關閉',
				title: '遷移完成',
			},
		},
	},
	sync: {
		alreadyUpToDate: '✅ 已是最新狀態',
		awaitingConfirmation: '💤 等待確認中',
		cancelled: '⭕ 同步已取消',
		closeButton: '關閉',
		complete: '✅ 同步完成',
		completeWithFailed: '❌ 同步完成，但有 {{failedCount}} 個任務失敗',
		confirmModal: {
			cancel: '取消',
			confirm: '確認同步',
			message:
				'⚠️ 請注意：\n\n1. 同步操作可能會修改或刪除本機檔案\n2. 建議在同步前先備份重要檔案\n3. 若發生檔案衝突，可能需要手動解決\n4. 初次同步需處理所有檔案，耗時較長，請耐心等候\n\n確定要開始同步嗎？',
			remoteDir: '遠端目錄：{{dir}}',
			strategy: '同步策略：{{strategy}}',
			title: '同步確認',
		},
		error: {
			accountNotConfigured:
				'尚未設定 WebDAV 帳號。請先在設定中配置伺服器 URL、帳號名稱及憑證。',
			conflictsMarkedInFile: '偵測到衝突並已在檔案中标示',
			failedToAutoMerge: '自動合併失敗',
			failedToUploadMerged: '上傳合併後的內容失敗',
			folderButFile: '預期為資料夾但發現檔案：{{path}}',
			localPathNotFound: '找不到本機路徑：{{path}}',
			notFound: '找不到：{{path}}',
		},
		failed: '同步失敗！',
		failedDescription: '以下任務在同步期間失敗：',
		failedStatus: '❌ 同步失敗',
		failedWithError: '❌ 同步失敗，錯誤訊息：{{error}}',
		fileFolderConflict: {
			file: '檔案',
			folder: '資料夾',
			message: '無法同步：{{path}} 在遠端是{{remoteForm}}，但在本機卻是{{localForm}}',
		},
		fileOp: {
			addRecord: '新增記錄',
			cleanRecord: '清除記錄',
			createLocalDir: '建立本機目錄',
			createRemoteDir: '建立遠端目錄',
			download: '下載',
			merge: '合併',
			removeLocal: '移除本機項目',
			removeLocalRecursively: '遞迴移除本機項目',
			removeRemote: '移除遠端項目',
			removeRemoteRecursively: '遞迴移除遠端項目',
			sync: '同步',
			upload: '上傳',
		},
		hideButton: '隱藏',
		manualConfirmation: '請檢閱下方任務。確認後將執行所選任務。',
		notSyncing: '目前沒有正在進行的同步',
		preConnecting: '☎️ 預先連線中',
		progress: '⌛️ 同步進度：{{percent}}%',
		progressStats: '已完成 {{completed}} / {{total}}',
		progressTitle: '同步進度',
		runKind: {
			fast: '快速',
			normal: '標準',
		},
		showProgressButton: '顯示同步進度',
		startButton: '開始同步',
		stopButton: '停止同步',
		syncingFiles: '⌛️ 正在同步檔案...',
		upToDate: '✅ 已是最新',
		walkingRemote: '🔍 正在掃描遠端目錄',
	},
	time: {
		daysAgo: '{{count}} 天前',
		hoursAgo: '{{count}} 小時前',
		justNow: '剛剛',
		longAgo: '很久以前',
		minutesAgo: '{{count}} 分鐘前',
	},
};

export default zhHant;
