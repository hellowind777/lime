# 基于 CDP 的远程浏览器实时流控与调试方案(Proxycast 落地版)

> 融合 NextBrowser 特征调查 + Codex 架构设计的务实实施方案

## 目标与原则

### 核心目标
在现有 `chrome relay + cdp_direct` 基础上,补齐**双通道能力**:
1. **事件/控制通道**: 基于 DevTools WebSocket 建立稳定 CDP 会话,实时收发命令、console、network、runtime、page lifecycle 事件
2. **画面流通道**: 基于 `Page.startScreencast` 或受控截图轮询输出低延迟页面画面,用于任务执行中的实时观察与回放

### 设计原则
- ✅ **保持现有架构**: 不改动后端优先级模型(aster_compat、proxycast_extension_bridge、cdp_direct 并存)
- ✅ **渐进式增强**: 只升级 cdp_direct 从"HTTP 探测初版"到"有状态 CDP 会话后端"
- ✅ **KISS/YAGNI**: 不引入第四套浏览器控制通道,避免过度设计
- ✅ **跨平台兼容**: macOS 与 Windows 都可运行,平台差异仅体现在 Chrome 启动和端口探测
- ✅ **统一抽象**: 后端产出 session + event stream + frame stream + command result 抽象,前端只消费统一事件

---

## 一、NextBrowser 核心特征总结

### 1. Live View (实时视图) ⭐⭐⭐
**功能描述:**
- 在任务执行期间实时流式传输远程浏览器画面
- 支持远程控制和调试
- 可以手动干预解决验证码、多因素认证等问题

**技术要点:**
- 实时视频流传输
- 双向交互(观看 + 控制)
- WebSocket 持久连接

**Proxycast 实现优先级:** 🔥 高优先级

---

### 2. Debugger (调试器) ⭐⭐⭐
**功能描述:**
- 通过 Chrome DevTools 检查浏览器自动化
- 获取 browser_id 后可以获取所有标签页的 debug_url
- 支持 WebSocket 连接到远程 DevTools

**API 流程:**
```
1. 创建任务 → 获取 browser_id
2. GET /api/v1/browser/browser_id/{browser_id}/tabs → 获取 debug_url
3. 在 Chrome 中打开 debug_url?is-playground=true
```

**技术要点:**
- CDP (Chrome DevTools Protocol) 直连
- WebSocket debugger URL: `wss://...`
- 支持多标签页调试

**Proxycast 实现优先级:** 🔥 高优先级

---

### 3. Browser & Proxy Settings (浏览器与代理设置) ⭐⭐
**功能描述:**

**浏览器会话类型:**
- `persistent`: 持久会话,保存 cookies 和登录状态
- `one-time`: 一次性会话,每次从头开始

**代理设置:**
- 代理类型: Residential(住宅) / Mobile(移动)
- 地理定位: 国家/地区/城市/ISP
- 用于绕过地理限制和反爬虫检测

**Proxycast 实现优先级:** 🔥 高优先级

---

### 4. Location Customization (位置定制) ⭐⭐
**功能描述:**
- 配置代理、地理位置、设备配置文件
- 模拟真实用户行为避免检测
- 支持 190+ 国家和主要城市
- 设备配置: Windows / macOS / Android / iOS

**技术要点:**
- 代理 IP 轮换
- 浏览器指纹伪装
- Geolocation API 覆盖
- User-Agent 和设备特征模拟

**Proxycast 实现优先级:** 🟡 中优先级

---

### 5. Profiles (保存的登录) ⭐⭐⭐
**功能描述:**
- 保存并重用已认证的浏览器会话
- 自动化任务启动时已登录
- 支持从 Multilogin 导入配置文件

**工作流程:**
```
1. 创建 Profile → 在 Profile Mode 中登录 → 保存
2. 使用 Profile → 选择已保存的 Profile → 浏览器自动加载 cookies
3. 管理 Profile → 重命名/删除/刷新
```

**安全性:**
- Cookies 加密存储
- 用户级别隔离
- 支持会话刷新

**Proxycast 实现优先级:** 🔥 高优先级

---

### 6. Credentials (凭证管理) ⭐
**功能描述:**
- 安全存储凭证
- 会话过期时自动重新认证
- 支持双因素认证

**Proxycast 实现优先级:** 🟡 中优先级

---

### 7. AutoCAPTCHA Solver (自动验证码解决) ⭐⭐
**功能描述:**
- 默认启用,无需配置
- 支持多种验证码类型:
  - reCAPTCHA v2/v3
  - TextCAPTCHA
  - AWS WAF CAPTCHA
  - Cloudflare CAPTCHA
  - FunCAPTCHA
  - 等等

**Proxycast 实现优先级:** 🟢 低优先级 (可集成第三方服务)

---

### 8. Scheduled Task (定时任务) ⭐
**功能描述:**
- 一次性任务: 指定日期和时间运行
- 循环任务: 每小时/每天/每周/自定义 cron 表达式

**Proxycast 实现优先级:** 🟡 中优先级

---

### 9. Connections (连接器) ⭐
**功能描述:**
- 集成外部服务: Google Sheets / Google Drive / Gmail
- OAuth 认证
- 自动续期连接

**Proxycast 实现优先级:** 🟢 低优先级

---

### 10. Input & Output (输入输出) ⭐⭐
**功能描述:**
- 支持多种输出格式:
  - 纯文本
  - 列表
  - 表格
  - CSV
  - JSON
  - 超链接

**Proxycast 实现优先级:** 🟡 中优先级

---

## 二、关键实现变更

### 2.1 后端会话层 - CdpSessionManager

在 `src-tauri/src/commands/webview_cmd.rs` 对应能力后新增 `CdpSessionManager`,按 `profile_key + target_id` 管理长连接会话。

#### 会话建立流程
```
1. 发现可用 target
2. 选择 page target
3. 连接 webSocketDebuggerUrl
4. Target.setAutoAttach(flatten=true)
5. 启用 Page/Runtime/Network/Log/Console 域
```

