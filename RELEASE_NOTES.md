## ProxyCast v0.80.0

### ✨ 新功能
- 新增 Gateway 网关模块，支持隧道和频道管理 (gateway crate + gateway_tunnel_cmd + gateway_channel_cmd)
- 新增 Agent 工具调用策略管理 (request_tool_policy.rs)
- 新增 Aster 会话恢复机制 (asterSessionRecovery)
- 新增频道日志尾部面板和日志过滤功能 (ChannelLogTailPanel + channel-log-filter)
- 新增 Gateway 隧道 Webhook 使用文档
- Agent 聊天增强：扩展 useAsterAgentChat hooks 功能
- 新增 useTauri hooks 扩展，提供更多 Tauri 桥接能力
- 新增频道 API 接口 (channels.ts)
- 数据库新增 v3 迁移支持

### 🐛 修复
- 修复 CI 构建中 app-version 模块的 shebang 解析问题
- 修复 CI release 流程中 tauri action 的版本兼容性
- 修复 CI release 的 projectPath 配置

### 🔧 优化与重构
- 重构 request_tool_policy_prompt_service，精简代码
- 优化 scheduler executor 执行逻辑
- 优化 websocket RPC handler，扩展协议支持
- 优化 terminal PTY 会话和本地连接管理
- 扩展 core 配置类型，新增 GatewayConfig
- 增强 agent store 状态管理
- 优化 aster agent 命令处理
- 改进 config observer 和 bootstrap 流程

### 📦 其他
- 更新依赖版本 (pnpm-lock.yaml, Cargo.lock)
- 新增 scheduler 依赖
- 开发者设置页面微调

---

**完整变更**: v0.79.0...v0.80.0
