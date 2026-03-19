import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseModelRegistry } = vi.hoisted(() => ({
  mockUseModelRegistry: vi.fn(),
}));

vi.mock("@/hooks/useModelRegistry", () => ({
  useModelRegistry: (...args: unknown[]) => mockUseModelRegistry(...args),
}));

vi.mock("@/lib/api/apiKeyProvider", () => ({
  apiKeyProviderApi: {
    getSystemProviderCatalog: vi.fn(async () => []),
  },
}));

vi.mock("@/lib/api/modelRegistry", () => ({
  modelRegistryApi: {
    getModelRegistryProviderIds: vi.fn(async () => ["openai"]),
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { ProviderModelList } from "./ProviderModelList";

interface MountedRoot {
  root: Root;
  container: HTMLDivElement;
}

const mountedRoots: MountedRoot[] = [];

function renderProviderModelList(
  props: Partial<React.ComponentProps<typeof ProviderModelList>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const mergedProps: React.ComponentProps<typeof ProviderModelList> = {
    providerId: "openai",
    providerType: "openai",
    ...props,
  };

  act(() => {
    root.render(<ProviderModelList {...mergedProps} />);
  });

  mountedRoots.push({ root, container });
  return container;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  mockUseModelRegistry.mockReturnValue({
    models: [
      {
        id: "gpt-4.1",
        display_name: "GPT-4.1",
        provider_id: "openai",
        provider_name: "OpenAI",
        family: "gpt-4.1",
        tier: "pro",
        capabilities: {
          vision: true,
          tools: true,
          streaming: true,
          json_mode: true,
          function_calling: true,
          reasoning: false,
        },
        pricing: null,
        limits: {
          context_length: null,
          max_output_tokens: null,
          requests_per_minute: null,
          tokens_per_minute: null,
        },
        status: "active",
        release_date: "2026-03-01",
        is_latest: true,
        description: null,
        source: "local",
        created_at: 0,
        updated_at: 0,
      },
    ],
    loading: false,
    error: null,
  });
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

describe("ProviderModelList", () => {
  it("应展示思考与多模态能力标签", async () => {
    const container = renderProviderModelList();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("无思考");
    expect(container.textContent).toContain("支持多模态");
  });
});
