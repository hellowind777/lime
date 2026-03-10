# ProxyCast E2E 测试指南

> 端到端测试验证完整用户流程

## 概述

E2E 测试模拟真实用户操作，验证从前端到后端的完整流程。ProxyCast 使用 Tauri 框架，E2E 测试需要覆盖：

- 桌面应用启动和初始化
- 用户界面交互
- API 代理完整流程
- 凭证管理流程

## 测试框架

### Tauri E2E 测试

使用 `tauri-driver` 进行自动化测试：

```bash
# 安装依赖
cargo install tauri-driver

# 运行 E2E 测试
npm run test:e2e
```

### 测试配置

```javascript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    baseURL: "tauri://localhost",
  },
});
```

## 测试场景

### 1. 应用启动流程

```typescript
import { test, expect } from "@playwright/test";

test.describe("应用启动", () => {
  test("应用正常启动并显示主界面", async ({ page }) => {
    // 等待应用加载
    await page.waitForSelector('[data-testid="main-layout"]');

    // 验证核心组件存在
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="content-area"]')).toBeVisible();
  });

  test("首次启动显示欢迎引导", async ({ page }) => {
    // 清除本地存储模拟首次启动
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator('[data-testid="welcome-modal"]')).toBeVisible();
  });
});
```

### 2. 凭证管理流程

```typescript
test.describe("凭证管理", () => {
  test("添加 Kiro 凭证", async ({ page }) => {
    // 打开凭证管理
    await page.click('[data-testid="credentials-tab"]');
    await page.click('[data-testid="add-credential-btn"]');

    // 选择 Provider
    await page.click('[data-testid="provider-kiro"]');

    // 上传凭证文件
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("./tests/fixtures/test-credential.json");

    // 验证凭证添加成功
    await expect(page.locator('[data-testid="credential-item"]')).toBeVisible();
    await expect(page.locator("text=test@example.com")).toBeVisible();
  });

  test("删除凭证", async ({ page }) => {
    // 假设已有凭证
    await page.click('[data-testid="credentials-tab"]');

    // 删除凭证
    await page.click('[data-testid="credential-menu"]');
    await page.click('[data-testid="delete-credential"]');
    await page.click('[data-testid="confirm-delete"]');

    // 验证凭证已删除
    await expect(
      page.locator('[data-testid="credential-item"]'),
    ).not.toBeVisible();
  });
});
```

### 3. API 代理流程

```typescript
test.describe("API 代理", () => {
  test("启动代理服务器", async ({ page }) => {
    await page.click('[data-testid="server-tab"]');
    await page.click('[data-testid="start-server-btn"]');

    // 等待服务器启动
    await expect(page.locator("text=服务器运行中")).toBeVisible();
    await expect(page.locator('[data-testid="server-port"]')).toContainText(
      "8080",
    );
  });

  test("代理请求成功", async ({ page, request }) => {
    // 启动服务器
    await page.click('[data-testid="start-server-btn"]');
    await page.waitForSelector("text=服务器运行中");

    // 发送测试请求
    const response = await request.post(
      "http://localhost:8080/v1/chat/completions",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        data: {
          model: "gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        },
      },
    );

    expect(response.ok()).toBeTruthy();
  });
});
```

### 4. Agent 对话流程

```typescript
test.describe("Agent 对话", () => {
  test("发送消息并接收响应", async ({ page }) => {
    await page.click('[data-testid="agent-tab"]');

    // 输入消息
    await page.fill('[data-testid="message-input"]', "你好，请介绍一下自己");
    await page.click('[data-testid="send-btn"]');

    // 等待响应
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible(
      {
        timeout: 30000,
      },
    );
  });

  test("流式响应正确显示", async ({ page }) => {
    await page.click('[data-testid="agent-tab"]');
    await page.fill('[data-testid="message-input"]', "写一首短诗");
    await page.click('[data-testid="send-btn"]');

    // 验证流式显示（内容逐渐增加）
    const messageEl = page.locator('[data-testid="assistant-message"]');

    let prevLength = 0;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      const text = await messageEl.textContent();
      expect(text?.length).toBeGreaterThan(prevLength);
      prevLength = text?.length || 0;
    }
  });
});
```

## 测试数据管理

### Fixtures

```
tests/
├── fixtures/
│   ├── test-credential.json    # 测试凭证
│   ├── mock-responses/         # Mock API 响应
│   │   ├── chat-completion.json
│   │   └── streaming-response.txt
│   └── test-config.json        # 测试配置
└── e2e/
    └── *.spec.ts
```

### Mock 服务

```typescript
// tests/mocks/api-server.ts
import { setupServer } from "msw/node";
import { rest } from "msw";

export const mockServer = setupServer(
  rest.post("*/v1/chat/completions", (req, res, ctx) => {
    return res(
      ctx.json({
        id: "test-id",
        choices: [
          {
            message: { role: "assistant", content: "Mock response" },
          },
        ],
      }),
    );
  }),
);
```

## 运行 E2E 测试

```bash
# 构建应用
npm run build

# 运行 E2E 测试
npm run test:e2e

# 运行特定测试
npm run test:e2e -- --grep "凭证管理"

# 生成测试报告
npm run test:e2e -- --reporter=html
```

## CI/CD 集成

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm ci

      - name: Build app
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e
```

## 下一步

- [Agent 评估指南](agent-evaluation.md)
- [测试用例：Agent](test-cases/agent-tests.md)
