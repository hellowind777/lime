# next-browser 项目参考分析

> 来源: `/Users/coso/Documents/dev/ai/skills/next-browser`
> 项目: @vercel/next-browser - Vercel 官方的浏览器自动化工具

## 项目概述

`next-browser` 是 Vercel 开发的一个 **CLI 工具**,为 AI Agent 提供对 React DevTools 和 Next.js dev server 的编程访问。它将 GUI 操作(组件树、props、hooks、PPR shells、错误)转换为 **结构化文本输出的 shell 命令**。

### 核心理念
- **为 AI Agent 设计** - LLM 无法读取 DevTools 面板,但可以运行 `next-browser tree` 并解析输出
- **无状态命令** - 每个命令都是对长期运行的浏览器守护进程的一次性调用
- **结构化输出** - 所有输出都是可解析的文本/JSON,便于 Agent 处理

---

## 值得 Proxycast 参考的设计

### 1. 守护进程 + 客户端架构 ⭐⭐⭐

**设计模式:**
```
CLI 命令 → Unix Socket → 守护进程 → Playwright Browser
```

**实现细节:**
```typescript
// daemon.ts - 守护进程
const server = createServer((socket) => {
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line) dispatch(line, socket);
    }
  });
});

server.listen(socketPath);  // Unix socket

async function dispatch(line: string, socket: Socket) {
  const cmd = JSON.parse(line);
  const result = await run(cmd).catch((err) => ({ ok: false, error: cleanError(err) }));
  socket.write(JSON.stringify({ id: cmd.id, ...result }) + "\n");
}
```

**Proxycast 应用:**
- ✅ **替代 Tauri event 的高吞吐方案** - 当事件推送超过 100/s 时,切换到本地 Unix Socket
- ✅ **守护进程管理浏览器实例** - 避免每次命令都启动新浏览器
- ✅ **命令-响应模式** - 清晰的请求/响应边界,便于错误处理

---

### 2. Playwright + React DevTools 集成 ⭐⭐⭐

**核心技术:**
```typescript
// browser.ts
const extensionPath = resolve(import.meta.dirname, "../extensions/react-devtools-chrome");

// Pre-read the hook script
const installHook = readFileSync(
  join(extensionPath, "build", "installHook.js"),
  "utf-8",
);

async function launch() {
  const context = await chromium.launchPersistentContext(profileDirPath, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--auto-open-devtools-for-tabs",
    ],
  });

  // Pre-inject hook to win the race against extension
  await context.addInitScript(installHook);

  return context;
}
```

**关键亮点:**
1. **预加载 React DevTools 扩展** - 通过 `--load-extension` 加载 Chrome 扩展
2. **预注入 Hook** - 使用 `addInitScript` 在页面加载前注入 React DevTools hook
3. **自动打开 DevTools** - `--auto-open-devtools-for-tabs` 确保扩展激活

**Proxycast 应用:**
- ✅ **扩展 CDP 能力** - 不仅仅是原始 CDP,还可以加载自定义扩展
- ✅ **预注入脚本** - 在页面加载前注入监控/调试脚本
- ✅ **持久化上下文** - 使用 `launchPersistentContext` 保持会话状态

---

### 3. 组件树提取 ⭐⭐

**实现原理:**
```typescript
// tree.ts
export async function tree(page: Page) {
  // 通过 React DevTools hook 获取组件树
  const operations = await page.evaluate(() => {
    return window.__REACT_DEVTOOLS_GLOBAL_HOOK__.flushInitialOperations();
  });

  // 解析 operations 构建组件树
  const tree = parseOperations(operations);
  return tree;
}

export async function inspect(page: Page, nodeId: number) {
  // 获取组件的 props/hooks/state
  const data = await page.evaluate((id) => {
    return window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inspectElement(id);
  }, nodeId);

  return {
    props: data.props,
    hooks: data.hooks,
    state: data.state,
    source: data.source,
  };
}
```

**Proxycast 应用:**
- ✅ **深度调试能力** - 不仅看到 DOM,还能看到 React 组件结构
- ✅ **状态检查** - 检查组件的 props/hooks/state
- ✅ **源码定位** - 通过 source map 定位到原始源码位置

---

### 4. PPR (Partial Prerendering) 锁定机制 ⭐⭐⭐

