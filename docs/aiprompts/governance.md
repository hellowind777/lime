# 治理第一原则

## 核心规则

**同一种能力，在同一时期只能存在一个继续演进的事实源。**

其余实现必须被明确归类为：

- `current`：当前唯一主路径，后续需求只允许继续向这里收敛
- `compat`：兼容层，只允许委托、适配、告警，不允许继续长新逻辑
- `deprecated`：废弃层，只允许迁移与下线，不允许新增依赖
- `dead`：无入口或已停用，优先删除

如果做不到这一点，系统就不会持续演进，只会持续膨胀。

## 文档定位

本文件定义的是 **Lime 仓库的治理判断标准**，不是某一种具体工具或 Agent 框架的使用说明。

它解决的是：

- 什么才算“统一”，而不是“又写了一套更新版本”
- 什么路径还允许继续演进，什么路径只能收口或删除
- 什么时候可以保留兼容层，什么时候必须补守卫或删除

它不直接规定：

- 必须使用哪一种 harness、hook、sub-agent 或 reviewer
- 必须采用哪一个 AI 工具的工作流

如果未来引入额外 reviewer agent，它也只能 **执行** 本文件定义的治理规则，不能替代本文件成为新的事实源。

## 适用场景

当出现以下任一情况时，必须先读本文件，再决定是否改代码：

- 新旧 Hook、新旧组件、新旧命令并存
- 前端已经有新抽象，Rust 后端仍保留多套入口
- 新服务已经落地，但旧数据表、旧 DAO、旧旁路查询仍在使用
- 需求迭代后，AI 倾向继续沿用旧实现
- 团队打算“先补功能，后面再统一”

## 强制执行规则

### 1. 先盘点，再修改

开始改动前，必须先盘点这项能力在 4 层中的实际分布：

- 入口层：页面、组件、Hook、前端 API
- 服务层：Tauri 命令、Service、Workflow、事件入口
- 存储层：表、DAO、Repository、缓存、迁移
- 旁路层：统计、记忆、搜索、审计、报表、任务系统

如果没有盘点清楚，禁止直接开始“统一”。

### 2. 先定事实源，再谈迁移

必须先明确一句话：

> 从现在开始，这个能力以后只允许向哪里收敛？

事实源可以是：

- 一个 Hook
- 一个组件入口
- 一组 Rust 命令
- 一个 Service / Repository
- 一组数据表

没有唯一事实源，任何迁移都会继续长出新分支。

### 3. 先分类，再动刀

盘点完成后，必须把实际路径标成以下四类之一：

- `current`
- `compat`
- `deprecated`
- `dead`

分类不是文档装饰，而是后续动作的约束：

- `current`：允许继续演进，但禁止再新增平级实现
- `compat`：必须持续收口，不能承接新需求
- `deprecated`：必须限制新增依赖，并明确退出条件
- `dead`：优先删除，至少先建立自动守卫防止回流

### 4. compat 只能收口，不能增强

compat 层存在的唯一理由是迁移。

compat 层允许：

- 参数转换
- 返回值适配
- 委托到新实现
- 迁移期埋点和告警

compat 层禁止：

- 新增业务逻辑
- 新增状态来源
- 新增独立存储
- 新增旁路能力

一旦 compat 层承载新需求，它就不再是 compat，而是新的分叉点。

### 5. 禁止回流，优先于“推荐新方案”

治理不能靠口头约定，必须靠守卫机制。

至少建立以下一种或多种守卫：

- ESLint / 静态规则禁止 import 旧入口
- Rust 对旧命令输出 `warn` 与调用统计
- CI 阻止新代码继续引用废弃路径
- 脚本扫描旧表、旧 DAO、旧命令、旧 Hook 的新增使用点

当前仓库可直接运行：

```bash
npm run governance:legacy-report
npm run test:contracts
```

- `npm run governance:legacy-report` 用于扫描：
  - 已被判定为 `deprecated` / `dead-candidate` 的前端入口
  - 旧 Tauri 命令是否仍然只收口在指定 API 网关
  - 哪些兼容壳层已经零引用，可以进入删除候选