#### 会话状态维护
```rust
// src-tauri/src/cdp/session_manager.rs
pub struct CdpSession {
    pub session_id: String,
    pub target_id: String,
    pub profile_key: String,
    pub remote_debugging_port: u16,

    // 最近页面快照摘要
    pub page_snapshot: PageSnapshot,

    // 最近事件 ring buffer(用于调试与回放)
    pub event_buffer: RingBuffer<BrowserEvent>,

    // 命令请求-响应映射
    pub pending_commands: HashMap<u64, CommandRequest>,

    // WebSocket 连接
    ws: Arc<Mutex<WebSocket>>,
}

pub struct PageSnapshot {
    pub title: String,
    pub url: String,
    pub html_summary: String,  // 或 Markdown 摘要
    pub last_updated: SystemTime,
}
```

---

### 2.2 统一事件模型

新增统一浏览器事件类型,前端与调试页只订阅统一事件流,不直接理解原始 CDP 包。

#### 核心事件类型
```rust
// src-tauri/src/cdp/events.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum BrowserEvent {
    // 会话生命周期
    SessionOpened { session_id: String, target_id: String },
    SessionClosed { session_id: String, reason: String },
    SessionError { session_id: String, error: String },

    // 页面状态
    PageInfoChanged {
        session_id: String,
        title: String,
        url: String,
    },

    // Console 输出
    ConsoleMessage {
        session_id: String,
        level: String,  // log/warn/error
        text: String,
        timestamp: u64,
    },

    // Network 事件
    NetworkRequest {
        session_id: String,
        request_id: String,
        url: String,
        method: String,
    },
    NetworkResponse {
        session_id: String,
        request_id: String,
        status: u16,
        mime_type: String,
    },
    NetworkFailed {
        session_id: String,
        request_id: String,
        error_text: String,
    },

    // DOM 事件(仅摘要)
    DomEvent {
        session_id: String,
        event_type: String,
        summary: String,
    },

    // 画面流
    FrameChunk {
        session_id: String,
        data: String,  // base64 JPEG
        metadata: FrameMetadata,
    },
    FrameDropped {
        session_id: String,
        reason: String,
    },

    // 命令执行
    CommandStarted {
        session_id: String,
        command_id: u64,
        action: String,
    },
    CommandCompleted {
        session_id: String,
        command_id: u64,
        result: serde_json::Value,
    },
    CommandFailed {
        session_id: String,
        command_id: u64,
        error: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameMetadata {
    pub width: u32,
    pub height: u32,
    pub timestamp: u64,
    pub sequence: u64,
}
```

---

### 2.3 命令执行模型 - 高层 Action API

将当前 `browser_execute_action` 的 `cdp_direct` 分支升级为真正的 WebSocket CDP 调用。

#### 支持的高层 Action
```rust
// src-tauri/src/cdp/actions.rs
pub enum BrowserAction {
    Click { selector: String },
    Type { selector: String, text: String },
    Scroll { direction: ScrollDirection, amount: i32 },
    ScrollPage { direction: PageScrollDirection },
    RefreshPage,
    GoBack,
    GoForward,
    Navigate { url: String },
    GetPageInfo,
    ReadConsoleMessages { since: Option<u64> },
    ReadNetworkRequests { since: Option<u64> },
}
```

#### Action → CDP 命令编排
```rust
impl CdpSession {
    pub async fn execute_action(&mut self, action: BrowserAction) -> Result<ActionResult> {
        match action {
            BrowserAction::Navigate { url } => {
                // Page.navigate + lifecycle 等待
                self.ws.send_command("Page.navigate", json!({ "url": url })).await?;
                self.wait_for_lifecycle("load").await?;
                Ok(ActionResult::Success)
            }

            BrowserAction::Click { selector } => {
                // Runtime.evaluate 或 DOM + Input.dispatchMouseEvent
                let element = self.query_selector(&selector).await?;
                self.dispatch_mouse_click(element.x, element.y).await?;
                Ok(ActionResult::Success)
            }

            BrowserAction::GetPageInfo => {
                // Runtime.evaluate 抽取标题、URL、可见文本摘要、关键元素
                let info = self.evaluate_page_info().await?;
                Ok(ActionResult::PageInfo(info))
            }

            BrowserAction::ReadConsoleMessages { since } => {
                // 从长期订阅事件缓冲区读取
                let messages = self.event_buffer
                    .iter()
                    .filter_map(|e| match e {
                        BrowserEvent::ConsoleMessage { timestamp, .. }
                            if since.map_or(true, |s| *timestamp > s) => Some(e.clone()),
                        _ => None,
                    })
                    .collect();
                Ok(ActionResult::ConsoleMessages(messages))
            }

            // ... 其他 action
        }
    }
}
```

---

### 2.4 画面流通道 - Screencast + Screenshot Fallback

#### 默认策略: Page.startScreencast
```rust
// src-tauri/src/cdp/screencast.rs
impl CdpSession {
    pub async fn start_screencast(&mut self) -> Result<()> {
        self.ws.send_command("Page.startScreencast", json!({
            "format": "jpeg",
            "quality": 60,  // 降低质量减少带宽
            "maxWidth": 1280,
            "maxHeight": 720,
            "everyNthFrame": 1
        })).await?;

        // 监听 Page.screencastFrame 事件
        // 转发为 BrowserEvent::FrameChunk
        Ok(())
    }

    async fn handle_screencast_frame(&mut self, params: serde_json::Value) -> Result<()> {
        let data = params["data"].as_str().unwrap();
        let session_id = params["sessionId"].as_u64().unwrap();

        // 发送到前端
        self.emit_event(BrowserEvent::FrameChunk {
            session_id: self.session_id.clone(),
            data: data.to_string(),
            metadata: FrameMetadata {
                width: params["metadata"]["deviceWidth"].as_u64().unwrap() as u32,
                height: params["metadata"]["deviceHeight"].as_u64().unwrap() as u32,
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                sequence: self.frame_sequence,
            },
        }).await?;

        self.frame_sequence += 1;

        // 确认接收
        self.ws.send_command("Page.screencastFrameAck", json!({
            "sessionId": session_id
        })).await?;

        Ok(())
    }
}
```

