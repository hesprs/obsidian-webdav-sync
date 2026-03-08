# 🔄 WebDAV Sync

## Introduction | 简介

General-purpose WebDAV sync plugin for Obsidian.
Use any RFC4918-compatible WebDAV server (e.g. Nextcloud, ownCloud, Synology, Box WebDAV).

通用 WebDAV 同步插件，适用于 Obsidian。
支持任意兼容 RFC4918 的 WebDAV 服务（例如 Nextcloud、ownCloud、群晖、Box WebDAV）。

---

## ✨ Key Features | 主要特性

- 🔄 **Two-way sync** between local vault and remote WebDAV
- ⚡ **Incremental sync** with cached traversal acceleration
- 📁 **WebDAV explorer** for selecting remote base directory
- 🔀 **Conflict handling**:
  - Smart merge (diff/merge-based)
  - Latest-version strategy
  - Skip strategy
- 🚀 **Strict / loose sync modes** for different vault sizes
- 📦 **Large file skipping** via configurable size threshold
- 📊 **Sync progress + failed task views**
- 📝 **Debug logging + cache export/import tools**

<br>

- 🔄 **本地仓库与远程 WebDAV 双向同步**
- ⚡ **增量同步**，并通过目录缓存加速扫描
- 📁 **WebDAV 文件浏览器**，用于选择远程根目录
- 🔀 **冲突处理策略**：
  - 智能合并
  - 最新版本优先
  - 跳过冲突
- 🚀 **严格 / 宽松同步模式**，适配不同规模仓库
- 📦 **大文件跳过**（可配置大小阈值）
- 📊 **同步进度与失败任务查看**
- 📝 **调试日志与缓存导入/导出**

---

## ⚙️ Setup | 配置

1. Enter WebDAV server URL
2. Enter account + credential
3. Click **Check connection**
4. Select remote directory
5. Start sync

6. 输入 WebDAV 服务器地址
7. 输入账号与凭证
8. 点击**检查连接**
9. 选择远程目录
10. 开始同步

---

## ⚠️ Notes | 注意事项

- Initial sync may take longer for large vaults
- Backup important notes before first sync

- 大型仓库首次同步可能较慢
- 首次同步前请备份重要笔记
