import { useSubAgentScheduler } from "@/hooks/useSubAgentScheduler";

import {
  buildCompatSubagentRuntimeSnapshot,
  type CompatSubagentRuntimeSnapshot,
} from "../utils/compatSubagentRuntime";

export function useCompatSubagentRuntime(
  sessionId?: string | null,
): CompatSubagentRuntimeSnapshot {
  const compatSchedulerState = useSubAgentScheduler(sessionId);

  return buildCompatSubagentRuntimeSnapshot(compatSchedulerState);
}
