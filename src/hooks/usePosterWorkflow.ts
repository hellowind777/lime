/**
 * @file usePosterWorkflow.ts
 * @description 海报工作流 Hook
 * @module hooks/usePosterWorkflow
 */

import { useState, useCallback, useMemo } from "react";
import {
  getWorkflowTemplate,
  allWorkflowTemplates,
  type WorkflowTemplate,
  type WorkflowStep,
  type WorkflowStepStatus,
  type WorkflowStepState,
  type WorkflowConfig,
  type WorkflowCallbacks,
  type WorkflowContext,
} from "@/components/content-creator/workflows/poster";
import {
  posterAgentScheduler,
  type AgentInput,
  type AgentOutput,
} from "@/components/content-creator/agents";
import { activityLogger } from "@/components/content-creator/utils/activityLogger";

/**
 * 工作流 Hook 返回值
 */
export interface UsePosterWorkflowReturn {
  /** 当前工作流模板 */
  currentWorkflow: WorkflowTemplate | null;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 当前步骤 */
  currentStep: WorkflowStep | null;
  /** 各步骤状态 */
  stepStates: Map<string, WorkflowStepState>;
  /** 是否正在执行 */
  isExecuting: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 总体进度 (0-100) */
  progress: number;
  /** 执行结果 */
  results: Map<string, AgentOutput>;
  /** 所有可用工作流 */
  availableWorkflows: WorkflowTemplate[];
  /** 开始工作流 */
  startWorkflow: (templateId: string, config?: WorkflowConfig) => void;
  /** 执行当前步骤 */
  executeCurrentStep: (context: WorkflowContext) => Promise<AgentOutput | null>;
  /** 跳过当前步骤 */
  skipCurrentStep: () => void;
  /** 前往下一步 */
  goToNextStep: () => void;
  /** 返回上一步 */
  goToPreviousStep: () => void;
  /** 跳转到指定步骤 */
  goToStep: (stepIndex: number) => void;
  /** 重置工作流 */
  resetWorkflow: () => void;
  /** 获取步骤状态 */
  getStepStatus: (stepId: string) => WorkflowStepStatus;
  /** 设置回调 */
  setCallbacks: (callbacks: WorkflowCallbacks) => void;
}

/**
 * 海报工作流 Hook
 *
 * 管理海报设计工作流的状态和执行。
 */