#### Fallback 策略: Page.captureScreenshot 轮询
```rust
impl CdpSession {
    pub async fn start_screenshot_polling(&mut self, interval_ms: u64) -> Result<()> {
        let mut interval = tokio::time::interval(Duration::from_millis(interval_ms));

        loop {
            interval.tick().await;

            match self.capture_screenshot().await {
                Ok(data) => {
                    self.emit_event(BrowserEvent::FrameChunk {
                        session_id: self.session_id.clone(),
                        data,
                        metadata: FrameMetadata {
                            width: 1280,
                            height: 720,
                            timestamp: chrono::Utc::now().timestamp_millis() as u64,
                            sequence: self.frame_sequence,
                        },
                    }).await?;

                    self.frame_sequence += 1;
                }
                Err(e) => {
                    self.emit_event(BrowserEvent::FrameDropped {
                        session_id: self.session_id.clone(),
                        reason: e.to_string(),
                    }).await?;
                }
            }
        }
    }

    async fn capture_screenshot(&self) -> Result<String> {
        let result = self.ws.send_command("Page.captureScreenshot", json!({
            "format": "jpeg",
            "quality": 60
        })).await?;

        Ok(result["data"].as_str().unwrap().to_string())
    }
}
```

#### 帧流缓存策略
```rust
// 只保留最近 N 帧缓存,避免内存膨胀
const MAX_FRAME_BUFFER_SIZE: usize = 30;  // 约 1 秒的缓存(30fps)

impl CdpSession {
    fn add_frame_to_buffer(&mut self, frame: FrameChunk) {
        if self.frame_buffer.len() >= MAX_FRAME_BUFFER_SIZE {
            self.frame_buffer.pop_front();
        }
        self.frame_buffer.push_back(frame);
    }
}
```

---

### 2.5 Tauri/前端接口

在 `src/lib/webview-api.ts` 扩展公共接口。

#### 新增 API
```typescript
// src/lib/webview-api.ts

/** 打开 CDP 会话 */
export async function openCdpSession(params: {
  profile_key: string;
  target_id?: string;
}): Promise<{ session_id: string; target_id: string }> {
  return invoke('open_cdp_session', params);
}

/** 关闭 CDP 会话 */
export async function closeCdpSession(params: {
  session_id: string;
}): Promise<void> {
  return invoke('close_cdp_session', params);
}

/** 启动浏览器流 */
export async function startBrowserStream(params: {
  session_id: string;
  mode: 'events' | 'frames' | 'both';
}): Promise<void> {
  return invoke('start_browser_stream', params);
}

/** 停止浏览器流 */
export async function stopBrowserStream(params: {
  session_id: string;
  mode?: 'events' | 'frames' | 'both';
}): Promise<void> {
  return invoke('stop_browser_stream', params);
}

/** 执行浏览器 Action(复用现有 API,补充 session_id/target_id) */
export async function browserExecuteAction(params: {
  session_id?: string;
  action: BrowserAction;
  // ... 现有参数
}): Promise<ActionResult & { session_id: string; target_id: string }> {
  return invoke('browser_execute_action', params);
}

/** 获取浏览器会话状态 */
export async function getBrowserSessionState(params: {
  session_id: string;
}): Promise<SessionState> {
  return invoke('get_browser_session_state', params);
}

/** 获取浏览器事件缓冲区 */
export async function getBrowserEventBuffer(params: {
  session_id: string;
  cursor?: number;
}): Promise<{ events: BrowserEvent[]; next_cursor: number }> {
  return invoke('get_browser_event_buffer', params);
}
```

#### 事件订阅
```typescript
// 订阅统一浏览器事件
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<BrowserEvent>('browser-event', (event) => {
  switch (event.payload.type) {
    case 'SessionOpened':
      console.log('会话已打开:', event.payload.session_id);
      break;
    case 'FrameChunk':
      updateCanvas(event.payload.data);
      break;
    case 'ConsoleMessage':
      addConsoleLog(event.payload);
      break;
    // ... 处理其他事件
  }
});
```

---

### 2.6 Profiles - 会话持久化

#### 数据库设计
```sql
-- src-tauri/migrations/add_profiles.sql
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    cookies_encrypted BLOB NOT NULL,
    local_storage TEXT,
    session_storage TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER
);

CREATE INDEX idx_profiles_domain ON profiles(domain);
```

#### Profile Service
```rust
// src-tauri/src/services/profile_service.rs
pub struct ProfileService {
    db: Arc<Database>,
    encryption_key: Vec<u8>,
}

impl ProfileService {
    pub async fn save_profile(
        &self,
        name: String,
        domain: String,
        cookies: Vec<Cookie>,
    ) -> Result<String> {
        let profile_id = Uuid::new_v4().to_string();

        // 加密 cookies (AES-256-GCM)
        let cookies_json = serde_json::to_vec(&cookies)?;
        let encrypted = self.encrypt(&cookies_json)?;

        sqlx::query!(
            "INSERT INTO profiles (id, name, domain, cookies_encrypted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
            profile_id,
            name,
            domain,
            encrypted,
            chrono::Utc::now().timestamp(),
            chrono::Utc::now().timestamp()
        )
        .execute(&self.db.pool)
        .await?;

        Ok(profile_id)
    }

    pub async fn load_profile(&self, profile_id: &str) -> Result<Vec<Cookie>> {
        let row = sqlx::query!(
            "SELECT cookies_encrypted FROM profiles WHERE id = ?",
            profile_id
        )
        .fetch_one(&self.db.pool)
        .await?;

        let decrypted = self.decrypt(&row.cookies_encrypted)?;
        let cookies: Vec<Cookie> = serde_json::from_slice(&decrypted)?;

        Ok(cookies)
    }

    fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        // AES-256-GCM 加密实现
        use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
        use aes_gcm::aead::Aead;

        let cipher = Aes256Gcm::new_from_slice(&self.encryption_key)?;
        let nonce = Nonce::from_slice(b"unique nonce"); // 实际应使用随机 nonce

        let ciphertext = cipher.encrypt(nonce, data)?;
        Ok(ciphertext)
    }

    fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        // AES-256-GCM 解密实现
        use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
        use aes_gcm::aead::Aead;

        let cipher = Aes256Gcm::new_from_slice(&self.encryption_key)?;
        let nonce = Nonce::from_slice(b"unique nonce");

        let plaintext = cipher.decrypt(nonce, data)?;
        Ok(plaintext)
    }
}
```

