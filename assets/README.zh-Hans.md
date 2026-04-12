<h1 align="center">
    <img src="./logo.svg" alt="Obsidian WebDAV Sync logo" width="160px">
    <br />
    Obsidian WebDAV Sync
    <br />
</h1>

<h4 align="center">为您的 Vault 提供通用且双向的 WebDAV 同步功能。</h4>

<p align="center">
    <a href="https://github.com/hesprs/obsidian-webdav-sync/actions">
        <img src="https://img.shields.io/github/actions/workflow/status/hesprs/obsidian-webdav-sync/ci.yml?style=flat&logo=github&logoColor=white&label=CI&labelColor=d4ab00&color=333333" alt="ci">
    </a>
    <a href="https://github.com/hesprs/obsidian-webdav-sync/releases/latest">
        <img src="https://img.shields.io/github/downloads/hesprs/obsidian-webdav-sync/main.js?style=flat&label=%E2%AC%87%20%E4%B8%8B%E8%BD%BD%E9%87%8F&labelColor=008811&color=333333&displayAssetName=false" alt="累计下载量">
    </a>
    <img src="https://img.shields.io/badge/Types-Strict-333333?logo=typescript&labelColor=blue&logoColor=white" alt="TypeScript">
</p>

<p align="center">
    <a href="../README.md">
        <strong>English</strong>
    </a> • 
    <a href="#common-questions">
        <strong>Q&A</strong>
    </a> • 
    <a href="#许可版权与原创性">
        <strong>许可证</strong>
    </a>
</p>

## 简介

Obsidian WebDAV Sync 是一款通用的 Obsidian 插件，可通过 WebDAV 服务器实现数据同步。

目前 Obsidian 生态中已有许多用于设备间同步笔记的插件，但审视现有的同步插件 landscape（格局），我们可以清晰地看到每个插件都存在各自的缺陷，阻碍了用户的广泛使用：

- [Remotely Save](https://github.com/remotely-save/remotely-save)：功能全面，但目前处于维护停滞状态且充满 Bug（例如 [已删除的文件会莫名其妙地恢复](https://github.com/remotely-save/remotely-save/issues/985)）。
- [Syncthing Integration](https://github.com/LBF38/obsidian-syncthing-integration)：优秀的点对点（P2P）同步方案，但要求两台设备同时在线，无法做到 7x24 小时待命。
- [Live Sync](https://github.com/vrtmrz/obsidian-livesync)：最稳健的解决方案，但需要自行搭建定制服务器。
- [Git Integration](https://github.com/Vinzent03/obsidian-git)：适合生产级协作和版本溯源，但不适合日常高频使用。
- 厂商专用同步插件（如 [Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync)）：体验 tailored（量身定制），但被锁定在单一厂商生态中。

鉴于 WebDAV 是个人用户最便捷的 DIY 同步方案，本插件旨在提供一种平衡的体验：兼顾日常使用的便捷性、易于配置以及足够的稳健性，确保不会像 Remotely Save 那样导致已删除的笔记陷入混乱。

## 功能特性

- 🔄 **双向同步**：本地保险库与远程 WebDAV 之间实时同步。
- ⚡ **快速同步模式**：利用缓存加速机制，实现“变更即同步”的高效体验。
- 📁 **WebDAV 资源管理器**：支持浏览远程目录结构。
- 🔀 **冲突处理策略**：
  - 智能合并
  - 保留最新版本
  - 使用远程版本
  - 使用本地版本
  - 跳过文件
- 🚀 **严格 / 宽松同步模式**：适配不同规模的 vault（笔记库）。
- 📦 **大文件跳过**：通过可配置的阈值自动跳过大型文件。
- 🔁 **稳健的文件处理机制**：确保不会弄乱您的笔记。
- 📜 **轻量级本地数据库**：赋能可扩展性，确保卓越性能。

## 安装与设置

该插件目前处于测试版（Beta）。您可以通过 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件进行安装：

1. 进入 **社区插件**，搜索 `BRAT`。
2. 安装并启用该插件。
3. 打开 BRAT 设置，点击 **添加测试插件**（Add beta plugin），将 `https://github.com/hesprs/obsidian-webdav-sync` 复制粘贴到 _仓库_（Repository）字段中。
4. 选择最新版本，然后点击 **添加插件**。

配置步骤：

1. 输入 WebDAV 服务器 URL。
2. 输入账号及凭证。
3. 点击 **检查连接**。
4. 选择远程目录。
5. 开始同步。

## 常见问题

<details><summary>此插件是否支持同步 Obsidian 配置文件夹 (.obsidian)？</summary>

支持，但该文件夹默认被排除在同步范围之外。若要同步其内部特定文件或文件夹（例如 Obsidian 设置），请进入插件设置 - `过滤规则` - `包含规则`，并添加新规则 `.obsidian/app.json`。

若要同步整个文件夹（包含所有设置、CSS 片段和插件），请进入插件设置 - `过滤规则` - `排除规则`，并移除 `.obsidian`。

</details>

<details><summary>为什么会出现 401 unauthorized（未授权）错误？</summary>

此错误最可能的原因是您的 WebDAV 服务商触发了速率限制。您可以在插件设置中调整速率控制策略。

详细解决方案请参阅 [此 Issue](https://github.com/hesprs/obsidian-webdav-sync/issues/57)。

</details>

<details><summary>如果在同步过程中出现错误，我该怎么办？</summary>

您可以直接重试同步。此类错误不会阻止后续同步操作，也不会损坏您的文件。

如果重试后错误依然存在，请 [提交新 Issue](https://github.com/hesprs/obsidian-webdav-sync/issues/new)，详细描述错误信息、您的配置环境，并附上支持日志。

</details>

<details><summary>使用该插件时，我该如何管理 WebDAV 存储空间？</summary>

根据本插件的 [文件处理策略](https://hesprs.github.io/zh-Hans/projects/obsidian-webdav-sync#technical-breakdown)，所有远程端的变更都会同步至所有仓库。因此，通常不建议手动管理 WebDAV 存储，除非您有意添加或删除这些文件。

唯一可能需要手动删除文件的情况是：当您排除了某些之前已同步的文件后，插件将不再检测它们，但它们仍会保留在 WebDAV 上。这些文件被保留在远程端是为了防止误删。如果您确信已在**所有设备**上排除了这些文件，则可以手动清理 WebDAV 上的这些文件。

</details>

## 开发路线图

以下是计划中的功能列表和改进方向：该插件越是被广泛采用，获得的星星 ⭐ 越多，开发进度就会越快。我们也欢迎有意协助开发的贡献者。

- [ ] 支持同步 Obsidian 配置文件夹 (`.obsidian/`) 中的文件
- [ ] 在 Obsidian Keychain 中保存 WebDAV 凭证
- [x] 允许用户调整速率和并发限制
- [x] 增强同步进度的可观测性
- [ ] 实现端到端加密（类似 Remotely Save 的方案）

## 许可、版权与原创性

Obsidian WebDAV Sync 源自 [Obsidian Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync)，并经过重大重构，专注于通用性、性能与稳定性，采用 [AGPL-3.0 许可证](hhttps://www.gnu.org/licenses/agpl-3.0.en.html) 发布。

虽然本项目与 Nutstore 无关联，但感谢 Nutstore 提供的原型及开源贡献。截至 2026 年 4 月 11 日，约 39% 的工作量由 Nutstore 贡献。

版权所有 ©️ 2026 Hesprs (Hēsperus), 2025-2026 Nutstore
