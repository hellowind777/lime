## ProxyCast v0.87.0

### ✨ 新功能

- **浏览器协助运行时**：新增 `browser-runtime` crate、Tauri 命令与调试页，支持在 Agent 会话内拉起浏览器协助能力
- **Browser Assist 产物渲染**：新增 Browser Assist Artifact 渲染器，可在 General 会话中直接承接浏览器协助状态与操作
- **画布工作台布局**：新增 `CanvasWorkbenchLayout`，支持预览 / 文件 / 差异 / 工作台联动，以及分栏与堆叠两种布局模式
- **技能显式选择器**：新增 `SkillSelector` 与相关 harness skill 聚合逻辑，提升技能发现、点选与触发体验
- **新任务入口模式**：新增 `new-task` 入口、空状态页与会话恢复控制，梳理 Claw / 新任务两类进入路径

### 🔧 优化与重构

- **General Chat 主流程重构**：重写 Agent Chat 页的大量 General 场景逻辑，统一画布、Artifact、Workbench 与浏览器协助状态
- **Webview / Browser Runtime 协调增强**：扩展 `webview_cmd`、窗口服务与前端 API，补齐浏览器运行时会话、窗口与控制链路
- **Settings v2 大规模重排**：重构外观、快捷键、频道、Chrome Relay、环境、安全性能、账户统计等设置页
- **项目与记忆工作区升级**：重构内容列表、内容编辑器、项目选择器及多类 Memory 面板，统一信息架构与交互密度
- **导航与侧栏收敛**：调整应用侧栏、任务侧栏、资源与工作区导航，移除部分旧页面与冗余入口

### 🐛 修复

- **前端 Hooks 依赖修复**：补齐 `useCallback` 依赖，消除 `npm run lint` 中的 `react-hooks/exhaustive-deps` 警告
- **Rust Clippy 清理**：移除浏览器运行时客户端中的冗余类型转换，保持 `cargo clippy` 输出干净
- **日志测试并发污染修复**：将日志诊断测试切到独立临时目录，避免并行测试互相删除 `raw_response` 工件
- **Workspace 错误态兜底**：补强任务侧栏与相关页面的 workspace 异常显示与恢复路径

### 🧪 测试

- 新增 Browser Assist、Canvas Workbench、Skill Selector、General Resource Sync、Harness Skills 等前端测试
- 补充项目页、设置页、统计页、内存面板等多处 UI / 交互测试
- 发布前已执行：`cargo fmt --all`、`cargo test`、`cargo clippy`、`npm run lint`

### 📝 文档

- 补充 Agent Chat / Components 文档说明
- 新增 `docs/research/` 研究资料目录
- 更新发布流程相关说明，覆盖 headless Tauri 配置版本同步

### 🛠️ 开发体验

- **版本一致性检查增强**：`check-app-version-consistency.mjs` 现覆盖 `tauri.conf.headless.json`
- **Release Workflow 补强**：GitHub Release 工作流现同步标准与 headless 两份 Tauri 配置版本
- **跨端发布一致性提升**：统一 `package.json`、Cargo workspace、Tauri 配置与 release notes 的版本入口

---

**完整变更**: v0.86.0...v0.87.0
