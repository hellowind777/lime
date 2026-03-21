import { useCallback, useEffect, useRef, useState } from "react";
import type { HandleSendOptions } from "./handleSendTypes";
import {
  createRuntimeFormationStateFromTeam,
  type TeamWorkspaceRuntimeFormationState,
} from "../teamWorkspaceRuntime";
import { generateEphemeralTeamWithModel } from "../utils/teamAutoGeneration";
import type { TeamDefinition } from "../utils/teamDefinitions";

interface TriggerRuntimeTeamFormationParams {
  input: string;
  providerType: string;
  model: string;
  executionStrategy?: "react" | "code_orchestrated" | "auto";
}

interface PrepareRuntimeTeamBeforeSendParams
  extends TriggerRuntimeTeamFormationParams {
  purpose?: HandleSendOptions["purpose"];
  subagentEnabled?: boolean;
}

interface UseRuntimeTeamFormationOptions {
  activeTheme: string;
  projectId?: string | null;
  sessionId?: string | null;
  selectedTeam?: TeamDefinition | null;
  subagentEnabled: boolean;
  hasRealTeamGraph: boolean;
  generateRuntimeTeam?: typeof generateEphemeralTeamWithModel;
  createRequestId?: () => string;
  now?: () => number;
}

export interface UseRuntimeTeamFormationResult {
  runtimeTeamState: TeamWorkspaceRuntimeFormationState | null;
  clearRuntimeTeamState: () => void;
  triggerRuntimeTeamFormation: (
    params: TriggerRuntimeTeamFormationParams,
  ) => Promise<TeamWorkspaceRuntimeFormationState | null>;
  prepareRuntimeTeamBeforeSend: (
    params: PrepareRuntimeTeamBeforeSendParams,
  ) => Promise<TeamWorkspaceRuntimeFormationState | null>;
}

function defaultCreateRequestId() {
  return crypto.randomUUID();
}

export function shouldPrepareRuntimeTeamBeforeSend(params: {
  subagentEnabled: boolean;
  projectId?: string | null;
  input: string;
  purpose?: HandleSendOptions["purpose"];
}): boolean {
  return (
    params.subagentEnabled &&
    !params.purpose &&
    Boolean(params.projectId) &&
    params.input.trim().length > 0
  );
}

export function useRuntimeTeamFormation({
  activeTheme,
  projectId,
  sessionId,
  selectedTeam,
  subagentEnabled,
  hasRealTeamGraph,
  generateRuntimeTeam = generateEphemeralTeamWithModel,
  createRequestId = defaultCreateRequestId,
  now = () => Date.now(),
}: UseRuntimeTeamFormationOptions): UseRuntimeTeamFormationResult {
  const [runtimeTeamState, setRuntimeTeamState] =
    useState<TeamWorkspaceRuntimeFormationState | null>(null);
  const runtimeTeamRequestIdRef = useRef<string | null>(null);

  const clearRuntimeTeamState = useCallback(() => {
    runtimeTeamRequestIdRef.current = null;
    setRuntimeTeamState(null);
  }, []);

  const triggerRuntimeTeamFormation = useCallback(
    async ({
      input,
      providerType,
      model,
      executionStrategy,
    }: TriggerRuntimeTeamFormationParams) => {
      const normalizedInput = input.trim();
      if (!projectId || !normalizedInput) {
        return null;
      }

      const requestId = createRequestId();
      runtimeTeamRequestIdRef.current = requestId;
      const formingState = createRuntimeFormationStateFromTeam({
        requestId,
        status: "forming",
        blueprintTeam: selectedTeam ?? null,
        updatedAt: now(),
      });
      setRuntimeTeamState(formingState);

      try {
        const runtimeTeam = await generateRuntimeTeam({
          workspaceId: projectId,
          providerType,
          model,
          executionStrategy,
          activeTheme,
          input: normalizedInput,
          blueprintTeam: selectedTeam ?? null,
        });

        if (runtimeTeamRequestIdRef.current !== requestId) {
          return null;
        }

        const formedState = createRuntimeFormationStateFromTeam({
          requestId,
          status: "formed",
          runtimeTeam,
          blueprintTeam: selectedTeam ?? null,
          updatedAt: now(),
        });
        setRuntimeTeamState(formedState);
        return formedState;
      } catch (error) {
        if (runtimeTeamRequestIdRef.current !== requestId) {
          return null;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Team 生成失败";
        const failedState = createRuntimeFormationStateFromTeam({
          requestId,
          status: "failed",
          blueprintTeam: selectedTeam ?? null,
          errorMessage,
          updatedAt: now(),
        });
        setRuntimeTeamState(failedState);
        return failedState;
      }
    },
    [
      activeTheme,
      createRequestId,
      generateRuntimeTeam,
      now,
      projectId,
      selectedTeam,
    ],
  );

  const prepareRuntimeTeamBeforeSend = useCallback(
    ({
      input,
      providerType,
      model,
      executionStrategy,
      purpose,
      subagentEnabled: subagentEnabledOverride,
    }: PrepareRuntimeTeamBeforeSendParams) => {
      const effectiveSubagentEnabled =
        subagentEnabledOverride ?? subagentEnabled;
      if (
        shouldPrepareRuntimeTeamBeforeSend({
          subagentEnabled: effectiveSubagentEnabled,
          projectId,
          input,
          purpose,
        })
      ) {
        return triggerRuntimeTeamFormation({
          input,
          providerType,
          model,
          executionStrategy,
        });
      }

      if (!hasRealTeamGraph) {
        clearRuntimeTeamState();
      }

      return Promise.resolve(null);
    },
    [
      clearRuntimeTeamState,
      hasRealTeamGraph,
      projectId,
      subagentEnabled,
      triggerRuntimeTeamFormation,
    ],
  );

  useEffect(() => {
    clearRuntimeTeamState();
  }, [clearRuntimeTeamState, sessionId]);

  useEffect(() => {
    if (!subagentEnabled && !hasRealTeamGraph) {
      clearRuntimeTeamState();
    }
  }, [clearRuntimeTeamState, hasRealTeamGraph, subagentEnabled]);

  return {
    runtimeTeamState,
    clearRuntimeTeamState,
    triggerRuntimeTeamFormation,
    prepareRuntimeTeamBeforeSend,
  };
}