**核心概念:**
```typescript
// browser.ts
let release: (() => void) | null = null;
let settled: Promise<void> | null = null;

export async function lock() {
  if (release) return;  // Already locked

  // Use @next/playwright's instant() to set cookie
  const { promise, resolve } = Promise.withResolvers<void>();
  release = resolve;
  settled = promise;

  await instant(page!, async () => {
    await settled;  // Block until unlock()
  });
}

export async function unlock() {
  if (!release) return;

  // Capture locked state
  const lockedSnapshot = await captureSuspenseBoundaries();

  // Release the lock
  release();
  release = null;
  settled = null;

  // Wait for boundaries to settle
  await page!.waitForTimeout(500);

  // Capture unlocked state
  const unlockedSnapshot = await captureSuspenseBoundaries();

  // Analyze the diff
  return analyzePPRShell(lockedSnapshot, unlockedSnapshot);
}
```

**工作原理:**
1. **Lock** - 设置 `next-instant-navigation-testing=1` cookie,阻止动态数据加载
2. **Capture** - 截取 PPR shell(静态 HTML + `<template>` 占位符)
3. **Unlock** - 释放锁,让动态数据加载
4. **Analyze** - 对比 locked/unlocked 状态,识别哪些组件是动态的

**Proxycast 应用:**
- ✅ **性能分析** - 识别哪些组件导致页面加载慢
- ✅ **SSR/CSR 边界** - 清晰看到服务端渲染和客户端渲染的边界
- ✅ **优化指导** - 帮助用户优化 PPR shell,提升首屏加载速度

---

### 5. Network 请求追踪 ⭐⭐

**实现:**
```typescript
// network.ts
const requests: Request[] = [];

export function attach(page: Page) {
  page.on("request", (req) => {
    requests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      timestamp: Date.now(),
    });
  });

  page.on("response", (res) => {
    const req = requests.find(r => r.url === res.url());
    if (req) {
      req.status = res.status();
      req.responseHeaders = res.headers();
      req.timing = res.timing();
    }
  });
}

export function list() {
  return requests.map((req, idx) => ({
    idx,
    status: req.status,
    method: req.method,
    type: req.resourceType,
    ms: req.timing?.responseEnd,
    url: req.url,
  }));
}

export function inspect(idx: number) {
  const req = requests[idx];
  return {
    request: {
      url: req.url,
      method: req.method,
      headers: req.headers,
    },
    response: {
      status: req.status,
      headers: req.responseHeaders,
      body: req.body,
    },
  };
}
```

**Proxycast 应用:**
- ✅ **完整的 Network 追踪** - 记录所有请求/响应
- ✅ **性能分析** - 识别慢请求
- ✅ **调试 API 调用** - 检查请求/响应内容

---

### 6. Source Map 支持 ⭐⭐

**实现:**
```typescript
// sourcemap.ts
import { SourceMapConsumer } from "source-map-js";

const cache = new Map<string, SourceMapConsumer>();

export async function resolve(url: string, line: number, column: number) {
  const consumer = await getConsumer(url);
  if (!consumer) return null;

  const original = consumer.originalPositionFor({ line, column });
  return {
    source: original.source,
    line: original.line,
    column: original.column,
    name: original.name,
  };
}

async function getConsumer(url: string) {
  if (cache.has(url)) return cache.get(url);

  // Fetch source map
  const mapUrl = url + ".map";
  const response = await fetch(mapUrl);
  const rawMap = await response.json();

  const consumer = await new SourceMapConsumer(rawMap);
  cache.set(url, consumer);

  return consumer;
}
```

**Proxycast 应用:**
- ✅ **错误定位** - 将压缩代码的错误映射到原始源码
- ✅ **组件定位** - 显示组件在源码中的位置
- ✅ **调试体验** - 让用户看到可读的源码,而不是压缩后的代码

---

### 7. 错误收集与展示 ⭐⭐⭐

**实现:**
```typescript
// mcp.ts - 通过 Next.js MCP 获取错误
export async function errors() {
  const response = await fetch("http://localhost:3000/__nextjs_mcp/errors");
  const data = await response.json();

  return {
    configErrors: data.configErrors,
    sessionErrors: data.sessionErrors.map(session => ({
      url: session.url,
      buildError: session.buildError,
      runtimeErrors: session.runtimeErrors.map(err => ({
        type: err.type,  // "runtime" or "console"
        errorName: err.errorName,
        message: err.message,
        stack: err.stack.map(frame => ({
          file: frame.file,
          methodName: frame.methodName,
          line: frame.line,
          column: frame.column,
        })),
      })),
    })),
  };
}
```

**Proxycast 应用:**
- ✅ **统一错误收集** - 收集构建错误、运行时错误、Console 错误
- ✅ **结构化错误** - 提供完整的堆栈信息和源码位置
- ✅ **错误分类** - 区分不同类型的错误,便于排查

---

## 架构对比与建议

