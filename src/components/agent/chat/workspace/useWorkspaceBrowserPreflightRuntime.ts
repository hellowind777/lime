import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import type { AutoContinueRequestPayload } from "@/lib/api/agentRuntime";
import type {
  BrowserTaskPreflight,
  HandleSendOptions,
} from "../hooks/handleSendTypes";
import type { ConfirmResponse, Message, MessageImage } from "../types";

type BrowserAssistAttentionLevel = "idle" | "info" | "warning";

type WorkspaceSendHandler = (
  images?: MessageImage[],
  webSearch?: boolean,
  thinking?: boolean,
  textOverride?: string,
  sendExecutionStrategy?: "react" | "code_orchestrated" | "auto",
  autoContinuePayload?: AutoContinueRequestPayload,
  sendOptions?: HandleSendOptions,
) => Promise<boolean>;

type EnsureBrowserAssistCanvasHandler = (
  sourceText: string,
  options?: {
    silent?: boolean;
    navigationMode?: "none" | "explicit-url" | "best-effort";
  },
) => Promise<boolean>;

interface UseWorkspaceBrowserPreflightRuntimeParams {
  browserTaskPreflight: BrowserTaskPreflight | null;
  setBrowserTaskPreflight: Dispatch<
    SetStateAction<BrowserTaskPreflight | null>
  >;
  browserAssistLaunching: boolean;
  isBrowserAssistReady: boolean;
  ensureBrowserAssistCanvas: EnsureBrowserAssistCanvasHandler;
  handlePermissionResponse: (response: ConfirmResponse) => Promise<void>;
  sendRef: MutableRefObject<WorkspaceSendHandler>;
}

interface WorkspaceBrowserPreflightRuntimeResult {
  browserAssistEntryLabel: string;
  browserAssistAttentionLevel: BrowserAssistAttentionLevel;
  browserPreflightMessages: Message[] | null;
  handlePermissionResponseWithBrowserPreflight: (
    response: ConfirmResponse,
  ) => Promise<void>;
}

function buildBrowserPreflightMessages(
  preflight: BrowserTaskPreflight,
): Message[] {
  const timestamp = new Date(preflight.createdAt);
  const actionRequired = {
    requestId: preflight.requestId,
    actionType: "ask_user" as const,
    uiKind: "browser_preflight" as const,
    browserRequirement: preflight.requirement,
    browserPrepState: preflight.phase,
    prompt: preflight.reason,
    detail: preflight.detail,
    allowCapabilityFallback: false,
  };

  return [
    {
      id: `${preflight.requestId}:user`,
      role: "user",
      content: preflight.sourceText,
      images: preflight.images.length > 0 ? preflight.images : undefined,
      timestamp,
    },
    {
      id: `${preflight.requestId}:assistant`,
      role: "assistant",
      content: "",
      timestamp: new Date(preflight.createdAt + 1),
      actionRequests: [actionRequired],
      contentParts: [{ type: "action_required", actionRequired }],
    },
  ];
}

