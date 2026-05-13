<h1 align="center">
    <img src="assets/logo.svg" alt="Obsidian WebDAV Sync logo" width="280px">
    <br />
    Obsidian WebDAV Sync
    <br />
</h1>

<h4 align="center">General-purpose & bidirectional WebDAV syncing for your vault.</h4>

<p align="center">
    <a href="https://github.com/hesprs/obsidian-webdav-sync/releases/latest">
        <img src="https://img.shields.io/github/downloads/hesprs/obsidian-webdav-sync/main.js?style=flat&label=%E2%AC%87%20Downloads&labelColor=008811&color=333333&displayAssetName=false" alt="accumulated downloads">
    </a>
    <a href="https://github.com/hesprs/obsidian-webdav-sync/actions">
        <img src="https://img.shields.io/github/actions/workflow/status/hesprs/obsidian-webdav-sync/ci.yml?style=flat&logo=github&logoColor=white&label=CI&labelColor=d4ab00&color=333333" alt="ci">
    </a>
    <img src="https://img.shields.io/badge/Types-Strict-333333?logo=typescript&labelColor=blue&logoColor=white" alt="TypeScript">
</p>

<p align="center">
    <a href="./assets/README.zh-Hans.md">
        <strong>简体中文</strong>
    </a> • 
    <a href="https://community.obsidian.md/plugins/webdav-sync">
        <strong>Plugin Store</strong>
    </a> • 
    <a href="#ongoing-polling">
        <strong>Polling</strong>
    </a> • 
    <a href="#license-copyright-and-originality">
        <strong>License</strong>
    </a>
</p>

## Introduction

Obsidian WebDAV Sync is a general-purpose syncing plugin for Obsidian via a WebDAV server.

There's already a lot of plugins to sync your notes between devices. But when we have a look at the syncing plugin landscape, we can clearly see that each plugin has its own disadvantages that prevents you from using it:

- [Remotely Save](https://github.com/remotely-save/remotely-save): full-featured syncing plugin, but currently unmaintained and full of bugs (like [deleted files come back](https://github.com/remotely-save/remotely-save/issues/985)).
- [Syncthing Integration](https://github.com/LBF38/obsidian-syncthing-integration): a great way of P2P syncing, but requires both of your devices to be online, not 24/7.
- [Live Sync](https://github.com/vrtmrz/obsidian-livesync): most robust solution in the room, but requires custom server setup.
- [Git Integration](https://github.com/Vinzent03/obsidian-git): ideal for production-level collaboration and provenance, but not suitable for daily usage.
- Vendor-specific Syncing Plugin (like [Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync)): tailored experiences, but locked to a single vendor.

Acknowledging that WebDAV would be the most convenient DIY solution for syncing, this plugin comes to provide a balanced experience of day-to-day convenience, easy setup, and the robustness that doesn't make your notes into a chaos.

## Ongoing Polling

📢 Here's ongoing polling about new directions in development! I recommend **everyone who sees this** participate in the 5-second anonymous polling to allow developers to obtain a fair result.

- 🗳️ [Is `Smart Merge` worth the overhead?](https://github.com/hesprs/obsidian-webdav-sync/discussions/117)

## Features

🔄 **Reliable Bidirectional Syncing**:

- This plugin syncs your vault with a WebDAV storage.
- It does three-way comparison: remote state, local state, and recorded local & remote states of last sync
- Then it follows a decision matrix for maximum precision and data integrity, detail see [this page](https://hesprs.github.io/projects/obsidian-webdav-sync#technical-breakdown).

🔀 **Auto Sync and Conflict Handling**:

- The plugin supports automatically triggered sync as follows:
  - **Startup sync**: trigger a sync when Obsidian starts.
  - **Scheduled sync**: trigger syncs periodically.
  - **Real-time sync**: trigger syncs immediately when a change is detected.
- The plugin supports conflict handling methods:
  - Smart merge
  - Latest survive
  - Use remote
  - Use local
  - Skip

🔐 **Client-side Encryption**:

- This plugin supports encrypting your files before uploading.
- It prevents unauthorized file access, and detects unintended file modification and movement at remote side.
- The encryption pipeline assumes stricter threat model, and achieves **theoretically higher security, faster performance and smaller plugin size** than similar solutions (like Remotely Save), see detail in the [encryption specification](https://github.com/hesprs/obsidian-webdav-sync/blob/main/docs/encryption.md).

⚡ **Maximum Performance**:

- Most sync operations are performed via parallelized network requests.
- Real-time sync uses cached remote states by default, allowing it to complete syncing within seconds.
- **10 times** smaller size than Remotely Save, **8 times** faster startup loading time.

🧰 **Detailed Config**:

- The plugin allows users to adjust various parameters to adapt for various services:
  - **Max concurrent WebDAV requests**: deal with service rate limiting.
  - **Min time between WebDAV requests**: deal with service rate limiting.
  - **Skip large files**: handle low storage space.
  - **Max concurrent sync tasks**: control CPU and disk usage.
  - **Max concurrent throughput**: control memory usage and prevent crashes.

📦 **Production-Level Scalability**:

- Handles vaults with more than 3000 files smoothly.
- Load balancing and download chunking allows the plugin to handle gigabytes at once.
- Large file downloading is resumable.

🎨 **Excellent UI and Observability**:

- Four ways (modals, status bar, notices, logs) to keep you aware of the syncing progress.
- File changes are rendered as a file tree to allow granular selective syncing.
- Log utility outputs human-readable markdown documents.

## Install & Setup

You can install it from Obsidian plugin registry:

1. Go to **Community plugins** and search for `WebDAV Sync`
2. Find the one made by `Hēsperus`
3. Install and enable it

Configuration:

1. Enter WebDAV server URL
2. Enter account + credential
3. Click **Check connection**
4. Select remote directory
5. Start sync

## Common Questions

<details><summary>Does this plugin support syncing Obsidian config folder (.obsidian)?</summary>

Yes, but this folder is excluded from syncing by default. To sync specific files or folders inside, (for example, Obsidian settings), you can go to plugin settings - `Filter Rules` - `Inclusion rules` and add a new rule `.obsidian/app.json`.

To sync the entire folder, which includes all settings, CSS snippets, and plugins, go to plugin settings - `Filter Rules` - `Exclusion rules`, and remove `.obsidian`.

</details>

<details><summary>Why 401 unauthorized error happens?</summary>

The most likely cause of this error is the rate limit of your WebDAV provider. You can adjust the rate control in the plugin settings.

Detailed solution is in [this issue](https://github.com/hesprs/obsidian-webdav-sync/issues/57).

</details>

<details><summary>What should I do if I get an error during syncing?</summary>

You can simply retry the sync. An error does not block later syncs nor corrupt your files.

If the error persists after retrying, please [open an issue](https://github.com/hesprs/obsidian-webdav-sync/issues/new), describing the error, your setup, with the support log attached.

</details>

<details><summary>How should I manage my WebDAV storage when using this plugin?</summary>

According to this plugin's [file handling strategy](https://hesprs.github.io/projects/obsidian-webdav-sync#technical-breakdown), all remote changes will be propagated to all vaults. So it's generally not recommended to manually manage your WebDAV storage unless you intend to add / remove these files.

The only scenario you may need to manually delete some files happens when you exclude some files that were previously synced, now they will not be detected but remain on your WebDAV. These files are kept on remote to prevent false deletion. If you are sure that you have excluded these files in ALL your devices, you can manually clean up these files on your WebDAV.

</details>

## Development Roadmap

Below is a list of planned features and improvements, the faster this plugin is adopted and the star ⭐ grows, the faster the development will be. Also, we welcome contributors that would like to help us with the development.

- [x] Support syncing files in the Obsidian config folder (`.obsidian/`)
- [x] Saving WebDAV credentials in Obsidian Keychain
- [x] Allow users to adjust rate and concurrency limits
- [x] Enhance observability of sync progress
- [x] Implement encryption like the one in Remotely Save
- [x] Implement auto load balancer and download chunking to prevent Obsidian crash on large size files
- [x] Refurbish sync selection UI
- [ ] Rebuild in V3 with drastically faster syncing, runtime backend driver loading, and cleaner architecture.

## License, Copyright, and Originality

Obsidian WebDAV Sync is forked from [Obsidian Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync) and has undergone significant overhaul with focuses on universality, performance, and stability, licensed under the [AGPL-3.0 License](hhttps://www.gnu.org/licenses/agpl-3.0.en.html).

<!-- Aggregated code line changes: Nutstore = 49577, Hesprs + collaborators = 99781, ratio remained: 37% -->

Although this project is not affiliated with Nutstore, thanks to Nutstore for their prototype and opensource. About 33% (till May 2 2026) of the effort is contributed by Nutstore.

Copyright ©️ 2026 Hesprs (Hēsperus), 2025-2026 Nutstore