---

### 2.7 调试与可观测性

在现有 ChromeRelaySettings 旁补一个最小调试面板。

#### 调试面板组件
```typescript
// src/components/BrowserDebugPanel.tsx
export function BrowserDebugPanel({ sessionId }: { sessionId: string }) {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequest[]>([]);

  useEffect(() => {
    // 订阅浏览器事件
    const unlisten = listen<BrowserEvent>('browser-event', (event) => {
      if (event.payload.session_id !== sessionId) return;

      switch (event.payload.type) {
        case 'ConsoleMessage':
          setConsoleMessages(prev => [...prev, event.payload]);
          break;
        case 'NetworkRequest':
        case 'NetworkResponse':
          updateNetworkRequests(event.payload);
          break;
      }
    });

    return () => { unlisten.then(fn => fn()); };
  }, [sessionId]);

  return (
    <div className="debug-panel">
      <div className="session-info">
        <h3>会话状态</h3>
        <div>Profile: {sessionState?.profile_key}</div>
        <div>Target: {sessionState?.target_id}</div>
        <div>最后心跳: {sessionState?.last_heartbeat}</div>
        <div>最近命令: {sessionState?.last_command}</div>
      </div>

      <div className="console-view">
        <h3>Console</h3>
        {consoleMessages.map((msg, i) => (
          <div key={i} className={`console-${msg.level}`}>
            [{msg.level}] {msg.text}
          </div>
        ))}
      </div>

      <div className="network-view">
        <h3>Network</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>URL</th>
              <th>Status</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {networkRequests.map((req, i) => (
              <tr key={i}>
                <td>{req.method}</td>
                <td>{req.url}</td>
                <td>{req.status}</td>
                <td>{req.mime_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="live-preview">
        <h3>实时画面</h3>
        <LiveViewCanvas sessionId={sessionId} />
      </div>
    </div>
  );
}
```

#### 错误与日志集成
所有原始 CDP 错误、命令超时、target detach 都进入现有 audit/log 体系:

```rust
// src-tauri/src/cdp/session_manager.rs
impl CdpSession {
    async fn handle_error(&self, error: CdpError) {
        // 记录到现有日志系统
        tracing::error!(
            session_id = %self.session_id,
            target_id = %self.target_id,
            error = ?error,
            "CDP session error"
        );

        // 发送错误事件
        self.emit_event(BrowserEvent::SessionError {
            session_id: self.session_id.clone(),
            error: error.to_string(),
        }).await.ok();
    }
}
```

---

## 三、实现优先级路线图

### Phase 1: 核心 CDP 会话 (2-3 周) 🔥

**目标**: 建立稳定的 CDP WebSocket 会话,实现基础事件流和命令执行

#### 任务清单
- [ ] **CdpSessionManager** - 会话生命周期管理
  - 发现 target 并建立 WebSocket 连接
  - Target.setAutoAttach + 启用 Page/Runtime/Network/Log/Console 域
  - 会话状态维护(page_snapshot, event_buffer, pending_commands)

- [ ] **统一事件模型** - BrowserEvent 枚举定义
  - 会话生命周期事件(SessionOpened/Closed/Error)
  - 页面状态事件(PageInfoChanged)
  - Console/Network 事件
  - 命令执行事件(CommandStarted/Completed/Failed)

- [ ] **高层 Action API** - browser_execute_action 升级
  - Navigate + lifecycle 等待
  - Click/Type (Runtime.evaluate 或 DOM + Input)
  - GetPageInfo (Runtime.evaluate 抽取摘要)
  - ReadConsoleMessages/ReadNetworkRequests (从 event_buffer 读取)

- [ ] **Tauri 命令接口**
  - `open_cdp_session`
  - `close_cdp_session`
  - `browser_execute_action` (补充 session_id/target_id)
  - `get_browser_session_state`
  - `get_browser_event_buffer`

- [ ] **事件推送** - Tauri event 通道
  - 后端通过 `app.emit("browser-event", event)` 推送
  - 前端通过 `listen<BrowserEvent>('browser-event')` 订阅

#### 验收标准
- ✅ 启动一个 profile,会话建立后能实时看到 PageInfoChanged 事件
- ✅ 执行 navigate/click/type 时,前端能收到 CommandStarted/Completed 事件
- ✅ Console 输出和 Network 请求能实时推送到前端
- ✅ 断开浏览器时,会话能正确关闭并发送 SessionClosed 事件

---

### Phase 2: 画面流通道 (1-2 周) 🔥

**目标**: 实现实时画面流式传输,支持 screencast + screenshot fallback

#### 任务清单
- [ ] **Screencast 实现**
  - `Page.startScreencast` + `Page.screencastFrameAck`
  - 监听 `Page.screencastFrame` 事件
  - 转发为 `BrowserEvent::FrameChunk`
  - 帧流缓存(最近 30 帧)

- [ ] **Screenshot Fallback**
  - `Page.captureScreenshot` 轮询(默认 200ms 间隔)
  - 自动降级策略(screencast 失败时切换)
  - `BrowserEvent::FrameDropped` 错误上报