- `npm run test:contracts` 用于检查跨层命令契约：
  - 前端 `safeInvoke(...)` / `invoke(...)` 的实际命令调用
  - Rust `tauri::generate_handler!` 的实际注册表
  - `agentCommandCatalog` 中的 `deprecated` 命令与 `runtime gateway` 命令边界
  - `mockPriorityCommands` 与 `defaultMocks` 是否仍然同步

只看其中一侧都不够。只要能力仍然依赖命令边界，至少要同时看前端调用、Rust 注册、deprecated 目录、mock 集合这四个面。

原则只有一句：

**不是鼓励走新路，而是封住老路。**

### 6. 主链路和旁路必须一起治理

如果只迁：

- 页面
- Hook
- 主命令

但没有迁：

- 统计查询
- 记忆系统
- 搜索召回
- 报表分析
- 审计与任务类旁路

那么旧表、旧命令、旧 DAO 最终都删不掉。

治理完成的标准不是“页面能跑”，而是“系统生态已收口”。

### 7. 删除必须有退出条件

每一个 `compat` 或 `deprecated` 路径，都必须有明确退出条件：

- 哪些调用迁完即可删
- 哪个版本或阶段必须删除
- 删除前要验证哪些指标或扫描结果

没有退出条件的兼容层，最终一定会常驻。

## 推荐执行闭环

### 第一步：出迁移地图

至少列清楚：

- 当前主路径
- 兼容路径
- 废弃路径
- 无入口路径

### 第二步：写事实源声明

例如：

> 聊天能力后续统一收敛到 `useAgentChatUnified -> useAsterAgentChat -> agent_runtime_* + lime_core::database::agent_session_repository`。

## 文件级治理图谱配套规则

如果要维护文件 / 页面级治理图谱，仓库内默认配套：

- 人工治理规则：`governance/surfaces.yml`
- 交互图谱命令：`npm run governance:graph`
- 既有边界扫描：`npm run governance:legacy-report`

约束：

- `current / compat / deprecated / dead` 只能来自人工治理规则或仓库内既有治理规则
- 自动脚本只能补 `dead-candidate`、`unused-file`、`unused-export`、`zero-inbound`、`page-unreachable` 等信号
- `dead` 不能由脚本自动判定，必须人工确认
- `compat` 规则必须写清 `sourceOfTruth`
- `deprecated` 规则必须写清 `exitCriteria`
- 如遇构建期 alias、运行时桥接、特殊入口等静态分析盲区，可补 `ignoreSignals` 仅压制误报 signal，不改变事实源判断

### 第三步：优先做减法

默认优先做这些动作，而不是再加一层抽象：

- 把上层散落逻辑收回单一边界
- 把 legacy 判断收回 `Repository / Database / app_paths`
- 让 compat 层只做委托与适配
- 删除零引用入口
- 把运行时 fallback 改成启动期迁移或边界短路

除非用户明确要求保留兼容，否则不要新增新的 compat 层。

### 第四步：补守卫

至少加一条能自动失败的规则，阻止旧路径继续增长。

如果改动涉及 Tauri 命令、前端 API 网关、bridge 或 mock，优先补：

- `npm run test:contracts`
- `npm run governance:legacy-report`

### 第五步：迁旁路

确认统计、记忆、搜索、报表、审计、任务系统不再依赖旧实现。

### 第六步：验证并删除

只有当新增依赖已被封住、调用量清零、旁路迁完，才允许删除旧路径。

## Lime 中的典型判断方式

以聊天系统为例，遇到新旧并存时，必须同时问这几个问题：

