# 工具分工

| 目标 | 工具 |
| --- | --- |
| 检测本机 | mz_installation |
| 连接/切换工程 | get_project、set_project |
| 创建新工程 | mz_create_project(destination, title, locale?) |
| 启动编辑器/本机试玩 | mz_open_editor、mz_launch_playtest |
| 编辑器预检 | mz_check_editor_project（只读；启动编辑器时也自动运行） |
| 游戏插件配置 | mz_update_plugin（预览、备份、保留其他记录与参数；空参数规范化格式） |
| 备份/变更 | mz_checkpoint(label)、mz_list_checkpoints、mz_changes_since(checkpointId) |
| 读取工程 JSON | mz_read_data(file)，只允许 data 下文件名 |
| 地图 | get_map_infos、get_map、create_map、resize_map、paint_blueprint、fill_area |
| 图块/通行 | find_tile、get_tile_catalog、check_passability、get_tile_flags |
| NPC/事件 | create_npc、create_map_event、build_*、insert_event_commands |
| 数据库 | create_actor、create_class、create_skill、create_item 等 |
| 校验/引擎运行 | validate_project、validate_references、render_map、run_playtest |

本机工具示例：`mz_create_project({"destination":"E:/games/MyGame","title":"我的游戏","locale":"zh_CN"})`。E:/games 必须已经存在，MyGame 必须尚不存在。其他工具的完整参数以 MCP schema 为准。

长试玩每一步发送进度通知，默认请求超时 300 秒。较长剧情可以拆成独立测试脚本，但每次 run_playtest 是新会话，需用 load 初始化状态，不能假设上一次游戏状态仍在。
