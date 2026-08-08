import type { S3Translations } from './setting';

export const en: S3Translations = {
	accessKeyId: 'Access key ID',
	accessKeyIdDescription: 'Enter your S3 access key ID.',
	accessKeyIdPlaceholder: 'E.g. AKIAI...',
	bucket: 'Bucket name',
	bucketDescription: 'Enter the name of your S3 bucket.',
	bucketPlaceholder: 'my-bucket',
	endpoint: 'Endpoint URL',
	endpointDescription: 'Enter the S3 endpoint URL',
	endpointPlaceholder: 'E.g. https://s3.us-east-1.amazonaws.com',
	prefix: 'Prefix',
	prefixDescription:
		'Configure the key prefix that your vault will be synced to. "/" stands for the root of the bucket.',
	prefixPlaceholder: 'E.g. my-vault/',
	proxyUrl: 'Proxy URL',
	proxyUrlDescription:
		'Optional proxy URL to route S3 requests through. Leave empty to connect directly.',
	proxyUrlPlaceholder: 'E.g. https://proxy.example.com',
	region: 'Region',
	regionDescription: 'Enter the region of your S3 bucket.',
	regionPlaceholder: 'E.g. us-east-1',
	s3: 'S3',
	secretAccessKey: 'Secret access key',
	secretAccessKeyDescription:
		'Enter your S3 secret access key. It is stored in Obsidian keychain.',
	urlStyle: 'URL style',
	urlStyleDescription: (frag) => {
		frag.appendText('Select the URL style for your S3 service. Virtual-hosted style: ');
		frag.createEl('code', { text: 'https://bucket.s3.amazonaws.com' });
		frag.appendText('. Path style: ');
		frag.createEl('code', { text: 'https://s3.amazonaws.com/bucket' });
		frag.appendText('. Some S3-compatible services require path style.');
	},
	urlStylePath: 'Path style',
	urlStyleVirtualHosted: 'Virtual-hosted',
};

export const zh: S3Translations = {
	accessKeyId: 'Access Key ID',
	accessKeyIdDescription: '请输入您的 S3 Access Key ID。',
	accessKeyIdPlaceholder: '例如：AKIAI...',
	bucket: '存储桶名称（Bucket）',
	bucketDescription: '请输入您的 S3 存储桶名称。',
	bucketPlaceholder: 'my-bucket',
	endpoint: '端点 URL',
	endpointDescription: '请输入 S3 端点 URL',
	endpointPlaceholder: '例如：https://s3.us-east-1.amazonaws.com',
	prefix: '前缀',
	prefixDescription: '配置 Vault 将同步到的键前缀。"/" 代表存储桶根目录。',
	prefixPlaceholder: '例如：my-vault/',
	proxyUrl: '代理 URL',
	proxyUrlDescription: '可选的代理 URL，用于路由 S3 请求。留空则直接连接。',
	proxyUrlPlaceholder: '例如：https://proxy.example.com',
	region: '区域',
	regionDescription: '请输入您的 S3 存储桶所在的区域。',
	regionPlaceholder: '例如：us-east-1',
	s3: 'S3',
	secretAccessKey: 'Secret Access Key',
	secretAccessKeyDescription:
		'请输入您的 S3 Secret Access Key。它将安全地存储在 Obsidian 密钥环中。',
	urlStyle: 'URL 样式',
	urlStyleDescription: (frag) => {
		frag.appendText('选择适用于您的 S3 服务的 URL 样式。虚拟主机样式（Virtual-hosted）：');
		frag.createEl('code', { text: 'https://bucket.s3.amazonaws.com' });
		frag.appendText('。路径样式（Path）：');
		frag.createEl('code', { text: 'https://s3.amazonaws.com/bucket' });
		frag.appendText('。某些 S3 兼容的服务要求使用路径样式。');
	},
	urlStylePath: '路径样式（Path）',
	urlStyleVirtualHosted: '虚拟主机样式（Virtual-hosted）',
};