- 前端唯一入口是不是 `useAgentChatUnified -> useAsterAgentChat`，还是 `useChat` / `useAgentChat` / `useUnifiedChat` 还在继续长逻辑？
- Rust 唯一入口是不是 `agent_runtime_*`，还是 `chat_*` / `general_chat_*` / `agent_*` / `aster_agent_*` 还在平行演进？
- 前端 `safeInvoke(...)` / `invoke(...)`、Rust `tauri::generate_handler!`、`agentCommandCatalog`、`mockPriorityCommands` / `defaultMocks` 这四个命令边界是不是仍然一致，还是已经产生漂移？
- 数据事实源是不是同一组表 / 同一套 Repository，还是还在同时写 `agent_*` 与 `general_chat_*`？
- 统计、记忆等旁路是不是已经切到新路径，还是还在读旧表？

只要其中任意一个答案是否定的，就说明治理还没完成。

## Lime 的治理偏好

### 路径与目录

涉及运行时目录、历史目录兼容、用户数据落盘时，优先收口到统一路径边界，例如 `app_paths` 或等价统一入口。

不要在上层继续手写：

- `~/Library/...`
- `C:/Users/...`
- `~/.lime/...`

### 数据迁移

一旦历史数据迁移已接入启动流程：

- 运行时主链路必须优先按“迁移完成标记”短路旧表读取
- 旧表只允许服务迁移、审计与回放
- 业务层优先消费 `pending_*` 等迁移态语义

不要在多个 service 中重复写：

- `is_migrated`
- `legacy_*`
- 手工分叉短路逻辑

### 语义暴露

过渡期对外暴露的命名必须体现“迁移态”语义，例如：

- `pending_*`

不要继续让业务层直接依赖：

- `legacy_*`
- `general_chat_*`
- 仅体现历史实现而不体现迁移语义的模块名

## 与自动 reviewer / sub-agent 的关系

如果未来为 Lime 增加治理 reviewer、hook 或额外 sub-agent，推荐把它们当成 **执行器**，而不是新的治理定义者。

它们至少应检查：

- 是否新增了与 `current` 平级的第二套实现
- 是否让 `compat` 长了新业务逻辑
- 是否只迁主链路却漏掉旁路
- 是否出现了新的旧入口引用或旧命令回流
- 是否补了守卫与验证

它们的输出应回到本文件的分类语言：

- 本次改动涉及哪些 `current`
- 哪些路径仍是 `compat`
- 哪些路径已进入 `deprecated`
- 哪些路径已经可以判定为 `dead`

换句话说：

**自动 reviewer 可以帮你发现问题和加速修复，但不能替你定义“什么叫收口完成”。**

## 禁止事项

出现以下行为，视为违反治理原则：

- 在旧 Hook / 旧组件 / 旧命令上继续叠加新需求
- 新增与现役路径平级的第二套实现
- 前端迁了新入口，但 Rust 仍保留旧主逻辑继续演进
- 已有统一 Service，却继续让命令层各自写 SQL
- 主链路改到新表，旁路系统仍直接查旧表
- 看到“旧代码还能用”，就继续让 AI 沿旧上下文生成

## AI 执行要求

未来 AI 在处理“新旧并存、迁移、重构、统一”类任务时，默认遵守以下要求：

1. 不允许直接在旧路径上继续扩展新功能，除非用户明确要求做兼容补丁。
2. 必须优先识别唯一事实源，并围绕事实源收口，而不是继续新增平级实现。
3. 必须显式说明当前改动属于 `current`、`compat`、`deprecated`、`dead` 中哪一类。
4. 如果发现主链路与旁路系统割裂，必须指出，不得假装治理已经完成。
5. 如果无法在本次改动中完成收口，至少要建立守卫，阻止问题继续扩散。
6. 如果已有自动 reviewer / hook / 子 agent，它们的结论必须服从本文件，而不是绕开本文件自行定义标准。

## 输出要求

涉及治理类改动时，汇报结果至少应包含：

1. 本次收掉了哪些 surface
2. 当前改动分别属于 `current` / `compat` / `deprecated` / `dead` 中哪一类
3. 补了哪些守卫和验证
4. 还剩哪条主链路或旁路最值得继续优化

## 一句话总结

**治理不是继续写一个“更新的版本”，而是让系统以后只能向一个版本收敛。**