### next-browser 架构
```
┌─────────────┐
│  CLI 命令   │
└──────┬──────┘
       │ Unix Socket
┌──────▼──────┐
│  守护进程    │
└──────┬──────┘
       │
┌──────▼──────────────┐
│  Playwright Browser │
│  + React DevTools   │
└─────────────────────┘
```

### Proxycast 当前架构
```
┌─────────────┐
│  前端 UI    │
└──────┬──────┘
       │ Tauri IPC
┌──────▼──────┐
│  Rust 后端  │
└──────┬──────┘
       │ CDP WebSocket
┌──────▼──────┐
│   Chrome    │
└─────────────┘
```

### 融合建议

#### 1. 采用守护进程模式 (Phase 2)
```rust
// src-tauri/src/cdp/daemon.rs
pub struct CdpDaemon {
    socket_path: PathBuf,
    sessions: HashMap<String, CdpSession>,
}

impl CdpDaemon {
    pub async fn start(&mut self) -> Result<()> {
        let listener = UnixListener::bind(&self.socket_path)?;

        loop {
            let (stream, _) = listener.accept().await?;
            self.handle_connection(stream).await?;
        }
    }

    async fn handle_connection(&mut self, mut stream: UnixStream) -> Result<()> {
        let mut buffer = String::new();
        stream.read_to_string(&mut buffer).await?;

        let cmd: Command = serde_json::from_str(&buffer)?;
        let result = self.dispatch(cmd).await?;

        stream.write_all(serde_json::to_string(&result)?.as_bytes()).await?;
        Ok(())
    }
}
```

**优势:**
- ✅ 高吞吐量(绕过 Tauri event 限制)
- ✅ 进程隔离(浏览器崩溃不影响主进程)
- ✅ 资源管理(统一管理多个浏览器实例)

#### 2. 预注入脚本能力
```rust
// src-tauri/src/cdp/session_manager.rs
impl CdpSession {
    pub async fn add_init_script(&self, script: &str) -> Result<()> {
        self.ws.send_command("Page.addScriptToEvaluateOnNewDocument", json!({
            "source": script
        })).await
    }

    pub async fn inject_monitoring_script(&self) -> Result<()> {
        let script = r#"
            window.__PROXYCAST_MONITOR__ = {
                errors: [],
                performance: [],
                network: [],
            };

            // 监听错误
            window.addEventListener('error', (e) => {
                window.__PROXYCAST_MONITOR__.errors.push({
                    message: e.message,
                    filename: e.filename,
                    lineno: e.lineno,
                    colno: e.colno,
                });
            });

            // 监听性能
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    window.__PROXYCAST_MONITOR__.performance.push(entry.toJSON());
                }
            }).observe({ entryTypes: ['navigation', 'resource', 'paint'] });
        "#;

        self.add_init_script(script).await
    }
}
```

#### 3. 组件树提取(可选,针对 React 应用)
```rust
// src-tauri/src/cdp/react_devtools.rs
pub struct ReactDevTools {
    session: Arc<CdpSession>,
}

impl ReactDevTools {
    pub async fn get_component_tree(&self) -> Result<ComponentTree> {
        let result = self.session.evaluate(r#"
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.flushInitialOperations()
        "#).await?;

        let operations: Vec<u8> = serde_json::from_value(result)?;
        let tree = parse_operations(&operations)?;

        Ok(tree)
    }

    pub async fn inspect_component(&self, node_id: u32) -> Result<ComponentInfo> {
        let result = self.session.evaluate(&format!(r#"
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.inspectElement({})
        "#, node_id)).await?;

        Ok(serde_json::from_value(result)?)
    }
}
```

---

## 实施优先级

### 高优先级 🔥
1. **守护进程架构** - 解决高吞吐量事件推送问题
2. **预注入脚本** - 增强监控和调试能力
3. **Network 追踪** - 完整记录请求/响应

### 中优先级 🟡
4. **Source Map 支持** - 错误定位到原始源码
5. **错误收集** - 统一收集和展示错误

### 低优先级 🟢
6. **React DevTools 集成** - 仅针对 React 应用
7. **PPR 锁定机制** - 仅针对 Next.js 应用

---

## 总结

`next-browser` 项目提供了以下关键启示:

1. **守护进程 + Unix Socket** - 比 Tauri event 更高效的通信方式
2. **Playwright 扩展能力** - 不仅仅是 CDP,还可以加载 Chrome 扩展
3. **预注入脚本** - 在页面加载前注入监控代码
4. **结构化输出** - 所有命令返回可解析的文本/JSON
5. **Source Map 支持** - 将压缩代码映射到原始源码
6. **完整的 Network 追踪** - 记录所有请求/响应

这些设计可以直接应用到 Proxycast 的 Phase 2-3 实现中,特别是守护进程架构和预注入脚本能力。
