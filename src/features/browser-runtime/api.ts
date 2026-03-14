import {
  browserExecuteAction,
  type OpenChromeProfileResponse,
  openChromeProfileWindow,
  closeCdpSession,
  getBrowserEventBuffer,
  getBrowserSessionState,
  launchBrowserRuntimeAssist,
  listCdpTargets,
  openBrowserRuntimeDebuggerWindow,
  openCdpSession,
  releaseBrowserSession,
  resumeBrowserSession,
  startBrowserStream,
  stopBrowserStream,
  takeOverBrowserSession,
  type BrowserEvent,
  type BrowserEventBufferSnapshot,
  type BrowserControlMode,
  type BrowserSessionLifecycleState,
  type BrowserStreamMode,
  type BrowserTransportKind,
  type CdpSessionState,
  type CdpTargetInfo,
} from "@/lib/webview-api";
import {
  hasNativeTauriEventSupport,
  safeListen,
} from "@/lib/dev-bridge/safeInvoke";

export type {
  BrowserEvent,
  BrowserEventBufferSnapshot,
  BrowserControlMode,
  BrowserSessionLifecycleState,
  BrowserStreamMode,
  BrowserTransportKind,
  CdpSessionState,
  CdpTargetInfo,
  OpenChromeProfileResponse,
};

export const browserRuntimeApi = {
  listCdpTargets,
  openCdpSession,
  closeCdpSession,
  startBrowserStream,
  stopBrowserStream,
  getBrowserSessionState,
  takeOverBrowserSession,
  releaseBrowserSession,
  resumeBrowserSession,
  getBrowserEventBuffer,
  openBrowserRuntimeDebuggerWindow,
  launchBrowserRuntimeAssist,
  browserExecuteAction,
  reopenProfileWindow: (params: { profile_key: string; url: string }) =>
    openChromeProfileWindow(params),
  listenBrowserEvent: (handler: (event: { payload: BrowserEvent }) => void) =>
    safeListen<BrowserEvent>("browser-event", handler),
  supportsNativeEvents: () => hasNativeTauriEventSupport(),
};
