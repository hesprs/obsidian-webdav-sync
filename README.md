<h1 align="center">
    <img src="assets/logo.svg" alt="Obsidian WebDAV Sync logo" width="160px">
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
    <a href="#common-questions">
        <strong>Q&A</strong>
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

## Features

- 🔄 **Bidirectional syncing** between local vault and remote WebDAV
- ⚡ **Fast syncing mode** with cached acceleration for fast, sync-on-change syncing
- 📁 **WebDAV explorer** for exploring remote directories
- 🔀 **Conflict handling**:
  - Smart merge
  - Latest survive
  - Use remote
  - Use local
  - Skip
- 🚀 **Strict / loose sync modes** for different vault sizes
- 📦 **Large file skipping** via configurable size threshold
- 🔁 **Robust file handling** that doesn't mess up your notes
- 📜 **Lightweight local database** empowers scalability and ensures performance

## Install & Setup

This plugin is currently in beta. You can install it using the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin:

1. Go to **Community plugins** and search for `BRAT`
2. Install and enable it
3. Go to BRAT settings, click **Add beta plugin**, copy and paste `https://github.com/hesprs/obsidian-webdav-sync` into the _Repository_ field
4. Select the latest version and click **Add plugin**

Configuration:

1. Enter WebDAV server URL
2. Enter account + credential
3. Click **Check connection**
4. Select remote directory
5. Start sync

## Common Questions

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

</details>

## Development Roadmap

Below is a list of planned features and improvements, the faster this plugin is adopted and the star ⭐ grows, the faster the development will be. Also, we welcome contributors that would like to help us with the development.

- [ ] Support syncing files in the Obsidian config folder (`.obsidian/`)
- [ ] Saving WebDAV credentials in Obsidian Keychain
- [x] Allow users to adjust rate and concurrency limits
- [x] Enhance observability of sync progress
- [ ] Implement E2E encryption like the one in Remotely Save

## License, Copyright, and Originality

Obsidian WebDAV Sync is forked from [Obsidian Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync) and has undergone significant overhaul with focuses on universality, performance, and stability, licensed under the [AGPL-3.0 License](hhttps://www.gnu.org/licenses/agpl-3.0.en.html).

<!-- Aggregated code line changes: Nutstore = 49577, Hesprs + collaborators = 76018, ratio remained: 39% -->

Although this project is not affiliated with Nutstore, thanks to Nutstore for their prototype and opensource. About 39% (till April 11 2026) of the effort is contributed by Nutstore.

Copyright ©️ 2026 Hesprs (Hēsperus), 2025-2026 Nutstore
