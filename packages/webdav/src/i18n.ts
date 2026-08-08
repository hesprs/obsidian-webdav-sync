import type { WebdavTranslations } from './setting';

export const en: WebdavTranslations = {
	baseDirectory: 'Base directory',
	baseDirectoryDescription:
		'Configure the root folder on WebDAV that your vault will be synced to. "/" stands for the root directory.',
	baseDirectoryPlaceholder: 'Enter the directory',
	chunkedUpload: 'Nextcloud-style chunked upload',
	chunkedUploadDescription:
		'Enable Nextcloud-style chunked upload instead of upload the entire file directly to reduce memory pressure. Most WebDAV servers do not support chunked upload, and this is a Nextcloud-specific feature.',
	depthInfinity: 'Use "Depth: infinity"',
	depthInfinityDescription:
		'"Depth: infinity" is a special header sent to WebDAV servers, requiring them to list all files in one response. This could accelerate remote discovery but some servers may not support it. Also, there\'s zero performance benefit if you have "Asymmetric storage" enabled.',
	endpoint: 'Server URL',
	endpointDescription: 'Enter the URL of your WebDAV server.',
	endpointPlaceholder: 'https://example.com/webdav',
	password: 'Password',
	passwordDescription:
		'Enter your account password. The password is stored in Obsidian keychain.',
	username: 'Username',
	usernameDescription: 'Enter your WebDAV account username.',
	usernamePlaceholder: 'Enter your username',
	webdav: 'WebDAV',
};

export const zh: WebdavTranslations = {
	baseDirectory: '根目录',
	baseDirectoryDescription: '配置您的 vault 将同步到的 WebDAV 文件夹。 “/” 代表根目录。',
	baseDirectoryPlaceholder: '请输入目录',
	chunkedUpload: 'Nextcloud 风格分块上传',
	chunkedUploadDescription:
		'启用 Nextcloud 风格的分块上传，而不是直接上传整个文件，以减轻内存压力。大多数 WebDAV 服务器不支持分块上传，这是 Nextcloud 特有的功能。',
	depthInfinity: '使用 “Depth: infinity”',
	depthInfinityDescription:
		'“Depth: infinity” 是发送给 WebDAV 服务器的特殊请求头，要求其在单次响应中列出所有文件。这可以加速远程探测，但部分服务器可能不支持此功能。此外，如果您已启用 “非对称存储”，该功能将不会带来任何性能提升。',
	endpoint: '服务器 URL',
	endpointDescription: '请输入您的 WebDAV 服务器 URL。',
	endpointPlaceholder: 'https://example.com/webdav',
	password: '密码',
	passwordDescription: '请输入您的账户密码。密码将存储在 Obsidian 钥匙串中。',
	username: '用户名',
	usernameDescription: '请输入您的 WebDAV 账户用户名。',
	usernamePlaceholder: '请输入您的用户名',
	webdav: 'WebDAV',
};

export const ru: WebdavTranslations = {
	baseDirectory: 'Базовый каталог',
	baseDirectoryDescription:
		'Настройте корневую папку на сервере WebDAV, с которой будет синхронизироваться ваше хранилище. «/» обозначает корневой каталог.',
	baseDirectoryPlaceholder: 'Введите путь к каталогу',
	chunkedUpload: 'Загрузка частями в стиле Nextcloud',
	chunkedUploadDescription:
		'Включите загрузку файлов частями (по сегментам) в стиле Nextcloud вместо прямой отправки файла целиком для снижения нагрузки на память. Большинство серверов WebDAV не поддерживают такую загрузку — это специфическая функция Nextcloud.',
	depthInfinity: 'Использовать «Depth: infinity»',
	depthInfinityDescription:
		'«Depth: infinity» — это специальный заголовок, отправляемый на сервер WebDAV, требующий от него вернуть список всех файлов в одном ответе. Это может ускорить сканирование удалённых файлов, но некоторые серверы могут его не поддерживать. Кроме того, это не даёт прироста производительности, если включено «Асимметричное хранилище».',
	endpoint: 'URL-адрес сервера',
	endpointDescription: 'Введите URL-адрес вашего сервера WebDAV.',
	endpointPlaceholder: 'https://example.com/webdav',
	password: 'Пароль',
	passwordDescription:
		'Введите пароль от вашего аккаунта. Пароль хранится в связке ключей Obsidian keychain.',
	username: 'Имя пользователя',
	usernameDescription: 'Введите имя пользователя вашей учётной записи WebDAV.',
	usernamePlaceholder: 'Введите имя пользователя',
	webdav: 'WebDAV',
};

export const zhTW: WebdavTranslations = {
	baseDirectory: '基礎目錄',
	baseDirectoryDescription: '設定 WebDAV 上儲存庫要同步到的根資料夾。「/」代表根目錄。',
	baseDirectoryPlaceholder: '輸入目錄',
	chunkedUpload: 'Nextcloud 風格分塊上傳',
	chunkedUploadDescription:
		'啟用 Nextcloud 風格的分塊上傳以替代直接上傳完整檔案，進而降低記憶體負擔。大多數 WebDAV 伺服器不支援分塊上傳，此為 Nextcloud 特有的功能。',
	depthInfinity: '使用「Depth: infinity」',
	depthInfinityDescription:
		'「Depth: infinity」是發送給 WebDAV 伺服器的特殊標頭，要求伺服器在單一回應中列出所有檔案。這能大幅加速遠端檔案掃描，但部分伺服器可能不支援。此外，若您啟用了「非對稱儲存」，此選項將不會帶來任何效能提升。',
	endpoint: '伺服器 URL',
	endpointDescription: '輸入您 WebDAV 伺服器的 URL。',
	endpointPlaceholder: 'https://example.com/webdav',
	password: '密碼',
	passwordDescription: '輸入您的帳號密碼。密碼將儲存於 Obsidian 金鑰圈中。',
	username: '使用者名稱',
	usernameDescription: '輸入您的 WebDAV 帳號使用者名稱。',
	usernamePlaceholder: '輸入您的使用者名稱',
	webdav: 'WebDAV',
};