export const ru: S3Translations = {
	accessKeyId: 'Идентификатор ключа доступа',
	accessKeyIdDescription: 'Введите ваш идентификатор ключа доступа S3.',
	accessKeyIdPlaceholder: 'Например, AKIAI...',
	bucket: 'Имя бакета',
	bucketDescription: 'Введите имя вашего бакета S3.',
	bucketPlaceholder: 'my-bucket',
	endpoint: 'URL-адрес конечной точки',
	endpointDescription: 'Введите URL-адрес конечной точки S3.',
	endpointPlaceholder: 'Например, https://s3.us-east-1.amazonaws.com',
	prefix: 'Префикс',
	prefixDescription:
		'Настройте префикс ключа, с которым будет синхронизироваться ваше хранилище. «/» обозначает корень бакета.',
	prefixPlaceholder: 'Например, my-vault/',
	proxyUrl: 'URL-адрес прокси',
	proxyUrlDescription:
		'Необязательный URL-адрес прокси для маршрутизации запросов S3. Оставьте пустым для прямого подключения.',
	proxyUrlPlaceholder: 'Например, https://proxy.example.com',
	region: 'Регион',
	regionDescription: 'Введите регион вашего бакета S3.',
	regionPlaceholder: 'Например, us-east-1',
	s3: 'S3',
	secretAccessKey: 'Секретный ключ доступа',
	secretAccessKeyDescription:
		'Введите ваш секретный ключ доступа S3. Он хранится в связке ключей Obsidian keychain.',
	urlStyle: 'Стиль URL',
	urlStyleDescription: (frag) => {
		frag.appendText('Выберите стиль URL для вашего сервиса S3. Стиль виртуального хостинга: ');
		frag.createEl('code', { text: 'https://bucket.s3.amazonaws.com' });
		frag.appendText('. Путевой стиль: ');
		frag.createEl('code', { text: 'https://s3.amazonaws.com/bucket' });
		frag.appendText('. Некоторые S3-совместимые сервисы требуют использования путевого стиля.');
	},
	urlStylePath: 'Путевой стиль',
	urlStyleVirtualHosted: 'Стиль виртуального хостинга',
};

export const zhTW: S3Translations = {
	accessKeyId: '存取金鑰 ID',
	accessKeyIdDescription: '輸入您的 S3 存取金鑰 ID。',
	accessKeyIdPlaceholder: '例如 AKIAI...',
	bucket: '儲存桶名稱',
	bucketDescription: '輸入您的 S3 儲存桶名稱。',
	bucketPlaceholder: 'my-bucket',
	endpoint: '端點 URL',
	endpointDescription: '輸入 S3 端點 URL',
	endpointPlaceholder: '例如 https://s3.us-east-1.amazonaws.com',
	prefix: '前綴路徑',
	prefixDescription: '設定儲存庫同步目標的 Key 前綴路徑。「/」代表儲存桶的根目錄。',
	prefixPlaceholder: '例如 my-vault/',
	proxyUrl: '代理伺服器 URL',
	proxyUrlDescription: '可選的代理伺服器 URL，用來轉發 S3 請求。若留空則為直連。',
	proxyUrlPlaceholder: '例如 https://proxy.example.com',
	region: '區域',
	regionDescription: '輸入您 S3 儲存桶所在的區域。',
	regionPlaceholder: '例如 us-east-1',
	s3: 'S3',
	secretAccessKey: '私密存取金鑰',
	secretAccessKeyDescription: '輸入您的 S3 私密存取金鑰。其將儲存於 Obsidian 金鑰圈中。',
	urlStyle: 'URL 樣式',
	urlStyleDescription: (frag) => {
		frag.appendText('選擇您 S3 服務的 URL 樣式。虛擬主機樣式（Virtual-hosted style）：');
		frag.createEl('code', { text: 'https://bucket.s3.amazonaws.com' });
		frag.appendText('。路徑樣式（Path style）：');
		frag.createEl('code', { text: 'https://s3.amazonaws.com/bucket' });
		frag.appendText('。某些相容 S3 的服務需要使用路徑樣式。');
	},
	urlStylePath: '路徑樣式',
	urlStyleVirtualHosted: '虛擬主機樣式',
};
