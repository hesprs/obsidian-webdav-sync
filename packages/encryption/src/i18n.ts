import type { EncryptionTranslations } from './setting';

export const en: EncryptionTranslations = {
	encryption: 'Encryption',
	encryptionDescription:
		'Encrypt files before upload and decrypt files when download. Encryption password is stored in Obsidian keychain.',
	encryptionMigration: (frag, mode) => {
		if (mode === 'enable') {
			frag.createEl('p', {
				text: '⚠️ You should be cautious about following points before enabling encryption:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', { text: 'All subsequent uploads will be encrypted.' });
			ol.createEl('li', { text: 'Please ensure all devices have encryption enabled.' });
			ol.createEl('li', {
				text: 'Migration is necessary if you have previously synced without encryption.',
			});
			const li = ol.createEl('li', {
				text: 'You should ensure all the items are identical on all your devices:',
			});
			const ul = li.createEl('ul');
			const subItems = ['encryption password', 'server URL', 'account name'];
			subItems.forEach((item) => ul.createEl('li', { text: item }));
			ol.createEl('li', {
				text: "The encryption algorithm binds the decryption key to the file location and server identity, this provides much better security and data integrity. But it also means that if you use a different server or moving a file to a different location without using the same algorithm, you won't be able to decrypt it.",
			});
			ol.createEl('li', {
				text: 'Please avoid managing encrypted files manually on the server.',
			});
		} else {
			frag.createEl('p', {
				text: '⚠️ You should be cautious about following points before disabling encryption:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: 'All subsequent uploads will be in plaintext without encryption.',
			});
			ol.createEl('li', { text: 'Please ensure all devices have encryption disabled.' });
			ol.createEl('li', {
				text: 'Migration is necessary if this vault was previously uploaded with encryption.',
			});
		}
	},
};

export const zh: EncryptionTranslations = {
	encryption: '加密',
	encryptionDescription:
		'在上传前加密文件，并在下载时解密文件。加密密码将存储在 Obsidian keychain 中。',
	encryptionMigration: (frag, mode) => {
		if (mode === 'enable') {
			frag.createEl('p', { text: '⚠️ 在启用加密之前，您需要注意以下几点：' });
			const ol = frag.createEl('ol');
			ol.createEl('li', { text: '后续的所有上传都将被加密。' });
			ol.createEl('li', { text: '请确保所有设备都已启用加密。' });
			ol.createEl('li', {
				text: '如果您之前在未加密的状态下进行过同步，则需要进行数据迁移。',
			});
			const li = ol.createEl('li', { text: '您应当确保以下内容在您的所有设备上完全一致：' });
			const ul = li.createEl('ul');
			const subItems = ['加密密码', '服务器 URL', '账户名称'];
			subItems.forEach((item) => ul.createEl('li', { text: item }));
			ol.createEl('li', {
				text: '该加密算法会将解密密钥与文件位置及服务器身份进行绑定，这提供了更好的安全性和数据完整性。但这也意味着，如果您使用了不同的服务器，或者在没有使用相同算法的情况下将文件移动到了其他位置，您将无法对其进行解密。',
			});
			ol.createEl('li', { text: '请避免在服务器上手动管理已加密的文件。' });
		} else {
			frag.createEl('p', { text: '⚠️ 在禁用加密之前，您需要注意以下几点：' });
			const ol = frag.createEl('ol');
			ol.createEl('li', { text: '后续的所有上传都将以明文形式进行，不再加密。' });
			ol.createEl('li', { text: '请确保所有设备都已禁用加密。' });
			ol.createEl('li', {
				text: '如果此 vault 之前是在加密状态下上传的，则需要进行数据迁移。',
			});
		}
	},
};

export const zhTW: EncryptionTranslations = {
	encryption: '加密',
	encryptionDescription:
		'在上傳前加密檔案，並在下載時解密檔案。加密密碼儲存於 Obsidian 金鑰圈中。',
	encryptionMigration: (frag, mode) => {
		if (mode === 'enable') {
			frag.createEl('p', {
				text: '⚠️ 在啟用加密前，請務必留意以下幾點：',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', { text: '後續的所有上傳都將進行加密。' });
			ol.createEl('li', { text: '請確保所有裝置皆已啟用加密。' });
			ol.createEl('li', {
				text: '若您先前曾於未加密的狀態下進行同步，則必須執行遷移。',
			});
			const li = ol.createEl('li', {
				text: '您應確保所有裝置上的以下項目完全一致：',
			});
			const ul = li.createEl('ul');
			const subItems = ['加密密碼', '伺服器 URL', '帳號名稱'];
			subItems.forEach((item) => ul.createEl('li', { text: item }));
			ol.createEl('li', {
				text: '加密演算法會將解密金鑰與檔案位置及伺服器識別資訊綁定，這能提供極佳的安全性與資料完整性。但也意味著若您使用不同的伺服器，或在未透過相同演算法的情況下將檔案移動至不同位置，您將無法解密該檔案。',
			});
			ol.createEl('li', {
				text: '請避免在伺服器端手動管理加密檔案。',
			});
		} else {
			frag.createEl('p', {
				text: '⚠️ 在停用加密前，請務必留意以下幾點：',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: '後續的所有上傳都將以未加密的明文形式進行。',
			});
			ol.createEl('li', { text: '請確保所有裝置皆已停用加密。' });
			ol.createEl('li', {
				text: '若此儲存庫先前是在啟用加密的狀態下上傳，則必須執行遷移。',
			});
		}
	},
};

export const ru: EncryptionTranslations = {
	encryption: 'Шифрование',
	encryptionDescription:
		'Шифровать файлы перед загрузкой на сервер и расшифровывать их при скачивании. Пароль шифрования хранится в связке ключей Obsidian keychain.',
	encryptionMigration: (frag, mode) => {
		if (mode === 'enable') {
			frag.createEl('p', {
				text: '⚠️ Пожалуйста, будьте внимательны к следующим моментам перед включением шифрования:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', { text: 'Все последующие загрузки будут зашифрованы.' });
			ol.createEl('li', {
				text: 'Пожалуйста, убедитесь, что шифрование включено на всех устройствах.',
			});
			ol.createEl('li', {
				text: 'Миграция необходима, если ранее вы синхронизировали данные без шифрования.',
			});
			const li = ol.createEl('li', {
				text: 'Убедитесь, что следующие параметры совпадают на всех ваших устройствах:',
			});
			const ul = li.createEl('ul');
			const subItems = ['пароль шифрования', 'URL-адрес сервера', 'имя аккаунта'];
			subItems.forEach((item) => ul.createEl('li', { text: item }));
			ol.createEl('li', {
				text: 'Алгоритм шифрования привязывает ключ расшифровки к расположению файла и идентификатору сервера, что обеспечивает гораздо более высокую безопасность и целостность данных. Но это также означает, что при использовании другого сервера или перемещении файла в другое место без использования того же алгоритма вы не сможете его расшифровать.',
			});
			ol.createEl('li', {
				text: 'Пожалуйста, избегайте ручного управления зашифрованными файлами на сервере.',
			});
		} else {
			frag.createEl('p', {
				text: '⚠️ Пожалуйста, будьте внимательны к следующим моментам перед отключением шифрования:',
			});
			const ol = frag.createEl('ol');
			ol.createEl('li', {
				text: 'Все последующие загрузки будут выполняться в открытом виде без шифрования.',
			});
			ol.createEl('li', {
				text: 'Пожалуйста, убедитесь, что шифрование отключено на всех устройствах.',
			});
			ol.createEl('li', {
				text: 'Миграция необходима, если это хранилище (vault) ранее загружалось с включённым шифрованием.',
			});
		}
	},
};
