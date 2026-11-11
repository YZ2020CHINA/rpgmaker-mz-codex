# RPG Maker MZ · Codex 本地插件

通过 Codex 的 MCP 工具制作 RPG Maker MZ 游戏：地图绘制、NPC 和事件、角色/物品/技能数据库、素材查询、引擎截图及自动试玩。基于 [Redseb/rpgmaker-mz-mcp](https://github.com/Redseb/rpgmaker-mz-mcp) 固定提交 `5119a9a3`，复用 128 项工具，补充 10 项本机工具，共 138 项。附中文开发 skill 和自定义图块目录 skill。

插件 logo 为 Aseprite 制作的 48×48 原创透明像素角色：黄毛朋克少年、皮夹克、金属链和香烟。`assets/logo.png` 是正式图标，`assets/punk-logo.aseprite` 是 7 层可编辑母版，`assets/punk-logo-preview.png` 是 8 倍最近邻预览。图标已配置到插件列表与输入框图标。

## Codex 中使用 Claude / GPT 调用插件（2026-11-11 更新）

这次更新后，**在 Codex 里切换到 Claude 模型（例如通过 Magpie 等中转站接入的 Claude API）也可以正常调用本插件的工具和 skill**，与使用 GPT 模型时一致。

- 已在 Codex 桌面版（Windows）实测：修复后 Claude 与 GPT 会话都能加载这组本地插件的 MCP 工具，并实际调用了 Blender、Aseprite、Flux、Stable Audio 的状态工具。
- 原因：Codex 读取插件 `mcp.json` 时只接受 `type`、`command`、`args`、`env`、`cwd`，`command` 必须是裸可执行名，并会拒绝 `startup_timeout_sec`、`tool_timeout_sec` 等字段；旧格式导致部分模型会话里插件工具不出现。
- 现在构建脚本生成的 `mcp.json` 统一使用 `cmd.exe` 调用插件目录内的 `launch-mcp.cmd`，本机 Python/Node 的绝对路径和环境变量写在启动器里。
- 已安装旧版本的用户：重新运行安装/构建脚本后，**新开一个 Codex 聊天或重启 Codex** 即可生效。
- 长任务需要更长超时时，可在 `~/.codex/config.toml` 对应的 `[mcp_servers.<名称>]` 中设置 `tool_timeout_sec`。

## 连接方式

MCP 直接编辑游戏工程文件。`mz_open_editor` 启动本机 `RPGMZ.exe` 并返回工程路径；本机 MZ 1.10 实测可能忽略命令行工程参数，此时需在“文件 → 打开工程”选择该路径。`mz_launch_playtest` 用 MZ 附带的 NW.js 启动试玩，`run_playtest` 用 Chromium 自动验证。插件不读取 Qt 编辑器当前选区或未保存状态，也不提供编辑器内按钮点击/热刷新。

编辑已有工程前保存并关闭编辑器中的该工程，修改后重新打开，防止旧内存覆盖磁盘。MZ 安装目录与游戏工程目录是两个不同路径。默认安装位置为 `D:\steam\steamapps\common\RPG Maker MZ`；可在安装命令里改。

## 安装发布包

解压 `dist/rpgmaker-mz-local-plugin-1.0.0.zip`，保留完整目录结构，在解压出的 `rpgmaker-mz-codex` 目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-plugin.ps1
```

依赖 Node.js 20+、带插件 CLI 的 Codex，以及合法安装的 RPG Maker MZ。安装器优先寻找 PATH 中的 Node，随后寻找 Codex bundled Node。发布包包含已构建 MCP 服务与 Playwright Core，无需 npm/pip 安装依赖，不下载浏览器。自动试玩可使用本机 Edge/Chrome。

其他机器可明确指定：

```powershell
.\install-plugin.ps1 -MZPath 'D:\steam\steamapps\common\RPG Maker MZ' -NodePath 'C:\Program Files\nodejs\node.exe'
```

`-ProjectPath` 可设置默认游戏目录，`-ChromiumPath` 可指定浏览器，`-PrepareOnly` 仅准备配置。安装器注册本地 marketplace 并安装 `rpgmaker-mz-local@rpgmaker-mz-local-market`，随后在新 Codex 聊天加载工具与 skill。仅卸载插件可运行 `uninstall-plugin.ps1`，游戏与备份保留。

## 使用示例

- “检查本机 MZ，连接 E:/games/MyGame 工程。”
- “在 E:/games 下新建一个叫「林间小镇」的 MZ 工程，铺好地面，加入能说中文的 NPC，并验证走过去可以对话。”
- “把我现有游戏的物品价格调整一下，先给我变更预览，再修改并检查引用。”
- “查看地图通行性，给出口添加双向传送并自动试玩。”

`mz_create_project` 目标必须尚不存在，父目录必须存在。工程内自带商业素材不会进入插件 ZIP。

## 本机扩展工具

| 工具 | 能力 |
| --- | --- |
| mz_installation | 安装位置、MZ 核心版本与编辑器/NW.js 进程 |
| mz_create_project | 从本机模板新建并选择工程 |
| mz_open_editor | 启动编辑器，返回需要打开的工程路径 |
| mz_check_editor_project | 检查工程标记、核心文件、MZ 原生插件清单布局与启用脚本；不执行游戏代码 |
| mz_update_plugin | 保留顺序、其他插件与参数，安全配置游戏插件；支持 dryRun、备份和格式规范化 |
| mz_launch_playtest | 用安装目录的 NW.js 试玩 |
| mz_checkpoint | 数据及游戏 JS 插件备份 |
| mz_list_checkpoints | 列出备份 |
| mz_changes_since | 相对检查点的新增/修改/删除文件 |
| mz_read_data | 读取 data 下 JSON 文件 |

每个 MCP 会话首次实际写入前自动备份 `data`、`js/plugins`、`js/plugins.js`、工程标记和 package.json。媒体素材、存档、引擎不在此备份范围。并发 MCP 请求会串行执行，防止同一进程内读改写冲突；不能阻止另一个编辑器或外部进程同时写文件。

## 源码构建与验证

源码工作区保留 `vendor/upstream` 与锁文件。使用 pnpm 安装固定依赖，再运行：

```powershell
pnpm install --frozen-lockfile
node scripts/build.mjs
node --test tests/local.test.mjs tests/editor-compat.test.mjs
node tests/integration.mjs
python scripts/package.py
```

构建器把 MCP SDK、Zod 和上游工具打入单个服务；Playwright Core 单独随包分发。发布包不包含测试游戏、本机路径配置、node_modules 开发依赖或 RTP 资源。`outputs/verification.json` 保存本次工作区集成检查证据；测试工程仅在本机用于验证。

插件故障排查：确认新聊天已经加载插件；调用 `mz_installation`；用 `get_project` 检查目标；浏览器启动失败时设置 `-ChromiumPath`；结构校验失败时修复输入而不是直接 `force:true`。

编辑器兼容：游戏能试玩不等于编辑器能读取 `js/plugins.js`。先调用 `mz_check_editor_project`。若是可解析的字面 JSON 清单但布局不规范，可先预览 `mz_update_plugin({dryRun:true})`，确认后 `mz_update_plugin({})` 规范化；修改某插件例如 `mz_update_plugin({name:"MyPlugin",enabled:true,parameters:{text:"你好"},dryRun:true})`。实际更新前保存并关闭工程；启用前须放好对应 `js/plugins/MyPlugin.js`。工具不会执行清单中的任意 JavaScript，不可安全解析时拒绝写入。`mz_open_editor` 自动预检，但仍不声称确认编辑器加载成功。

## GitHub 源码与许可

源码仓库：https://github.com/YZ2020CHINA/rpgmaker-mz-codex

自有代码使用 [MIT License](LICENSE)，第三方组件、软件、模型与素材保留各自许可。开发、分支和发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

首次从源码安装时，先复制 `config.example.json` 为 `config.json` 并按本机安装位置修改；本机配置不会提交到 Git。
