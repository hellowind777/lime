import { BrowserRuntimeWorkspace } from "@/features/browser-runtime/BrowserRuntimeWorkspace";

export function BrowserRuntimeDebuggerPage() {
  const params = new URLSearchParams(window.location.search);
  return (
    <BrowserRuntimeWorkspace
      standalone
      initialProfileKey={params.get("profile_key") || undefined}
      initialSessionId={params.get("session_id") || undefined}
    />
  );
}