export function usePosterWorkflow(): UsePosterWorkflowReturn {
  // 状态
  const [currentWorkflow, setCurrentWorkflow] =
    useState<WorkflowTemplate | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepStates, setStepStates] = useState<Map<string, WorkflowStepState>>(
    new Map(),
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<Map<string, AgentOutput>>(new Map());
  const [callbacks, setCallbacks] = useState<WorkflowCallbacks>({});

  // 计算属性
  const currentStep = useMemo(() => {
    if (!currentWorkflow) return null;
    return currentWorkflow.steps[currentStepIndex] || null;
  }, [currentWorkflow, currentStepIndex]);

  const isCompleted = useMemo(() => {
    if (!currentWorkflow) return false;
    return currentStepIndex >= currentWorkflow.steps.length;
  }, [currentWorkflow, currentStepIndex]);

  const progress = useMemo(() => {
    if (!currentWorkflow || currentWorkflow.steps.length === 0) return 0;
    const completedSteps = Array.from(stepStates.values()).filter(
      (s) => s.status === "completed" || s.status === "skipped",
    ).length;
    return Math.round((completedSteps / currentWorkflow.steps.length) * 100);
  }, [currentWorkflow, stepStates]);

  // 更新步骤状态
  const updateStepState = useCallback(
    (stepId: string, updates: Partial<WorkflowStepState>) => {
      setStepStates((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(stepId) || { stepId, status: "pending" };
        newMap.set(stepId, { ...current, ...updates });
        return newMap;
      });
    },
    [],
  );

  // 开始工作流
  const startWorkflow = useCallback(
    (templateId: string, _config?: WorkflowConfig) => {
      const template = getWorkflowTemplate(templateId);
      if (!template) {
        console.error(`[usePosterWorkflow] Workflow not found: ${templateId}`);
        return;
      }

      setCurrentWorkflow(template);
      setCurrentStepIndex(0);
      setResults(new Map());

      // 初始化步骤状态
      const initialStates = new Map<string, WorkflowStepState>();
      template.steps.forEach((step, index) => {
        initialStates.set(step.id, {
          stepId: step.id,
          status: index === 0 ? "active" : "pending",
        });
      });
      setStepStates(initialStates);
    },
    [],
  );

  // 执行当前步骤
  const executeCurrentStep = useCallback(
    async (context: WorkflowContext): Promise<AgentOutput | null> => {
      if (!currentStep || !currentWorkflow) return null;

      // 记录步骤开始
      const logId = activityLogger.log({
        eventType: 'step_start',
        status: 'pending',
        title: `执行步骤: ${currentStep.name}`,
        description: currentStep.description,
        metadata: { stepId: currentStep.id },
      });

      const startTime = Date.now();

      setIsExecuting(true);
      updateStepState(currentStep.id, {
        status: "active",
        startedAt: new Date(),
      });
      callbacks.onStepStart?.(currentStep);

      try {
        // 构建 Agent 输入
        const agentInput: AgentInput = {
          userInput: context.userInput,
          context: {
            projectId: context.projectId,
            brandPersonaId: context.brandPersonaId,
            canvasJson: context.canvasJson,
            selectedMaterials: context.selectedMaterials,
            targetPlatforms: context.targetPlatforms,
            workflowId: currentWorkflow.id,
            stepId: currentStep.id,
            previousResults: Object.fromEntries(results),
            ...context.extra,
          },
        };

        // 执行 Agent
        const output = await posterAgentScheduler.runAgent(
          currentStep.agentId,
          agentInput,
        );

        const duration = Date.now() - startTime;

        if (output) {
          // 更新结果
          setResults((prev) => {
            const newMap = new Map(prev);
            newMap.set(currentStep.id, output);
            return newMap;
          });

          // 更新状态
          updateStepState(currentStep.id, {
            status: "completed",
            completedAt: new Date(),
            result: output,
          });

          // 记录步骤完成
          activityLogger.updateLog(logId, {
            status: 'success',
            duration,
            description: `步骤完成，耗时: ${(duration / 1000).toFixed(1)}s`,
          });

          callbacks.onStepComplete?.(currentStep, output);
          callbacks.onProgressUpdate?.(progress, currentStep);
        }

        return output;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // 记录步骤失败
        activityLogger.updateLog(logId, {
          status: 'error',
          duration,
          error: errorMessage,
        });

        updateStepState(currentStep.id, {
          status: "error",
          error: errorMessage,
        });
        callbacks.onStepError?.(currentStep, errorMessage);
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [
      currentStep,
      currentWorkflow,
      results,
      progress,
      callbacks,
      updateStepState,
    ],
  );

  // 跳过当前步骤
  const skipCurrentStep = useCallback(() => {
    if (!currentStep || !currentStep.optional) return;

    // 记录步骤跳过
    activityLogger.log({
      eventType: 'step_skip',
      status: 'success',
      title: `跳过步骤: ${currentStep.name}`,
      description: currentStep.description,
      metadata: { stepId: currentStep.id },
    });

    updateStepState(currentStep.id, {
      status: "skipped",
      completedAt: new Date(),
    });
    callbacks.onStepSkip?.(currentStep);

    // 自动前进到下一步
    goToNextStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, callbacks, updateStepState]);

  // 前往下一步
  const goToNextStep = useCallback(() => {
    if (!currentWorkflow) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < currentWorkflow.steps.length) {
      setCurrentStepIndex(nextIndex);
      updateStepState(currentWorkflow.steps[nextIndex].id, {
        status: "active",
      });
    } else {
      // 工作流完成
      callbacks.onWorkflowComplete?.(results);
    }
  }, [currentWorkflow, currentStepIndex, results, callbacks, updateStepState]);

  // 返回上一步
  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  // 跳转到指定步骤
  const goToStep = useCallback(
    (stepIndex: number) => {
      if (!currentWorkflow) return;
      if (stepIndex >= 0 && stepIndex < currentWorkflow.steps.length) {
        setCurrentStepIndex(stepIndex);
        updateStepState(currentWorkflow.steps[stepIndex].id, {
          status: "active",
        });
      }
    },
    [currentWorkflow, updateStepState],
  );

  // 重置工作流
  const resetWorkflow = useCallback(() => {
    if (!currentWorkflow) return;

    setCurrentStepIndex(0);
    setResults(new Map());

    // 重置步骤状态
    const resetStates = new Map<string, WorkflowStepState>();
    currentWorkflow.steps.forEach((step, index) => {
      resetStates.set(step.id, {
        stepId: step.id,
        status: index === 0 ? "active" : "pending",
      });
    });
    setStepStates(resetStates);
  }, [currentWorkflow]);

  // 获取步骤状态
  const getStepStatus = useCallback(
    (stepId: string): WorkflowStepStatus => {
      return stepStates.get(stepId)?.status || "pending";
    },
    [stepStates],
  );

  return {
    currentWorkflow,
    currentStepIndex,
    currentStep,
    stepStates,
    isExecuting,
    isCompleted,
    progress,
    results,
    availableWorkflows: allWorkflowTemplates,
    startWorkflow,
    executeCurrentStep,
    skipCurrentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    resetWorkflow,
    getStepStatus,
    setCallbacks,
  };
}

export default usePosterWorkflow;
