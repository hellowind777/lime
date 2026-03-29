import { safeInvoke } from "@/lib/dev-bridge";
import type { ProjectContext } from "@/types/context";

export async function getProjectContext(
  projectId: string,
): Promise<ProjectContext> {
  return safeInvoke<ProjectContext>("get_project_context", { projectId });
}

export async function buildProjectSystemPrompt(
  projectId: string,
): Promise<string> {
  return safeInvoke<string>("build_project_system_prompt", { projectId });
}