- [ ] **前端 LiveView 组件**
  - Canvas 渲染 base64 JPEG 帧
  - 远程控制(鼠标/键盘事件转发)
  - 工具栏(启用/禁用控制、截图、停止会话)

- [ ] **Tauri 命令接口**
  - `start_browser_stream` (mode: events/frames/both)
  - `stop_browser_stream`

#### 验收标准
- ✅ 启动 screencast 后,前端能实时看到浏览器画面(30fps)
- ✅ 点击 Canvas 能触发远程浏览器的点击事件
- ✅ Screencast 失败时自动降级到 screenshot 轮询
- ✅ 帧流缓存不超过 30 帧,避免内存膨胀

---

### Phase 3: Profiles 持久化 (1-2 周) 🔥

**目标**: 实现浏览器会话持久化,支持 Cookies 加密存储

#### 任务清单
- [ ] **数据库设计**
  - `profiles` 表(id, name, domain, cookies_encrypted, created_at, updated_at)
  - 索引(idx_profiles_domain)

- [ ] **ProfileService**
  - `save_profile` - AES-256-GCM 加密 cookies
  - `load_profile` - 解密并返回 cookies
  - `list_profiles` - 列出所有 profiles
  - `delete_profile` - 删除 profile

- [ ] **Tauri 命令接口**
  - `create_profile` - 创建新 profile
  - `load_profile_cookies` - 加载 profile 的 cookies
  - `list_profiles` - 列出所有 profiles
  - `delete_profile` - 删除 profile

- [ ] **前端 Profiles 管理页面**
  - ProfileCard 组件
  - CreateProfileModal 组件
  - 编辑/删除 profile

#### 验收标准
- ✅ 创建 profile 后,cookies 被加密存储到数据库
- ✅ 加载 profile 时,cookies 被正确解密并应用到浏览器
- ✅ 前端能列出、创建、编辑、删除 profiles
- ✅ 加密密钥安全存储,用户级别隔离

---

### Phase 4: 调试面板 (1 周) 🟡

**目标**: 提供最小调试面板,方便开发和排障

#### 任务清单
- [ ] **BrowserDebugPanel 组件**
  - 会话状态显示(profile_key, target_id, last_heartbeat)
  - Console 视图(实时显示 console 输出)
  - Network 视图(请求列表、状态、类型)
  - 实时画面预览(复用 LiveViewCanvas)

- [ ] **错误与日志集成**
  - CDP 错误记录到 tracing
  - 命令超时上报
  - Target detach 处理

#### 验收标准
- ✅ 调试面板能显示当前会话状态
- ✅ Console 输出实时更新
- ✅ Network 请求列表实时更新
- ✅ CDP 错误能在日志中查看

---

### Phase 5: API 服务器扩展 (可选) 🟢

**目标**: 提供 NextBrowser 兼容的 HTTP API

#### 任务清单
- [ ] **任务管理 API**
  - `POST /api/v1/chat/tasks` - 创建任务
  - `GET /api/v1/chat/sessions/{session_id}/state` - 查询任务状态
  - `GET /api/v1/browser/browser_id/{browser_id}/tabs` - 获取浏览器标签页

- [ ] **Profile 管理 API**
  - `POST /api/v1/profiles` - 创建 profile
  - `GET /api/v1/profiles` - 列出 profiles
  - `DELETE /api/v1/profiles/{profile_id}` - 删除 profile

#### 验收标准
- ✅ API 端点符合 NextBrowser 规范
- ✅ 支持 JSON 请求/响应
- ✅ 错误处理和状态码正确

---

## 四、测试与验收

### 4.1 Rust 单元测试

```rust
// src-tauri/src/cdp/session_manager_test.rs

#[tokio::test]
async fn test_session_lifecycle() {
    let manager = CdpSessionManager::new();

    // 创建会话
    let session_id = manager.open_session("test_profile", None).await.unwrap();
    assert!(!session_id.is_empty());

    // 获取会话状态
    let state = manager.get_session_state(&session_id).await.unwrap();
    assert_eq!(state.profile_key, "test_profile");

    // 关闭会话
    manager.close_session(&session_id).await.unwrap();

    // 验证会话已关闭
    assert!(manager.get_session_state(&session_id).await.is_err());
}

#[tokio::test]
async fn test_event_mapping() {
    // 测试 CDP 事件到统一事件的映射
    let cdp_event = json!({
        "method": "Console.messageAdded",
        "params": {
            "message": {
                "level": "error",
                "text": "Test error",
                "timestamp": 1234567890
            }
        }
    });

    let browser_event = map_cdp_event(cdp_event).unwrap();

    match browser_event {
        BrowserEvent::ConsoleMessage { level, text, .. } => {
            assert_eq!(level, "error");
            assert_eq!(text, "Test error");
        }
        _ => panic!("Expected ConsoleMessage event"),
    }
}

#[tokio::test]
async fn test_command_timeout() {
    let session = CdpSession::new("test_session", "test_target", "ws://localhost:9222");

    // 发送命令并设置超时
    let result = session.execute_action(BrowserAction::Navigate {
        url: "https://example.com".to_string()
    }).await;

    // 验证超时处理
    // ...
}

#[tokio::test]
async fn test_screencast_fallback() {
    let mut session = CdpSession::new("test_session", "test_target", "ws://localhost:9222");

    // 模拟 screencast 失败
    session.screencast_enabled = false;

    // 启动画面流
    session.start_screencast().await.unwrap();

    // 验证自动降级到 screenshot
    assert!(session.screenshot_fallback_active);
}
```

---

### 4.2 前端测试

