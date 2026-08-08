<h1 align="center">
    <img src="./docs/public/logo.svg" alt="Sync Engine logo" width="280px">
    <br />
    Sync Engine
    <br />
</h1>

<h4 align="center">The next-generation syncing plugin: Fast · Free · Extend with Modules</h4>

<p align="center">
    <a href="https://github.com/hesprs/sync-engine/releases/latest">
        <img src="https://img.shields.io/github/downloads/hesprs/sync-engine/manifest.json.svg?style=flat&label=%E2%AC%87%20Downloads&labelColor=008811&color=333333&displayAssetName=false" alt="accumulated downloads">
    </a>
    <a href="https://github.com/hesprs/sync-engine/actions">
        <img src="https://img.shields.io/github/actions/workflow/status/hesprs/sync-engine/ci.yml?style=flat&logo=github&logoColor=white&label=CI&labelColor=d4ab00&color=333333" alt="ci">
    </a>
    <a href="https://sync.consensia.cc">
        <img src="https://img.shields.io/badge/Documentation-Ready-333333?labelColor=5C73E7&logo=vitepress&logoColor=white" alt="Documentation" />
    </a>
    <img src="https://img.shields.io/badge/Types-Strict-333333?logo=typescript&labelColor=blue&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/%F0%9F%96%90%EF%B8%8F%20Made%20by-Humans-333333?labelColor=15C2C0" alt="Made by Humans">
    <a href="https://www.npmjs.com/package/@hesprs/sync-engine-sdk">
        <img src="https://img.shields.io/npm/v/@hesprs/sync-engine-sdk?logo=npm&labelColor=red&logoColor=white&color=333333" alt="npm">
    </a>
    <img src="https://img.shields.io/github/stars/hesprs/sync-engine" alt="GitHub stars">
</p>

<p align="center">
    <a href="https://github.com/hesprs/synthkernel">
        <img src="https://github.com/hesprs/synthkernel/raw/refs/heads/main/assets/powered-by-synthkernel.svg" width="200px" alt="powered by SynthKernel"></img>
    </a>
</p>

<p align="center">
    <a href="./README.zh.md">
        <strong>简体中文</strong>
    </a> • 
    <a href="https://sync.consensia.cc">
        <strong>Documentation</strong>
    </a> • 
    <a href="https://community.obsidian.md/plugins/sync-engine">
        <strong>Plugin Store</strong>
    </a> • 
    <a href="#license-copyright-and-originality">
        <strong>License</strong>
    </a>
</p>

## Introduction

Sync Engine is a revolutionary solution for vault syncing. Its not only a syncing plugin, it is a modular platform that everyone can build upon.

The core ships the infrastructure, and all backends (WebDAV, S3, GDrive) and features (i18n, optimization, sync strategy) come from composable modules. You and your AI agents can build your own modules via convenient SDK, extend the plugin, contribute to community, all without modifying the source code.

Access Sync Engine documentation at [`sync.consensia.cc`](https://sync.consensia.cc), which contains usage guides, existing modules, permission claims, benchmarking, and documentation on how to build a module.

There's already a lot of plugins to sync your notes between devices:

- [Remotely Save](https://github.com/remotely-save/remotely-save) supports many backends (S3, Dropbox, OneDrive, WebDAV). But is optionally paid, development paused for years with stability issues
- [Self-hosted LiveSync](https://github.com/vrtmrz/obsidian-livesync) and [Fast Note Sync](https://github.com/haierkeys/obsidian-fast-note-sync) offer real-time, server-based sync. They work well if you are comfortable setting up your own server.
- [Relay](https://github.com/No-Instructions/Relay) is a managed relay service. Convenient, but your notes pass through infrastructure you don't control.

Sync Engine fits the gap: you want to choose your own storage, you want the plugin to stay small because unused features aren't bundled in, and you want a highly optimized syncing that is no slower than a self-hosted server.

## Features

### Core Functions

- Bidirectional syncing.
- Startup / periodic / save-on-change syncing.
- Conflict resolution strategies (keep both / latest survive / keep remote / keep local / skip).
- Rate / memory control options.
- Custom headers.
- You can extend most above features by writing modules.

### Module-Extended ([your can develop your own](#develop-a-module))

- **Backends**: WebDAV, S3
- **Features**: Encryption, Smart Merge Conflict Resolution

### Extensible Architecture

- You can add backends, optimizers, sync triggers, i18n resources, decision strategies, conflict strategies, setting entries, custom file processing, and invoke all possible operations in custom modules.
- Documentation, AI agent skills, and SDK with debug and testing kit are provided.
- Plugin provides dedicated module discovery and management UI.
- Repo accepts any module contribution as long as it respects [contribution guide](./CONTRIBUTING.md).

### Radical Optimization

- Incremental syncing never uploads the full vault each time.
- [Anchored Asymmetric Storage](https://sync.consensia.cc/deep-dive/asymmetric-storage) technology substantially accelerates syncing.
- Real-time sync uses cached remote states, allowing it to complete within milliseconds.
- [Benchmarking shows around **100x** faster than Remotely Save in daily syncing](https://sync.consensia.cc/usage/benchmark).
- Handles vaults with thousands of files smoothly.
- No slower than a self-hosted server
- Detailed performance comparison can be found in [performance benchmark](https://sync.consensia.cc/usage/benchmark).

## Usage

1. Download and enable `Sync Engine` from Obsidian plugin store.
2. Open "Module management" panel, install needed translations, backends and optional features.
3. Fill the necessary information about your cloud service in the settings interface.
4. Start your first sync from command palette or ribbon button.
5. Review the sync tasks that will be performed.
6. Click "Confirm", and your files will arrive the configured backend at the speed of light.

## Develop a Module

Sync Engine welcomes everyone that would like to develop and contribute a module. The detailed module development documentation can be found in [Sync Engine website](https://sync.consensia.cc/development/develop-a-module). Module contribution standard see [CONTRIBUTING](https://sync.consensia.cc/usage/contributing).

## Common Questions

<details><summary>What should I do if I get an error during syncing?</summary>

You can simply retry the sync. An error does not block later syncs nor corrupt your files.

If the error persists after retrying, please [open an issue](https://github.com/hesprs/sync-engine/issues/new), describing the error, your setup, with the support log attached.

</details>

<details><summary>How should I manage my WebDAV storage when using this plugin?</summary>

According to this plugin's [file handling strategy](https://hesprs.github.io/projects/sync-engine#technical-breakdown), all remote changes will be propagated to all vaults. So it's generally not recommended to manually manage your WebDAV storage unless you intend to add / remove these files. Manual management is more discouraged when you have encryption or asymmetric storage enabled.

</details>

## Roadmap

Below is a list of planned features and improvements, the faster this plugin is adopted and the star ⭐ grows, the faster the development will be. Also, we welcome contributors that would like to help us with the development of either modules or core.

- [x] v3.0: Rewrite entirely, dynamic module loading, module store, asymmetric storage, and rebrand
- [ ] v3.1: Migrate settings to Obsidian v1.13 API

## License

The source code of Sync Engine and modules in this repository are licensed under the [MIT License](https://mit-license.org/).<br>
Documents in the documentation website are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license.

Copyright ©️ 2026 Hēsperus and All Contributors
