<h1 align="center">
    Obsidian WebDAV Sync
    <br />
</h1>

<h4 align="center">Sync your Obsidian notes with any WebDAV service.</h4>

<p align="center">
    <img src="https://img.shields.io/badge/Types-Strict-333333?logo=typescript&labelColor=blue&logoColor=white" alt="TypeScript">
</p>

<p align="center">
    <a href="./assets/README.zh-Hans.md">
        <strong>简体中文</strong>
    </a> • 
    <a href="#license-and-copyright">
        <strong>License</strong>
    </a>
</p>

## Introduction

Obsidian WebDAV Sync is a general-purpose syncing plugin for Obsidian with via a WebDAV server.

There's already a lot of plugins to sync your notes between devices in Obsidian. But when we have a look at the syncing plugin landscape, we can clearly see that each plugin has its own disadvantages that prevents you from using it:

- [Remotely Save](https://github.com/remotely-save/remotely-save): full-featured syncing plugin, but currently unmaintained and full of bugs (like [deleted files come back](https://github.com/remotely-save/remotely-save/issues/985)).
- [Syncthing Integration](https://github.com/LBF38/obsidian-syncthing-integration): a great way of P2P syncing, but requires both of your devices to be online, not 24/7.
- [Live Sync](https://github.com/vrtmrz/obsidian-livesync): most robust solution in the room, but requires custom server setup.
- [Git Integration](https://github.com/Vinzent03/obsidian-git): ideal for production-level collaboration and provenance, but not suitable for daily usage.
- Vendor-specific Syncing Plugin (like [Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync)): tailored experiences, but locked to a single vendor.

Acknowledging that WebDAV would be the most convenient DIY solution for syncing, this plugin comes to provide a balanced experience of day-to-day convenience, easy setup, and the robustness that doesn't make your deleted notes into a chaos.

## Features

- 🔄 **Bidirectional syncing** between local vault and remote WebDAV
- ⚡ **Incremental remote traversal** with cached acceleration, [elaborated in the code map](codemap.md#remote-cache)
- 📁 **WebDAV explorer** for exploring remote directories
- 🔀 **Conflict handling**:
  - Smart merge (diff/merge-based)
  - Latest-version strategy
  - Skip strategy
- 🚀 **Strict / loose sync modes** for different vault sizes
- 📦 **Large file skipping** via configurable size threshold
- 🔁 **Robust file presence handling** that doesn't mess up your notes like Remotely Save, [elaborated in the code map](codemap.md#remotelocal-presence-resolution)

## Setup

1. Enter WebDAV server URL
2. Enter account + credential
3. Click **Check connection**
4. Select remote directory
5. Start sync

## Notes

- Initial sync may take longer for large vaults
- Backup important notes before first sync
- The file presence resolution and note merging are robust, but not perfect

## Development Roadmap

Below is a list of planned features and improvements, the faster this plugin is adopted and the stars ⭐ grows, the faster the development will be. Also, we welcome contributors that would like to help us with the development.

- [ ] Support syncing files in the Obsidian config folder (`.obsidian/`)
- [ ] Saving WebDAV credentials in Obsidian Keychain
- [ ] Allow users to adjust rate and concurrency limits

## License and Copyright

Obsidian WebDAV Sync is forked from [Obsidian Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync), licensed under the [AGPL-3.0 License](hhttps://www.gnu.org/licenses/agpl-3.0.en.html).

Copyright ©️ 2025-2026, YiJing Network (for unchanged parts)<br>
Copyright ©️ 2026 Hesprs (Hēsperus) (for modifications)