```typescript
// src/lib/webview-api.test.ts
import { describe, it, expect, vi } from 'vitest';
import { openCdpSession, closeCdpSession } from './webview-api';

describe('webview-api', () => {
  it('should open CDP session', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      session_id: 'test-session',
      target_id: 'test-target'
    });

    global.invoke = mockInvoke;

    const result = await openCdpSession({ profile_key: 'test' });

    expect(result.session_id).toBe('test-session');
    expect(mockInvoke).toHaveBeenCalledWith('open_cdp_session', {
      profile_key: 'test'
    });
  });

  it('should close CDP session', async () => {
    const mockInvoke = vi.fn().mockResolvedValue(undefined);
    global.invoke = mockInvoke;

    await closeCdpSession({ session_id: 'test-session' });

    expect(mockInvoke).toHaveBeenCalledWith('close_cdp_session', {
      session_id: 'test-session'
    });
  });
});
```

```typescript
// src/components/BrowserDebugPanel.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserDebugPanel } from './BrowserDebugPanel';

describe('BrowserDebugPanel', () => {
  it('should render session info', () => {
    render(<BrowserDebugPanel sessionId="test-session" />);

    expect(screen.getByText(/会话状态/i)).toBeInTheDocument();
  });

  it('should handle no stream state', () => {
    render(<BrowserDebugPanel sessionId="test-session" />);

    // 验证无流状态下的 UI
    expect(screen.queryByText(/实时画面/i)).toBeInTheDocument();
  });

  it('should handle disconnection', async () => {
    const { rerender } = render(<BrowserDebugPanel sessionId="test-session" />);

    // 模拟断线
    // ...

    rerender(<BrowserDebugPanel sessionId="test-session" />);

    // 验证断线状态
    // ...
  });
});
```

---

### 4.3 集成验证

#### 场景 1: 基础会话建立
```bash
# 1. 启动 Proxycast
npm run tauri:dev

# 2. 打开调试面板
# 3. 创建新会话
# 4. 验证:
#    - 能看到 SessionOpened 事件
#    - 能看到 PageInfoChanged 事件(标题/URL)
#    - Console 视图显示初始日志
#    - Network 视图显示初始请求
```

#### 场景 2: 实时画面流
```bash
# 1. 在已建立的会话中启动画面流
# 2. 验证:
#    - 画面连续刷新(30fps)
#    - 点击 Canvas 能触发远程点击
#    - 输入键盘能触发远程输入
#    - 帧流缓存不超过 30 帧
```

#### 场景 3: 命令执行
```bash
# 1. 执行 navigate 命令
# 2. 验证:
#    - 收到 CommandStarted 事件
#    - 页面导航成功
#    - 收到 CommandCompleted 事件
#    - 出错时收到 CommandFailed 事件(包含 CDP 错误)
```

#### 场景 4: 断线重连
```bash
# 1. 关闭浏览器进程
# 2. 验证:
#    - 收到 SessionClosed 事件
#    - 前端状态正确更新
#    - 不残留脏 session
```

#### 场景 5: Profile 持久化
```bash
# 1. 创建 Profile 并登录网站
# 2. 保存 Profile
# 3. 关闭会话
# 4. 重新加载 Profile
# 5. 验证:
#    - Cookies 被正确加载
#    - 网站保持登录状态
#    - 加密存储安全
```

---

### 4.4 验收标准总结

#### 核心功能
- ✅ cdp_direct 不再报"需要建立 WebSocket DevTools 会话后补齐"
- ✅ 用户在任务执行期间可同时看到:
  - 实时画面(30fps)
  - Console/Network 事件
  - 命令结果
- ✅ 默认链路在 macOS 与 Windows 都可运行

#### 性能指标
- ✅ 画面流延迟 < 200ms
- ✅ 事件推送延迟 < 100ms
- ✅ 命令执行响应 < 500ms
- ✅ 内存占用 < 500MB (单会话)

#### 稳定性
- ✅ 会话断线自动重连(最多 3 次)
- ✅ Screencast 失败自动降级到 screenshot
- ✅ 命令超时自动取消(默认 30s)
- ✅ 帧流缓存不超过 30 帧

---

## 五、默认决策与假设

### 架构决策
- ✅ **默认以当前仓库落地为目标**,不设计独立外部服务
- ✅ **默认先实现单 page target 单活会话**,多 tab 并发观察放到第二阶段,但数据模型提前兼容
- ✅ **默认优先走 Tauri event 推送事件与帧**,只有验证吞吐不足时再切专用本地 WebSocket
- ✅ **默认画面流使用 JPEG screencast**,并提供 screenshot fallback,暂不引入视频编码、录屏文件落盘、音频流
- ✅ **默认只暴露高层 action API 给业务层**,原始 CDP 命令透传仅保留给调试入口,避免公共接口过早失控
- ✅ **默认不改动现有后端优先级策略**,只增强 cdp_direct 能力,保持 KISS / YAGNI,避免再造第四套浏览器控制通道

### 技术选型
- ✅ **WebSocket**: 使用 `tokio-tungstenite` 实现 CDP WebSocket 连接
- ✅ **事件推送**: 优先使用 Tauri event,吞吐不足时切换到本地 WebSocket
- ✅ **加密**: 使用 `aes-gcm` crate 实现 AES-256-GCM 加密
- ✅ **数据库**: 使用 SQLite + sqlx
- ✅ **日志**: 使用 `tracing` crate

### 平台兼容性
- ✅ **macOS**: 默认支持,Chrome 路径 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- ✅ **Windows**: 默认支持,Chrome 路径 `C:\Program Files\Google\Chrome\Application\chrome.exe`
- ✅ **Linux**: 暂不支持,但数据模型兼容

---

## 六、技术难点与解决方案

### 6.1 实时视频流性能优化

**问题**: `Page.startScreencast` 产生大量 JPEG 帧,可能导致带宽和 CPU 压力

**解决方案**:
1. **动态调整帧率和质量**
   ```rust
   // 根据网络状况动态调整
   if network_latency > 200ms {
       quality = 40;  // 降低质量
       everyNthFrame = 2;  // 降低帧率
   }
   ```

2. **客户端缓存和差分编码**
   ```typescript
   // 只渲染变化的区域
   const diff = computeFrameDiff(prevFrame, currentFrame);
   if (diff.percentage < 5%) {
       skipFrame();
   }
   ```

