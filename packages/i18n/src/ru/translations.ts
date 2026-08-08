import type { Translations } from '@hesprs/sync-engine-sdk';

const ru: Translations = {
	add: 'Добавить',
	addRecord: 'Добавить запись',
	addSecretHeader: 'Добавить секретный заголовок',
	asymmetricStorage: 'Асимметричное хранилище',
	asymmetricStorageDescription: (frag) => {
		frag.appendText('Используйте ');
		frag.createEl('a', {
			attr: {
				href: 'https://sync.consensia.cc/deep-dive/asymmetric-storage',
			},
			text: 'асимметричное хранилище',
		});
		frag.appendText(', чтобы существенно ускорить синхронизацию.');
	},
	asymmetricStorageMigration: (frag, flag) => {
		if (flag === 'enable') {
			frag.createEl('p', {
				text: '⚠️ Пожалуйста, будьте внимательны к следующим моментам перед включением асимметричного хранилища:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: 'Удалённое хранилище больше не будет повторять локальную иерархическую структуру. Все файлы будут загружаться в корневой каталог в «плоском» виде с добавлением случайных строковых якорей.',
			});
			ol.createEl('li', {
				text: 'Если вам важно, чтобы удалённое хранилище оставалось удобным для чтения человеком, не включайте эту функцию.',
			});
			ol.createEl('li', {
				text: 'После включения убедитесь, что асимметричное хранилище активировано на всех устройствах.',
			});
			ol.createEl('li', {
				text: 'Миграция необходима, если этот хранилище (vault) ранее загружалось без асимметричного хранилища.',
			});
		} else {
			frag.createEl('p', {
				text: '⚠️ Пожалуйста, будьте внимательны к следующим моментам перед отключением асимметричного хранилища:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: 'Все последующие загрузки будут повторять локальную иерархическую структуру.',
			});
			ol.createEl('li', {
				text: 'Пожалуйста, убедитесь, что асимметричное хранилище отключено на всех устройствах.',
			});
			ol.createEl('li', {
				text: 'Миграция необходима, если этот хранилище (vault) ранее загружалось с включённым асимметричным хранилищем.',
			});
		}
	},
	awaitingConfirmation: 'Ожидание подтверждения',
	backend: 'Бэкенд хранилища',
	backendDescription: 'Выберите облачный сервис. Бэкенды предоставляются модулями.',
	bidirectional: 'Двунаправленная',
	cancel: 'Отмена',
	cancelled: 'Отменено',
	checkConnection: 'Проверить соединение',
	checkConnectionFailed: 'Ошибка проверки соединения',
	checkConnectionSuccess: 'Соединение успешно проверено',
	clear: 'Очистить',
	clearRecords: 'Очистить записи',
	clearRecordsDescription:
		'Sync Engine записывает состояния синхронизации для разрешения операций между локальными и удалёнными файлами. Эта опция позволяет выборочно очищать записи. Внимание: это действие может привести к потере данных.',
	completed: 'Завершено',
	completedNoop: 'Уже синхронизировано',
	configurations: 'Конфигурации',
	configure: 'Настроить',
	confirm: 'Подтвердить',
	confirmDeleteDescription:
		'Пожалуйста, подтвердите файлы, которые будут удалены. Невыбранные задачи будут загружены повторно.',
	confirmDeleteInAutoSync: 'Подтверждать удаления при автосинхронизации',
	confirmDeleteInAutoSyncDescription:
		'Показывать подтверждение для локальных файлов, которые будут удалены во время автоматической синхронизации. Вы сможете выбрать: удалить их или загрузить повторно.',
	confirmTasksDescription: 'Пожалуйста, подтвердите операции ниже.',
	confirmTasksInSync: 'Подтверждать операции при ручной синхронизации',
	confirmTasksInSyncDescription:
		'Показывать ожидающие операции и выполнять их только после подтверждения (не влияет на автосинхронизацию).',
	conflictResolveStrategy: 'Стратегия разрешения конфликтов',
	conflictResolveStrategyDescription:
		'Выберите способ разрешения конфликтов, когда и удалённый, и локальный файл были изменены с момента последней синхронизации. Дополнительные стратегии доступны в модулях.',
	controls: 'Управление',
	createLocalDir: 'Создать локальную папку',
	createRemoteDir: 'Создать удалённую папку',
	customHeaders: 'Пользовательские заголовки',
	customHeadersDescription:
		'Добавьте пользовательские заголовки, которые будут отправляться с каждым запросом. Их можно хранить в открытом виде или в связке ключей Obsidian keychain.',
	delete: 'Удалить',
	deleteModule: 'Удалить модуль',
	description: 'Описание',
	descriptionPlaceholder: 'Этот модуль...',
	development: 'Разработка',
	diffMatchPatch: 'Объединить',
	disableModule: 'Отключить модуль',
	disabled: 'Отключено',
	done: 'Готово',
	download: 'Скачать',
	downloadModule: 'Скачать модуль',
	edit: 'Редактировать',
	editHeaders: 'Редактировать заголовки',
	editModuleInformation: 'Редактировать информацию о модуле',
	editSources: 'Редактировать источники',
	enable: 'Включить',
	enableModule: 'Включить модуль',
	enabled: 'Включено',
	exclusionRules: 'Правила исключения',
	exclusionRulesDescription:
		'Файлы и папки, соответствующие этим glob-шаблонам, не будут синхронизироваться. Не забудьте указать расширения файлов (например, .md), если хотите исключить файлы.',
	executing: 'Выполняется',
	export: 'Экспорт',
	exportLogsDescription: 'Экспортировать логи плагина в файл внутри хранилища.',
	exportLogsFailed: 'Не удалось экспортировать логи',
	exportLogsToFile: 'Экспортировать логи в файл',
	failed: 'Ошибка',
	failedTasksDescription: 'Следующие задачи завершились ошибкой во время синхронизации:',
	failedToDownloadModule: 'Не удалось скачать модуль «{{name}}»',
	failedToFetchSource: 'Не удалось получить источник из «{{url}}»',
	failedToLoadModule: 'Не удалось загрузить модуль «{{name}}»',
	features: 'Возможности',
	filterPlaceholder: 'Например, temp.md, .trash/**/*',
	filterRules: 'Правила фильтрации',
	headerKeyPlaceholder: 'Ключ заголовка',
	headerValuePlaceholder: 'Значение заголовка',
	hide: 'Скрыть',
	httpInsecureWarning: 'Пожалуйста, избегайте использования незащищённого протокола HTTP.',
	icon: 'Иконка',
	iconDescription: (frag) => {
		frag.appendText(
			'Задайте иконку для этого модуля, которая будет отображаться в панели управления модулями. Полный список иконок доступен в ',
		);
		frag.createEl('a', {
			attr: { href: 'https://lucide.dev/icons/' },
			text: 'каталоге Lucide Icons',
		});
		frag.appendText('.');
	},
	iconPlaceholder: 'Введите код Lucide Icons (например, puzzle)',
	idle: 'В ожидании',
	inclusionRules: 'Правила включения',
	inclusionRulesDescription:
		'Файлы и папки, подпадающие под правила исключения, но соответствующие этим glob-шаблонам, всё равно будут синхронизированы.',
	installed: 'Установлено',
	integrityVerification: 'Проверка целостности',
	integrityVerificationDescription: (frag) => {
		frag.appendText(
			'Определяет, нужно ли привязывать бинарный файл модуля к определённому хэшу и проверять его при каждой загрузке. ',
		);
		frag.createEl('strong', {
			text: 'Настоятельно не рекомендуется отключать проверку целостности, так как это сильно снижает безопасность.',
		});
	},
	invalidValue: 'Некорректное значение, возвращено исходное.',
	keepLocal: 'Оставить локальную версию',
	keepRemote: 'Оставить удалённую версию',
	latestSurvive: 'Оставлять последнюю версию',
	loadingModules: 'Загрузка модулей…',
	maxFileSize: 'Макс. размер файла',
	maxFileSizeDescription:
		'Пропускать файлы, превышающие этот размер, при синхронизации. Полезно для сервисов с ограничением по объёму хранилища. Измените лимит в поле ниже.',
	maxFileSizePlaceholder: 'Введите лимит размера (например, 10MB, 0.5GB)',
	maxMemoryConsumption: 'Макс. расход памяти',
	maxMemoryConsumptionDescription:
		'Ограничить объём оперативной памяти, используемой при синхронизации. Полезно для устройств с небольшим объёмом ОЗУ. Измените лимит в поле ниже.',
	maxMemoryConsumptionPlaceholder: 'Введите лимит памяти (например, 1GB, 200MB)',
	maxRequestConcurrency: 'Макс. количество одновременных запросов',
	maxRequestConcurrencyDescription:
		'Ограничить количество параллельных запросов во время синхронизации. Полезно для сервисов с лимитом на частоту запросов. Измените лимит в поле ниже.',
	maxRequestConcurrencyPlaceholder: 'Введите лимит запросов',
	migrationDescription:
		'Миграция может занять от нескольких секунд до минут в зависимости от размера хранилища. Если вы уже выполнили миграцию удалённого хранилища на другом устройстве, этот шаг можно пропустить.\n\nНачать миграцию сейчас?',
	migrationFailed: 'Ошибка миграции',
	migrationPhase1Description: 'Проверка актуальности локального состояния',
	migrationPhase2Description: 'Очистка удалённого хранилища и записей',
	migrationPhase3Description: 'Заполнение удалённого хранилища новой структурой',
	migrationProcess: 'Процесс миграции',
	minRequestInterval: 'Мин. интервал между запросами',
	minRequestIntervalDescription:
		'Ограничить минимальное время между последовательными запросами во время синхронизации. Полезно для сервисов с ограничением частоты запросов. Измените интервал в поле ниже.',
	minRequestIntervalPlaceholder: 'Введите интервал (например, 1s, 500ms)',
	miscellaneous: 'Разное',
	moduleAutoUpdate: 'Автообновление модулей',
	moduleAutoUpdateDescription: 'Автоматически обновлять установленные модули из их источников.',
	moduleManagement: 'Управление модулями',
	moduleManagementDescription:
		'Управление модулями в специальной панели. Вы можете устанавливать, удалять, обновлять, включать, отключать и редактировать модули, а также их источники.',
	moduleSourcePlaceholder: 'https://example.com/modules.json',
	moveLocal: 'Переместить локальный файл',
	moveRemote: 'Переместить удалённый файл',
	name: 'Название',
	namePlaceholder: 'Введите отображаемое имя модуля',
	noInstalledModulesFound: 'Установленные модули не найдены.',
	noMatchingModulesFound: 'Подходящие модули не найдены.',
	noModulesAvailable: 'Нет доступных модулей.',
	none: 'Нет',
	notInstalled: 'Не установлено',
	noticeStatusOnMobile: 'Уведомления о статусе на мобильных устройствах',
	noticeStatusOnMobileDescription:
		'Отображать всплывающее уведомление на мобильных устройствах во время синхронизации. Заменяет строку состояния, используемую на ПК.',
	omittedInvalidEntry: 'Пропущено недействительных записей: {{count}}.',
	openPanel: 'Открыть панель',
	realtimeSync: 'Синхронизация в реальном времени',
	realtimeSyncDescription:
		'Запускать синхронизацию автоматически сразу после изменения файлов. Измените задержку между изменением файла и запуском синхронизации в поле ниже.',
	realtimeSyncFastMode: 'Быстрый режим синхронизации в реальном времени',
	realtimeSyncFastModeDescription:
		'Использовать кэшированные данные и избегать лишней проверки удалённых файлов во время синхронизации в реальном времени для ускорения процесса.',
	realtimeSyncPlaceholder: 'Введите задержку (например, 500ms, 5s)',
	recordsCleared: 'Записи очищены',
	remoteMigration: 'Миграция удалённого хранилища',
	remove: 'Удалить',
	removeLocal: 'Удалить локальный файл',
	removeRecord: 'Удалить запись',
	removeRemote: 'Удалить удалённый файл',
	renameAndKeepBoth: 'Переименовать и оставить оба',
	resolveConflict: 'Разрешить конфликт',
	save: 'Сохранить',
	scheduledSync: 'Синхронизация по расписанию',
	scheduledSyncDescription:
		'Периодически запускать синхронизацию через заданные интервалы времени. Измените интервал в поле ниже.',
	scheduledSyncPlaceholder: 'Введите интервал (например, 10min, 0.5h)',
	searchModules: 'Поиск модулей',
	selectAll: 'Выбрать все',
	showInstalledOnly: 'Только установленные',
	showProgress: 'Показывать прогресс',
	skip: 'Пропустить',
	sourcesDescription:
		'Добавьте URL-адреса источников модулей. Пустые и недействительные строки будут пропущены при сохранении.',
	startMigration: 'Начать миграцию',
	startNonInteractiveSync: 'Запустить фоновую синхронизацию',
	startSync: 'Запустить синхронизацию',
	startupSync: 'Синхронизация при запуске',
	startupSyncDescription:
		'Автоматически запускать синхронизацию при старте плагина после указанной задержки. Измените задержку в поле ниже.',
	startupSyncPlaceholder: 'Введите задержку (например, 5s, 1min)',
	stopSync: 'Остановить синхронизацию',
	syncProgress: 'Прогресс синхронизации',
	syncStrategy: 'Стратегия синхронизации',
	syncStrategyDescription:
		'Выберите стратегию синхронизации для обработки изменений в файлах. Дополнительные стратегии доступны в модулях.',
	toggleWithoutMigration: 'Переключить без миграции',
	unknownModule: 'Неизвестный модуль',
	unknownModuleDescription: (frag, { fileName, size, path, mtime, ctime }) => {
		const p1 = frag.createEl('p');
		p1.appendText('Sync Engine обнаружил установленный модуль с именем ');
		p1.createEl('code', { text: fileName });
		p1.appendText(
			' в своей директории модулей. Этот модуль не зарегистрирован в панели Sync Engine и не числится в списке исключений для проверки происхождения. ',
		);
		p1.createEl('strong', {
			text: 'Пожалуйста, внимательно ознакомьтесь с информацией ниже перед продолжением:',
		});
		const ul = frag
			.createDiv(
				'rounded-lg border border-[--background-modifier-border] bg-[--background-secondary] px-2',
			)
			.createEl('ul');
		const li1 = ul.createEl('li');
		li1.appendText('Имя файла: ');
		li1.createEl('code', { text: fileName });
		const li2 = ul.createEl('li');
		li2.appendText('Путь к файлу: ');
		li2.createEl('code', { text: path });
		const li3 = ul.createEl('li');
		li3.appendText('Размер: ');
		li3.createEl('code', { text: size });
		const li4 = ul.createEl('li');
		li4.appendText('Дата создания: ');
		li4.createEl('code', { text: ctime });
		const li5 = ul.createEl('li');
		li5.appendText('Дата изменения: ');
		li5.createEl('code', { text: mtime });
		const p2 = frag.createEl('p');
		p2.createEl('strong', {
			text: 'Пожалуйста, избегайте загрузки модулей из неизвестных источников, так как это может быть вредоносной атакой.',
		});
		p2.appendText(
			' Если вы не знаете, откуда появился этот модуль, лучше всего сразу удалить его. Если вы сами создали этот модуль и это сделано намеренно, вы можете выбрать «Настроить» и включить его.',
		);
	},
	updateAvailable: 'Доступно обновление',
	updateModule: 'Обновить модуль',
	updateSource: 'Источник обновлений',
	updateSourceDescription:
		'Укажите источник, из которого этот модуль будет получать обновления. Оставьте поле пустым, чтобы отключить обновления.',
	updateSourcePlaceholder: 'https://example.com/modules.json',
	upload: 'Загрузить',
	walkingRemote: 'Сканирование удалённых файлов',
};

export default ru;
