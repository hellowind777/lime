import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { logAgentDebug } from "@/lib/agentDebug";
import {
  getProject,
  getDefaultProject,
  getOrCreateDefaultProject,
} from "@/lib/api/project";
import { normalizeProjectId } from "../utils/topicProjectResolution";
import { resolveTopicSwitchProject } from "../utils/topicProjectSwitch";

interface PendingTopicSwitchState {
  topicId: string;
  targetProjectId: string;
}

interface UseWorkspaceTopicSwitchParams {
  projectId?: string;
  externalProjectId?: string | null;
  originalSwitchTopic: (topicId: string) => Promise<unknown>;
  startTopicProjectResolution: () => boolean;
  finishTopicProjectResolution: () => void;
  deferTopicSwitch: (topicId: string, targetProjectId: string) => void;
  consumePendingTopicSwitch: (
    currentProjectId?: string | null,
  ) => PendingTopicSwitchState | null;
  rememberProjectId: (nextProjectId?: string | null) => void;
  getRememberedProjectId: () => string | null;
  loadTopicBoundProjectId: (topicId: string) => string | null;
  resetTopicLocalState: () => void;
}

export function useWorkspaceTopicSwitch({
  projectId,
  externalProjectId,
  originalSwitchTopic,
  startTopicProjectResolution,
  finishTopicProjectResolution,
  deferTopicSwitch,
  consumePendingTopicSwitch,
  rememberProjectId,
  getRememberedProjectId,
  loadTopicBoundProjectId,
  resetTopicLocalState,
}: UseWorkspaceTopicSwitchParams) {
  const runTopicSwitch = useCallback(
    async (topicId: string) => {
      const startedAt = Date.now();
      logAgentDebug("AgentChatPage", "runTopicSwitch.start", {
        currentProjectId: projectId ?? null,
        topicId,
      });
      resetTopicLocalState();
      try {
        await originalSwitchTopic(topicId);
        logAgentDebug("AgentChatPage", "runTopicSwitch.success", {
          durationMs: Date.now() - startedAt,
          topicId,
        });
      } catch (error) {
        logAgentDebug(
          "AgentChatPage",
          "runTopicSwitch.error",
          {
            durationMs: Date.now() - startedAt,
            error,
            topicId,
          },
          { level: "error" },
        );
        throw error;
      }
    },
    [originalSwitchTopic, projectId, resetTopicLocalState],
  );

  const switchTopic = useCallback(
    async (topicId: string) => {
      if (!startTopicProjectResolution()) {
        logAgentDebug(
          "AgentChatPage",
          "switchTopic.skipWhileResolving",
          { topicId },
          { level: "warn", throttleMs: 1000 },
        );
        return;
      }

      try {
        logAgentDebug("AgentChatPage", "switchTopic.start", {
          currentProjectId: projectId ?? null,
          externalProjectId: externalProjectId ?? null,
          topicId,
        });
        const decision = await resolveTopicSwitchProject({
          lockedProjectId: externalProjectId ?? null,
          topicBoundProjectId: loadTopicBoundProjectId(topicId),
          lastProjectId: getRememberedProjectId(),
          loadProjectById: async (candidateProjectId) => {
            const project = await getProject(candidateProjectId);
            return project
              ? { id: project.id, isArchived: project.isArchived }
              : null;
          },
          loadDefaultProject: async () => {
            const project = await getDefaultProject();
            return project
              ? { id: project.id, isArchived: project.isArchived }
              : null;
          },
          createDefaultProject: async () => {
            const project = await getOrCreateDefaultProject();
            return project
              ? { id: project.id, isArchived: project.isArchived }
              : null;
          },
        });
        logAgentDebug("AgentChatPage", "switchTopic.decision", {
          createdDefault:
            decision.status === "ok" ? decision.createdDefault : false,
          decisionStatus: decision.status,
          projectId: decision.status === "ok" ? decision.projectId : null,
          topicId,
        });

        if (decision.status === "blocked") {
          toast.error("该任务绑定了其他项目，请先切换到对应项目");
          return;
        }

        if (decision.status === "missing") {
          toast.error("未找到可用项目，请先创建项目");
          return;
        }

        const targetProjectId = decision.projectId;
        if (decision.createdDefault) {
          toast.info("未找到可用项目，已自动创建默认项目");
        }

        const currentProjectId = normalizeProjectId(projectId);
        if (currentProjectId !== targetProjectId) {
          deferTopicSwitch(topicId, targetProjectId);
          logAgentDebug("AgentChatPage", "switchTopic.deferUntilProjectReady", {
            currentProjectId,
            targetProjectId,
            topicId,
          });
          return;
        }

        rememberProjectId(targetProjectId);
        await runTopicSwitch(topicId);
      } catch (error) {
        console.error("[AgentChatPage] 解析任务项目失败:", error);
        logAgentDebug(
          "AgentChatPage",
          "switchTopic.error",
          {
            error,
            projectId: projectId ?? null,
            topicId,
          },
          { level: "error" },
        );
        toast.error("切换任务失败，请稍后重试");
      } finally {
        finishTopicProjectResolution();
      }
    },
    [
      deferTopicSwitch,
      externalProjectId,
      finishTopicProjectResolution,
      getRememberedProjectId,
      loadTopicBoundProjectId,
      projectId,
      rememberProjectId,
      runTopicSwitch,
      startTopicProjectResolution,
    ],
  );

  useEffect(() => {
    const pending = consumePendingTopicSwitch(projectId);
    if (!pending) {
      return;
    }

    const currentProjectId = normalizeProjectId(projectId);
    logAgentDebug("AgentChatPage", "switchTopic.resumePending", {
      projectId: currentProjectId,
      topicId: pending.topicId,
    });
    runTopicSwitch(pending.topicId).catch((error) => {
      console.error("[AgentChatPage] 执行待切换任务失败:", error);
      logAgentDebug(
        "AgentChatPage",
        "switchTopic.resumePendingError",
        {
          error,
          projectId: currentProjectId,
          topicId: pending.topicId,
        },
        { level: "error" },
      );
      toast.error("加载任务失败，请重试");
    });
  }, [consumePendingTopicSwitch, projectId, runTopicSwitch]);

  return {
    runTopicSwitch,
    switchTopic,
  };
}