3. **WebRTC 替代方案(第二阶段)**
   - 使用 WebRTC Data Channel 传输帧
   - 更低延迟(< 100ms)
   - 自动拥塞控制

---

### 6.2 多浏览器实例管理

**问题**: 同时运行多个浏览器实例,需要隔离和资源管理

**解决方案**:
1. **独立用户数据目录**
   ```rust
   let user_data_dir = format!("/tmp/proxycast/profile_{}", profile_key);
   let chrome_args = vec![
       format!("--user-data-dir={}", user_data_dir),
       "--no-first-run",
       "--no-default-browser-check",
   ];
   ```

2. **端口池管理**
   ```rust
   pub struct PortPool {
       available_ports: Vec<u16>,
       used_ports: HashMap<String, u16>,
   }

   impl PortPool {
       pub fn allocate(&mut self, session_id: &str) -> Option<u16> {
           let port = self.available_ports.pop()?;
           self.used_ports.insert(session_id.to_string(), port);
           Some(port)
       }

       pub fn release(&mut self, session_id: &str) {
           if let Some(port) = self.used_ports.remove(session_id) {
               self.available_ports.push(port);
           }
       }
   }
   ```

3. **资源限制**
   ```rust
   // 使用 tokio 限制并发会话数
   const MAX_CONCURRENT_SESSIONS: usize = 10;

   let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_SESSIONS));

   async fn create_session() -> Result<Session> {
       let _permit = semaphore.acquire().await?;
       // 创建会话...
   }
   ```

---

### 6.3 Cookies 加密安全

**问题**: Cookies 包含敏感信息,需要安全存储

**解决方案**:
1. **AES-256-GCM 加密**
   ```rust
   use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
   use aes_gcm::aead::{Aead, OsRng};

   pub fn encrypt_cookies(cookies: &[Cookie], key: &[u8]) -> Result<Vec<u8>> {
       let cipher = Aes256Gcm::new_from_slice(key)?;

       // 生成随机 nonce
       let mut nonce_bytes = [0u8; 12];
       OsRng.fill_bytes(&mut nonce_bytes);
       let nonce = Nonce::from_slice(&nonce_bytes);

       let plaintext = serde_json::to_vec(cookies)?;
       let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())?;

       // 拼接 nonce + ciphertext
       let mut result = nonce_bytes.to_vec();
       result.extend_from_slice(&ciphertext);

       Ok(result)
   }

   pub fn decrypt_cookies(data: &[u8], key: &[u8]) -> Result<Vec<Cookie>> {
       let cipher = Aes256Gcm::new_from_slice(key)?;

       // 分离 nonce 和 ciphertext
       let (nonce_bytes, ciphertext) = data.split_at(12);
       let nonce = Nonce::from_slice(nonce_bytes);

       let plaintext = cipher.decrypt(nonce, ciphertext)?;
       let cookies: Vec<Cookie> = serde_json::from_slice(&plaintext)?;

       Ok(cookies)
   }
   ```

2. **密钥派生(PBKDF2)**
   ```rust
   use pbkdf2::{pbkdf2_hmac};
   use sha2::Sha256;

   pub fn derive_encryption_key(password: &str, salt: &[u8]) -> [u8; 32] {
       let mut key = [0u8; 32];
       pbkdf2_hmac::<Sha256>(
           password.as_bytes(),
           salt,
           100_000,  // 迭代次数
           &mut key
       );
       key
   }
   ```

3. **用户级别隔离**
   ```rust
   // 每个用户使用独立的加密密钥
   let user_salt = format!("proxycast_user_{}", user_id);
   let encryption_key = derive_encryption_key(&user_password, user_salt.as_bytes());
   ```

---

### 6.4 WebSocket 连接稳定性

**问题**: CDP WebSocket 连接可能断开,需要自动重连

**解决方案**:
1. **心跳检测**
   ```rust
   impl CdpSession {
       async fn start_heartbeat(&self) {
           let mut interval = tokio::time::interval(Duration::from_secs(30));

           loop {
               interval.tick().await;

               if let Err(e) = self.ws.send_ping().await {
                   tracing::warn!("Heartbeat failed: {}", e);
                   self.reconnect().await.ok();
               }
           }
       }
   }
   ```

2. **自动重连**
   ```rust
   impl CdpSession {
       async fn reconnect(&mut self) -> Result<()> {
           const MAX_RETRIES: usize = 3;
           const RETRY_DELAY: Duration = Duration::from_secs(2);

           for attempt in 1..=MAX_RETRIES {
               tracing::info!("Reconnecting attempt {}/{}", attempt, MAX_RETRIES);

               match self.connect_websocket().await {
                   Ok(ws) => {
                       self.ws = ws;
                       self.resubscribe_events().await?;
                       return Ok(());
                   }
                   Err(e) => {
                       tracing::warn!("Reconnect failed: {}", e);
                       tokio::time::sleep(RETRY_DELAY).await;
                   }
               }
           }

           Err(anyhow!("Failed to reconnect after {} attempts", MAX_RETRIES))
       }
   }
   ```

3. **事件重放**
   ```rust
   // 重连后重新订阅事件
   async fn resubscribe_events(&self) -> Result<()> {
       self.ws.send_command("Page.enable", json!({})).await?;
       self.ws.send_command("Runtime.enable", json!({})).await?;
       self.ws.send_command("Network.enable", json!({})).await?;
       self.ws.send_command("Log.enable", json!({})).await?;
       self.ws.send_command("Console.enable", json!({})).await?;

       Ok(())
   }
   ```

---

### 6.5 事件推送吞吐量

**问题**: Tauri event 可能无法满足高频事件推送(如 30fps 画面流)