export function useWorkspaceBrowserPreflightRuntime({
  browserTaskPreflight,
  setBrowserTaskPreflight,
  browserAssistLaunching,
  isBrowserAssistReady,
  ensureBrowserAssistCanvas,
  handlePermissionResponse,
  sendRef,
}: UseWorkspaceBrowserPreflightRuntimeParams): WorkspaceBrowserPreflightRuntimeResult {
  const browserTaskPreflightLaunchIdRef = useRef("");

  const browserAssistEntryLabel = useMemo(() => {
    if (browserTaskPreflight?.phase === "launching" || browserAssistLaunching) {
      return "浏览器启动中";
    }
    if (
      browserTaskPreflight?.phase === "awaiting_user" ||
      browserTaskPreflight?.phase === "ready_to_resume"
    ) {
      return "等待登录";
    }
    if (browserTaskPreflight?.phase === "failed") {
      return "浏览器未连接";
    }
    if (isBrowserAssistReady) {
      return "浏览器已就绪";
    }
    return "浏览器协助";
  }, [
    browserAssistLaunching,
    browserTaskPreflight?.phase,
    isBrowserAssistReady,
  ]);

  const browserAssistAttentionLevel = useMemo<BrowserAssistAttentionLevel>(
    () => {
      if (
        browserTaskPreflight?.phase === "launching" ||
        browserAssistLaunching
      ) {
        return "info";
      }

      if (
        browserTaskPreflight?.phase === "awaiting_user" ||
        browserTaskPreflight?.phase === "ready_to_resume" ||
        browserTaskPreflight?.phase === "failed"
      ) {
        return "warning";
      }

      return "idle";
    },
    [browserAssistLaunching, browserTaskPreflight?.phase],
  );

  const browserPreflightMessages = useMemo(
    () =>
      browserTaskPreflight
        ? buildBrowserPreflightMessages(browserTaskPreflight)
        : null,
    [browserTaskPreflight],
  );

  const runBrowserTaskPreflight = useCallback(
    async (preflight: BrowserTaskPreflight) => {
      setBrowserTaskPreflight((current) =>
        current?.requestId === preflight.requestId
          ? {
              ...current,
              phase: "launching",
              detail: current.detail,
            }
          : current,
      );

      const launchInput = preflight.launchUrl || preflight.sourceText;
      const navigationMode =
        preflight.launchUrl && preflight.launchUrl !== preflight.sourceText
          ? ("explicit-url" as const)
          : ("best-effort" as const);

      try {
        const launched = await ensureBrowserAssistCanvas(launchInput, {
          silent: false,
          navigationMode,
        });

        setBrowserTaskPreflight((current) => {
          if (current?.requestId !== preflight.requestId) {
            return current;
          }

          if (!launched) {
            return {
              ...current,
              phase: "failed",
              detail:
                "还没有建立可用的浏览器会话。请确认本机浏览器/CDP 可用后重试。",
            };
          }

          return {
            ...current,
            phase: "awaiting_user",
            detail:
              preflight.requirement === "required_with_user_step"
                ? `已为你打开${preflight.platformLabel || "浏览器协助"}。请先在右侧浏览器完成登录、扫码、验证码或授权，再继续当前任务。`
                : "浏览器已经准备好。请确认右侧页面可操作后继续当前任务。",
          };
        });
      } catch (error) {
        setBrowserTaskPreflight((current) => {
          if (current?.requestId !== preflight.requestId) {
            return current;
          }

          return {
            ...current,
            phase: "failed",
            detail:
              error instanceof Error && error.message
                ? error.message
                : "启动浏览器协助失败，请稍后重试。",
          };
        });
      }
    },
    [ensureBrowserAssistCanvas, setBrowserTaskPreflight],
  );

  useEffect(() => {
    if (!browserTaskPreflight) {
      return;
    }

    if (isBrowserAssistReady) {
      if (
        browserTaskPreflight.phase === "launching" ||
        browserTaskPreflight.phase === "failed"
      ) {
        setBrowserTaskPreflight((current) =>
          current?.requestId === browserTaskPreflight.requestId
            ? {
                ...current,
                phase: "awaiting_user",
                detail:
                  current.requirement === "required_with_user_step"
                    ? `浏览器已经连接。请先在右侧完成${current.platformLabel || "目标站点"}登录、扫码或验证码，然后继续当前任务。`
                    : "浏览器已经连接，请确认页面可操作后继续当前任务。",
              }
            : current,
        );
      }
      return;
    }

    if (
      browserTaskPreflight.phase === "awaiting_user" ||
      browserTaskPreflight.phase === "ready_to_resume"
    ) {
      setBrowserTaskPreflight((current) =>
        current?.requestId === browserTaskPreflight.requestId
          ? {
              ...current,
              phase: "failed",
              detail: "浏览器会话已断开，请重新启动浏览器后再继续。",
            }
          : current,
      );
    }
  }, [browserTaskPreflight, isBrowserAssistReady, setBrowserTaskPreflight]);

  const handlePermissionResponseWithBrowserPreflight = useCallback(
    async (response: ConfirmResponse) => {
      if (
        !browserTaskPreflight ||
        response.requestId !== browserTaskPreflight.requestId
      ) {
        await handlePermissionResponse(response);
        return;
      }

      const userData =
        response.userData && typeof response.userData === "object"
          ? (response.userData as Record<string, unknown>)
          : null;
      const browserAction =
        typeof userData?.browserAction === "string"
          ? userData.browserAction
          : "";

      if (browserAction === "launch") {
        await runBrowserTaskPreflight(browserTaskPreflight);
        return;
      }

      if (browserAction === "continue") {
        if (!isBrowserAssistReady) {
          setBrowserTaskPreflight((current) =>
            current?.requestId === browserTaskPreflight.requestId
              ? {
                  ...current,
                  phase: "failed",
                  detail: "尚未检测到可用的浏览器会话，请先启动或恢复浏览器。",
                }
              : current,
          );
          toast.error("浏览器还没有准备好，请先完成启动或恢复浏览器");
          return;
        }

        const pending = browserTaskPreflight;
        setBrowserTaskPreflight(null);
        await sendRef.current(
          pending.images,
          pending.webSearch,
          pending.thinking,
          pending.sourceText,
          pending.sendExecutionStrategy,
          pending.autoContinuePayload,
          {
            ...(pending.sendOptions || {}),
            browserPreflightConfirmed: true,
          },
        );
        return;
      }

      await handlePermissionResponse(response);
    },
    [
      browserTaskPreflight,
      handlePermissionResponse,
      isBrowserAssistReady,
      runBrowserTaskPreflight,
      sendRef,
      setBrowserTaskPreflight,
    ],
  );

  useEffect(() => {
    if (!browserTaskPreflight || browserTaskPreflight.phase !== "launching") {
      if (!browserTaskPreflight) {
        browserTaskPreflightLaunchIdRef.current = "";
      }
      return;
    }

    if (
      browserTaskPreflightLaunchIdRef.current === browserTaskPreflight.requestId
    ) {
      return;
    }

    browserTaskPreflightLaunchIdRef.current = browserTaskPreflight.requestId;
    void runBrowserTaskPreflight(browserTaskPreflight);
  }, [browserTaskPreflight, runBrowserTaskPreflight]);

  return {
    browserAssistEntryLabel,
    browserAssistAttentionLevel,
    browserPreflightMessages,
    handlePermissionResponseWithBrowserPreflight,
  };
}
