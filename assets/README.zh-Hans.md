<h1 align="center">
    <img src="./logo.svg" alt="Obsidian WebDAV Sync logo" width="280px">
    <br />
    Obsidian WebDAV Sync
    <br />
</h1>

<h4 align="center">为您的 Vault 提供通用且双向的 WebDAV 同步功能。</h4>

<p align="center">
    <a href="https://github.com/hesprs/obsidian-webdav-sync/releases/latest">
        <img src="https://img.shields.io/github/downloads/hesprs/obsidian-webdav-sync/main.js?style=flat&label=%E2%AC%87%20%E4%B8%8B%E8%BD%BD%E9%87%8F&labelColor=008811&color=333333&displayAssetName=false" alt="累计下载量">
    </a>
    <a href="https://github.com/hesprs/obsidian-webdav-sync/actions">
        <img src="https://img.shields.io/github/actions/workflow/status/hesprs/obsidian-webdav-sync/ci.yml?style=flat&logo=github&logoColor=white&label=CI&labelColor=d4ab00&color=333333" alt="ci">
    </a>
    <img src="https://img.shields.io/badge/Types-Strict-333333?logo=typescript&labelColor=blue&logoColor=white" alt="TypeScript">
</p>

<p align="center">
    <a href="../README.md">
        <strong>English</strong>
    </a> • 
    <a href="https://community.obsidian.md/plugins/webdav-sync">
        <strong>插件商店</strong>
    </a> •
    <a href="#公告">
        <strong>公告</strong>
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

## 公告

### 📢 V3 版本即将到来

**超大规模更新** V3 正在[积极开发中](https://github.com/hesprs/obsidian-webdav-sync/pull/155)，即将发布。该版本经过完全重写，将显著提升同步性能，大幅缩短加载时间，并带来革命性的可扩展性。更重要的是，在新架构下，支持 S3、GDrive 等其他云服务将变得轻而易举。

**但请注意，V3 与当前的 V2 版本存在根本性的不兼容。现有用户在更新时可能会遇到配置失效等问题。** 在 V3 正式发布前，我们将提供详细的升级指南，说明具体变更内容以及如何从 V2 安全迁移至 V3。

### 📢 诚邀您参与投票

关于插件未来开发方向的投票正在进行中！建议**所有看到此公告的用户**都花 5 秒钟参与一下匿名投票，帮助开发者获得更公平的反馈结果。

- 🗳️ [`Smart Merge` 功能是否值得保留？](https://github.com/hesprs/obsidian-webdav-sync/discussions/117)

## 功能特性

🔄 **可靠的双向同步**：

- 本插件将你的仓库与 WebDAV 存储进行同步。
- 它执行三方比较：远程状态、本地状态，以及上次同步时记录的本地和远程状态。
- 随后遵循决策矩阵以实现最高精度和数据完整性，详情请见[此页面](https://hesprs.github.io/projects/obsidian-webdav-sync#technical-breakdown)。

🔀 **自动同步与冲突处理**：

- 插件支持以下自动触发的同步方式：
  - **启动同步**：当 Obsidian 启动时触发同步。
  - **定时同步**：周期性触发同步。
  - **实时同步**：检测到更改时立即触发同步。
- 插件支持以下冲突处理方法：
  - 智能合并
  - 最新者胜出
  - 使用远程版本
  - 使用本地版本
  - 跳过

🔐 **客户端加密**：

- 本插件支持在上传前对文件进行加密。
- 它能防止未经授权的文件访问，并检测远程端意外的文件修改和移动。
- 该加密流程基于更严格的威胁模型，相比类似解决方案（如 Remotely Save），实现了理论上更高的安全性、更快的性能和更小的插件体积，详见[加密规范](https://github.com/hesprs/obsidian-webdav-sync/blob/main/docs/encryption.md)。

⚡ **极致性能**：

- 大多数同步操作通过并行网络请求执行。
- 实时同步默认使用缓存的远程状态，使其能在数秒内完成同步。
- 体积比 Remotely Save **小 10 倍**，启动加载时间**快 8 倍**。

🧰 **详细配置**：

- 插件允许用户调整各种参数以适应不同的服务：
  - **最大并发 WebDAV 请求数**：应对服务速率限制。
  - **WebDAV 请求最小间隔时间**：应对服务速率限制。
  - **跳过大文件**：应对服务存储空间不足的情况。
  - **最大并发同步任务数**：控制 CPU 和磁盘占用。
  - **最大并发吞吐量**：控制内存使用并防止崩溃。

📦 **生产级可扩展性**：

- 流畅处理包含超过 3000 个文件的仓库。
- 负载均衡和下载分块功能使插件能够一次性处理 GB 级的数据。
- 大文件下载支持断点续传。

🎨 **优秀的用户界面与可观测性**：

- 提供四种方式（模态框、状态栏、通知、日志）让你随时了解同步进度。
- 文件更改以文件树形式呈现，支持细粒度的选择性同步。
- 日志工具输出人类可读的 Markdown 文档。

## 安装与设置

你可以从 Obsidian 插件库中安装它：

1. 进入 **社区插件** 并搜索 `WebDAV Sync`
2. 找到由 `Hēsperus` 开发的插件
3. 安装并启用它

配置步骤：

1. 输入 WebDAV 服务器 URL。
2. 输入账号及凭证。
3. 点击 **检查连接**。
4. 选择远程目录。
5. 开始同步。

## 常见问题

<details><summary>为什么插件提示我输入“ID”和“Secret”来添加 WebDAV 凭据？</summary>

仅为了配置密码却要求提供 `ID` + `Secret` 对，这可能会让人困惑。实际上，这是 Obsidian 的新密钥链（Keychain）功能。当添加新秘密时，`Secret` 是输入你真实密码的地方，而它请求的 ID 就像是一个人的名字，其唯一目的是帮助 Obsidian 区分不同的秘密，并在不直接使用秘密本身的情况下代表它们。

因此，要添加一个秘密并在凭据字段中使用它，你可以在 ID 字段中输入任何你喜欢的内容（例如 `webdav-token`），然后在 Secret 字段中输入你的真实密码。点击保存并将新秘密链接到插件即可。

</details>

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

- [x] v1.2：增强同步进度的可观测性
- [x] v1.3：允许用户调整速率和并发限制
- [x] v2.3：支持同步 Obsidian 配置文件夹（`.obsidian/`）中的文件
- [x] v2.3：将 WebDAV 凭据保存在 Obsidian 密钥链中
- [x] v2.4：实现自动负载均衡和下载分块，以防止在处理大文件时 Obsidian 崩溃
- [x] v2.4, v2.5.5：重构同步选择界面
- [x] v2.5：实现类似 Remotely Save 的加密功能
- [ ] v3.0：完全重写、动态模块加载、模块商店、非对称存储及品牌重塑

## 许可、版权与原创性

Obsidian WebDAV Sync 源自 [Obsidian Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync)，并经过重大重构，专注于通用性、性能与稳定性，采用 [AGPL-3.0 许可证](hhttps://www.gnu.org/licenses/agpl-3.0.en.html) 发布。

虽然本项目与 Nutstore 无关联，但感谢 Nutstore 提供的原型及开源贡献。截至 2026 年 6 月 12 日，约 28% 的工作量由 Nutstore 贡献。

版权所有 ©️ 2026 Hesprs (Hēsperus), 2025-2026 Nutstore
