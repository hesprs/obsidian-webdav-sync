# Migrate from V2

The v3 version of Sync Engine is released on August 7, 2026, its former name is "WebDAV Sync", which has been in production for months. The v2 to v3 transition is a complete rewrite focusing on modularity and performance; many things, **including remote file structure, storage schema, encryption formula, and plugin settings have changed completely**. A migration is required for all users that are still using v2.

## Automatic Migration

In the last two versions of WebDAV Sync (v2.5.12 and v2.5.13) contain a complete migration routine to seamlessly transform you from WebDAV Sync to Sync Engine.

At each startup, the plugin makes request to GitHub API to confirm the existence of repo `hesprs/sync-engine`, it treats the existence of this repo as the signal of the release of Sync Engine. If this repo exists, the plugin will open up a modal to prompt you to migrate to Sync Engine. The modal has two three options:

- **Proceed**: the migration will start
- **Cancel**: the migration will be prompted again on next plugin startup
- **Never show again**: the migration will be silenced forever and WebDAV Sync remains fully functional as before. You can access the migration routine from plugin settings.

If you started migration, it will perform the following:

1. Launch another turn of syncing to ensure your vault's state is aligned with the remote.
2. Read-only traverse the WebDAV to obtain the necessary `Etag` of each file, which is used by Sync Engine to identify file uniqueness.
3. Access Sync Engine module source `https://sync.consensia.cc/modules.json` to download necessary Sync Engine modules for you. The modules downloaded depends on the functions you used in WebDAV Sync:
   - Supported i18n modules if you are a non-English user.
   - Encryption module if you enabled encryption.
   - Smart merge module if your conflict strategy is "Smart merge".
4. Copy and transform existing sync records to Sync Engine store.
5. Only when all above steps succeed, local records will be deleted. And you will be prompted to Download Sync Engine from Obsidian plugin store.

If any of the 1-4 step fails, the migration will be rolled back immediately, no data will be lost.

Due to the revamped encryption schema, **WebDAV Sync encrypted files will be no longer accessible by Sync Engine's Encryption module**. So if you are using Encryption, you are required to delete remote base directory and **re-sync your vault in Sync Engine**. If you are not using encryption, you simply need to download Sync Engine from Obsidian module store and disable WebDAV Sync, then everything is done.

For seamless migration, **Sync Engine's most ingenious feature _Anchored Asymmetric Storage_ is disabled by default** if you are not using encryption (when encryption is enabled, this is left enabled since you will need to re-sync the entire vault anyway). You can enable that and use Sync Engine's built-in migration feature to transform your vault, then your every sync will be accelerated by this technology.

## Manual Migration

If you need a more transparent migration process to see what is going on around your data. You can choose manual migration, go and perform all the following:

1. Disable WLAN or mobile network temporarily to prevent WebDAV Sync performing accidental syncs.
2. Go into Obsidian, delete WebDAV Sync plugin.
3. Go to your WebDAV backend and delete the remote root directory.
4. Enable network connection, and install Sync Engine from Obsidian plugin store.
5. Install necessary modules and configure your account in Sync Engine.
6. Perform a fresh sync on one of your devices to upload your files, and delete all files on your other devices. **Please ensure the uploader device contains all the files you want to preserve**.
7. Perform sync on all other devices to download the files just uploaded.

Then the manual migration is done. This method refreshes WebDAV files completely. And "Anchored Asymmetric Storage" is enabled by default.