**解决方案**:
1. **批量推送**
   ```rust
   // 批量推送事件,减少 IPC 开销
   const BATCH_SIZE: usize = 10;
   const BATCH_INTERVAL: Duration = Duration::from_millis(100);

   let mut event_batch = Vec::new();
   let mut interval = tokio::time::interval(BATCH_INTERVAL);

   loop {
       tokio::select! {
           event = event_rx.recv() => {
               event_batch.push(event);

               if event_batch.len() >= BATCH_SIZE {
                   app.emit("browser-events", &event_batch)?;
                   event_batch.clear();
               }
           }
           _ = interval.tick() => {
               if !event_batch.is_empty() {
                   app.emit("browser-events", &event_batch)?;
                   event_batch.clear();
               }
           }
       }
   }
   ```

2. **本地 WebSocket Fallback**
   ```rust
   // 当 Tauri event 吞吐不足时,切换到本地 WebSocket
   if event_rate > 100 {  // 每秒超过 100 个事件
       switch_to_local_websocket().await?;
   }

   async fn switch_to_local_websocket() -> Result<()> {
       let listener = TcpListener::bind("127.0.0.1:0").await?;
       let port = listener.local_addr()?.port();

       // 通知前端切换到 WebSocket
       app.emit("switch-to-websocket", json!({ "port": port }))?;

       // 接受 WebSocket 连接
       let (stream, _) = listener.accept().await?;
       let ws = tokio_tungstenite::accept_async(stream).await?;

       // 通过 WebSocket 推送事件
       // ...

       Ok(())
   }
   ```

---

## 七、与现有 Proxycast 架构的集成

### 7.1 复用现有模块

**现有基础设施**:
- ✅ `webview_cmd.rs` - 已有 CDP HTTP 探测,升级为 WebSocket 会话
- ✅ `server.rs` - 扩展 API 端点(任务管理、Profile 管理)
- ✅ `database.rs` - 添加 Profiles 表
- ✅ DevBridge - 前端与 Tauri 通信,复用事件推送机制

**集成策略**:
1. **不改动现有优先级**: aster_compat、proxycast_extension_bridge、cdp_direct 继续并存
2. **只增强 cdp_direct**: 从 HTTP 探测升级为有状态 WebSocket 会话
3. **保持接口兼容**: `browser_execute_action` 保持现有签名,补充 `session_id`/`target_id` 返回值

---

### 7.2 新增模块

```
src-tauri/src/
├── cdp/
│   ├── mod.rs                  # CDP 模块入口
│   ├── session_manager.rs      # CdpSessionManager - 会话生命周期管理
│   ├── events.rs               # BrowserEvent - 统一事件模型
│   ├── actions.rs              # BrowserAction - 高层 Action API
│   ├── screencast.rs           # Screencast + Screenshot Fallback
│   ├── input.rs                # 远程控制(鼠标/键盘)
│   └── websocket.rs            # CDP WebSocket 封装
├── services/
│   ├── profile_service.rs      # Profile 加密存储与加载
│   ├── port_pool.rs            # CDP 端口池管理
│   └── browser_pool.rs         # 浏览器实例池(可选,第二阶段)
├── models/
│   ├── profile.rs              # Profile 数据模型
│   ├── session.rs              # Session 数据模型
│   └── browser_settings.rs     # BrowserSettings 数据模型
└── commands/
    └── cdp_commands.rs         # 新增 Tauri 命令(open_cdp_session 等)
```

---

### 7.3 数据库迁移

```sql
-- src-tauri/migrations/YYYYMMDD_add_profiles.sql
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    cookies_encrypted BLOB NOT NULL,
    local_storage TEXT,
    session_storage TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_profiles_domain ON profiles(domain);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
```

---

### 7.4 前端集成

**新增页面**:
```
src/pages/
├── LiveView.tsx              # 实时画面 + 远程控制
├── Profiles.tsx              # Profile 管理
└── BrowserDebug.tsx          # 调试面板
```

**新增组件**:
```
src/components/
├── LiveViewCanvas.tsx        # Canvas 渲染画面流
├── ConsoleOutput.tsx         # Console 输出视图
├── NetworkTable.tsx          # Network 请求表格
├── ProfileCard.tsx           # Profile 卡片
└── CreateProfileModal.tsx    # 创建 Profile 弹窗
```

**新增 Hooks**:
```
src/hooks/
├── useCdpSession.ts          # CDP 会话管理
├── useBrowserEvents.ts       # 浏览器事件订阅
└── useProfiles.ts            # Profile CRUD
```

---

## 八、总结

### 核心价值
NextBrowser 的核心价值在于:
1. **实时可视化** - Live View 让用户看到自动化过程
2. **会话持久化** - Profiles 避免重复登录
3. **远程调试** - CDP Debugger 提供专业调试能力

### 实施策略
Proxycast 已经具备了 CDP 基础设施,采用**渐进式增强**策略:
1. **Phase 1 (2-3 周)**: 核心 CDP 会话 - 建立稳定的 WebSocket 连接和统一事件模型
2. **Phase 2 (1-2 周)**: 画面流通道 - 实现 screencast + screenshot fallback
3. **Phase 3 (1-2 周)**: Profiles 持久化 - 实现 Cookies 加密存储
4. **Phase 4 (1 周)**: 调试面板 - 提供最小调试界面
5. **Phase 5 (可选)**: API 服务器扩展 - NextBrowser 兼容 API

### 预期成果
- ✅ **6-8 周**完成核心功能实现
- ✅ **跨平台兼容**(macOS + Windows)
- ✅ **保持现有架构**,不引入第四套浏览器控制通道
- ✅ **统一抽象层**,前端只消费统一事件,不直接理解 CDP
- ✅ **生产可用**,满足实时流控、远程调试、会话持久化需求

### 关键决策
- ✅ 采用 Codex 的架构思路(CdpSessionManager + 统一事件模型)
- ✅ 采用 NextBrowser 的功能清单(Live View + Profiles + Debugger)
- ✅ 优先 Tauri event,吞吐不足时切 WebSocket
- ✅ Screencast 优先,Screenshot fallback
- ✅ 单 page target 先行,多 tab 后续
- ✅ 高层 action API,原始 CDP 仅调试用
