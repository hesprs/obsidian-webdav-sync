<h1 align="center">
    Obsidian WebDAV Sync
    <br />
</h1>

<h4 align="center">将您的 Obsidian 笔记与任何 WebDAV 服务进行同步。</h4>

<p align="center">
    <img src="https://img.shields.io/badge/Types-Strict-333333?logo=typescript&labelColor=blue&logoColor=white" alt="TypeScript">
</p>

<p align="center">
    <a href="../README.md">
        <strong>English</strong>
    </a> • 
    <a href="#许可证与版权">
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
- ⚡ **增量远程遍历**：配合缓存加速机制，[详见代码映射图](codemap.md#remote-cache)。
- 📁 **WebDAV 资源管理器**：支持浏览远程目录结构。
- 🔀 **冲突处理策略**：
  - 智能合并（基于差异分析/合并）
  - 最新版本优先策略
  - 跳过策略
- 🚀 **严格 / 宽松同步模式**：适配不同规模的 vault（笔记库）。
- 📦 **大文件跳过**：通过可配置的阈值自动跳过大型文件。
- 🔁 **稳健的文件存在性检测**：解决文件残留问题，避免像 Remotely Save 那样弄乱您的笔记，[详见代码映射图](codemap.md#remotelocal-presence-resolution)。

## 设置步骤

1. 输入 WebDAV 服务器 URL。
2. 输入账号及凭证。
3. 点击 **检查连接**。
4. 选择远程目录。
5. 开始同步。

## 注意事项

- 初始同步对于大型保险库可能需要较长时间。
- 首次同步前请务必备份重要笔记。
- 文件存在性检测与笔记合并机制虽已相当稳健，但并非绝对完美。

## 开发路线图

以下是计划中的功能列表和改进方向：该插件越是被广泛采用，获得的星星 ⭐ 越多，开发进度就会越快。我们也欢迎有意协助开发的贡献者。

- [ ] 支持同步 Obsidian 配置文件夹 (`.obsidian/`) 中的文件
- [ ] 在 Obsidian Keychain 中保存 WebDAV 凭证
- [ ] 允许用户调整速率和并发限制

## 许可证与版权

Obsidian WebDAV Sync fork 自 [Obsidian Nutstore Sync](https://github.com/nutstore/obsidian-nutstore-sync)，遵循 [AGPL-3.0 许可证](https://www.gnu.org/licenses/agpl-3.0.en.html)。

版权所有 ©️ 2025-2026, YiJing Network（针对未修改部分）  
版权所有 ©️ 2026 Hesprs (Hēsperus)（针对修改部分）
