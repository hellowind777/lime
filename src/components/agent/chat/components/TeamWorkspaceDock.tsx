import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Workflow } from "lucide-react";
import styled, { css, keyframes } from "styled-components";
import type {
  AsterSubagentParentContext,
  AsterSubagentSessionInfo,
} from "@/lib/api/agentRuntime";
import type {
  TeamWorkspaceActivityEntry,
  TeamWorkspaceControlSummary,
  TeamWorkspaceLiveRuntimeState,
  TeamWorkspaceWaitSummary,
} from "../teamWorkspaceRuntime";
import { TeamWorkspaceBoard } from "./TeamWorkspaceBoard";
import type { TeamRoleDefinition } from "../utils/teamDefinitions";

const DockContainer = styled.div<{
  $withBottomOverlay: boolean;
  $placement: "floating" | "inline";
}>`
  position: ${({ $placement }) =>
    $placement === "inline" ? "relative" : "absolute"};
  right: ${({ $placement }) => ($placement === "inline" ? "auto" : "14px")};
  bottom: ${({ $placement, $withBottomOverlay }) =>
    $placement === "inline"
      ? "auto"
      : $withBottomOverlay
        ? "108px"
        : "16px"};
  z-index: ${({ $placement }) => ($placement === "inline" ? 120 : 18)};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`;

const DockPanel = styled.div<{
  $compact?: boolean;
  $placement: "floating" | "inline" | "portal";
  $portalDirection?: "above" | "below";
}>`
  position: ${({ $placement }) =>
    $placement === "inline"
      ? "absolute"
      : $placement === "portal"
        ? "fixed"
        : "relative"};
  right: ${({ $placement }) =>
    $placement === "inline" ? "0" : $placement === "portal" ? "0" : "auto"};
  top: ${({ $placement }) => ($placement === "portal" ? "0" : "auto")};
  bottom: ${({ $placement }) =>
    $placement === "inline" ? "calc(100% + 8px)" : "auto"};
  width: ${({ $compact }) =>
    $compact
      ? "min(360px, calc(100vw - 72px))"
      : "min(720px, calc(100vw - 72px))"};
  max-height: ${({ $compact }) =>
    $compact
      ? "min(240px, calc(100vh - 240px))"
      : "min(620px, calc(100vh - 160px))"};
  overflow: ${({ $compact, $placement }) =>
    $compact ? "hidden" : $placement === "portal" ? "hidden" : "auto"};
  border-radius: 24px;
  display: flex;

  @media (max-width: 1280px) {
    width: ${({ $compact }) =>
      $compact
        ? "min(344px, calc(100vw - 64px))"
        : "min(640px, calc(100vw - 64px))"};
    max-height: ${({ $compact }) =>
      $compact
        ? "min(228px, calc(100vh - 220px))"
        : "min(560px, calc(100vh - 156px))"};
  }

  @media (max-width: 960px) {
    width: ${({ $compact }) =>
      $compact
        ? "min(336px, calc(100vw - 40px))"
        : "min(560px, calc(100vw - 40px))"};
    max-height: ${({ $compact }) =>
      $compact
      ? "min(220px, calc(100vh - 200px))"
      : "min(520px, calc(100vh - 148px))"};
  }

  @media (max-width: 720px) {
    width: calc(100vw - 28px);
    max-height: min(72vh, calc(100vh - 132px));
  }

  transform: ${({ $placement, $portalDirection }) =>
    $placement === "portal" && $portalDirection !== "below"
      ? "translateY(calc(-100% - 8px))"
      : "none"};
  transform-origin: ${({ $placement, $portalDirection }) =>
    $placement === "portal" && $portalDirection === "below"
      ? "top right"
      : "bottom right"};
  z-index: ${({ $placement }) =>
    $placement === "portal" ? 10010 : $placement === "inline" ? 121 : 1};
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`;

const dockAttentionPulse = keyframes`
  0%, 100% {
    box-shadow: 0 16px 40px -28px rgba(15, 23, 42, 0.28);
  }
  50% {
    box-shadow:
      0 18px 46px -28px rgba(15, 23, 42, 0.3),
      0 0 0 8px rgba(56, 189, 248, 0.08);
  }
`;

const dockSignalRipple = keyframes`
  0% {
    transform: scale(0.72);
    opacity: 0.72;
  }
  70% {
    transform: scale(1.4);
    opacity: 0;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
`;

const DockToggle = styled.button<{
  $active: boolean;
  $expanded: boolean;
  $attention: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid
    ${({ $active, $expanded }) =>
      $expanded
        ? "rgba(14, 116, 144, 0.28)"
        : $active
          ? "rgba(56, 189, 248, 0.32)"
          : "rgba(203, 213, 225, 0.9)"};
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 16px 40px -28px rgba(15, 23, 42, 0.28);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
  ${({ $attention }) =>
    $attention
      ? css`
          animation: ${dockAttentionPulse} 2.4s ease-in-out infinite;
        `
      : ""}

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 44px -28px rgba(15, 23, 42, 0.32);
  }
`;

const DockIconShell = styled.span<{ $attention: boolean }>`
  position: relative;
  display: inline-flex;
  height: 28px;
  width: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #ffffff;
  color: #475569;

  ${({ $attention }) =>
    $attention
      ? css`
          color: #0369a1;
          border-color: rgba(125, 211, 252, 0.96);
        `
      : ""}
`;

const DockSignal = styled.span`
  position: absolute;
  top: -2px;
  right: -1px;
  display: inline-flex;
  height: 10px;
  width: 10px;
  border-radius: 999px;
  background: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: rgba(14, 165, 233, 0.36);
    animation: ${dockSignalRipple} 1.8s ease-out infinite;
  }
`;

const EmptyStateCard = styled.section`
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 18px 52px -34px rgba(15, 23, 42, 0.24);
`;

const EmptyStateBody = styled.div`
  padding: 16px;
`;

const EmptyStateEyebrow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
`;

const EmptyStateBadge = styled.span<{ $tone?: "neutral" | "success" }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid
    ${({ $tone }) =>
      $tone === "success" ? "rgba(167, 243, 208, 0.96)" : "rgba(226, 232, 240, 0.96)"};
  background: ${({ $tone }) => ($tone === "success" ? "#ecfdf5" : "#f8fafc")};
  color: ${({ $tone }) => ($tone === "success" ? "#047857" : "#64748b")};
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
`;

const EmptyStateTitle = styled.div`
  margin-top: 12px;
  color: #0f172a;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
`;

const EmptyStateDescription = styled.p`
  margin-top: 8px;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
`;

const EmptyStateFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const EmptyStateDetailCard = styled.div`
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.96);
  background: #f8fafc;
  overflow: hidden;
`;

const EmptyStateDetailToggle = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: transparent;
  color: #0f172a;
  text-align: left;
  transition: background 0.18s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.72);
  }
`;

const EmptyStateDetailTitle = styled.div`
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
`;

const EmptyStateDetailHint = styled.div`
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
`;

const EmptyStateRoleList = styled.div`
  display: grid;
  gap: 10px;
  padding: 0 14px 14px;
`;

const EmptyStateRoleItem = styled.div`
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.96);
  background: #ffffff;
  padding: 10px 12px;
`;

const EmptyStateRoleName = styled.div`
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
`;

const EmptyStateRoleSummary = styled.div`
  margin-top: 4px;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
`;

interface TeamWorkspaceDockProps {
  shellVisible?: boolean;
  withBottomOverlay?: boolean;
  placement?: "floating" | "inline";
  currentSessionId?: string | null;
  currentSessionName?: string | null;
  currentSessionRuntimeStatus?: AsterSubagentSessionInfo["runtime_status"];
  currentSessionLatestTurnStatus?: AsterSubagentSessionInfo["runtime_status"];
  currentSessionQueuedTurnCount?: number;
  childSubagentSessions?: AsterSubagentSessionInfo[];
  subagentParentContext?: AsterSubagentParentContext | null;
  liveRuntimeBySessionId?: Record<string, TeamWorkspaceLiveRuntimeState>;
  liveActivityBySessionId?: Record<string, TeamWorkspaceActivityEntry[]>;
  activityRefreshVersionBySessionId?: Record<string, number>;
  onSendSubagentInput?: (
    sessionId: string,
    message: string,
    options?: { interrupt?: boolean },
  ) => void | Promise<void>;
  onWaitSubagentSession?: (
    sessionId: string,
    timeoutMs?: number,
  ) => void | Promise<void>;
  onWaitActiveTeamSessions?: (
    sessionIds: string[],
    timeoutMs?: number,
  ) => void | Promise<void>;
  onCloseCompletedTeamSessions?: (
    sessionIds: string[],
  ) => void | Promise<void>;
  onCloseSubagentSession?: (sessionId: string) => void | Promise<void>;
  onResumeSubagentSession?: (sessionId: string) => void | Promise<void>;
  onOpenSubagentSession?: (sessionId: string) => void | Promise<void>;
  onReturnToParentSession?: () => void | Promise<void>;
  teamWaitSummary?: TeamWorkspaceWaitSummary | null;
  teamControlSummary?: TeamWorkspaceControlSummary | null;
  selectedTeamLabel?: string | null;
  selectedTeamSummary?: string | null;
  selectedTeamRoles?: TeamRoleDefinition[] | null;
}

interface InlinePanelLayout {
  direction: "above" | "below";
  maxHeight: number;
  right: number;
  top: number;
}

export function TeamWorkspaceDock({
  shellVisible = false,
  withBottomOverlay = false,
  placement = "floating",
  currentSessionId,
  currentSessionName,
  currentSessionRuntimeStatus,
  currentSessionLatestTurnStatus,
  currentSessionQueuedTurnCount = 0,
  childSubagentSessions = [],
  subagentParentContext = null,
  liveRuntimeBySessionId = {},
  liveActivityBySessionId = {},
  activityRefreshVersionBySessionId = {},
  onSendSubagentInput,
  onWaitSubagentSession,
  onWaitActiveTeamSessions,
  onCloseCompletedTeamSessions,
  onCloseSubagentSession,
  onResumeSubagentSession,
  onOpenSubagentSession,
  onReturnToParentSession,
  teamWaitSummary = null,
  teamControlSummary = null,
  selectedTeamLabel,
  selectedTeamSummary,
  selectedTeamRoles = [],
}: TeamWorkspaceDockProps) {
  const hasRealTeamGraph =
    childSubagentSessions.length > 0 || Boolean(subagentParentContext);
  const [expanded, setExpanded] = useState(
    () => placement === "inline" && hasRealTeamGraph,
  );
  const hasInitializedRef = useRef(false);
  const previousHasRealGraphRef = useRef(false);
  const previousPlacementRef = useRef(placement);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const [inlinePanelLayout, setInlinePanelLayout] =
    useState<InlinePanelLayout | null>(null);
  const isCompact = !hasRealTeamGraph;
  const showAttentionCue = hasRealTeamGraph && !expanded;
  const dockCount = subagentParentContext
    ? (subagentParentContext.sibling_subagent_sessions?.length ?? 0) + 1
    : childSubagentSessions.length;
  const shouldPortalPanel = expanded;
  const [teamDetailExpanded, setTeamDetailExpanded] = useState(false);
  const hasSelectedTeamDetails =
    Boolean(selectedTeamSummary?.trim()) || (selectedTeamRoles?.length ?? 0) > 0;
  const toggleLabel = useMemo(() => {
    if (expanded) {
      return "收起 Team";
    }
    if (hasRealTeamGraph) {
      return `查看 Team · ${dockCount}`;
    }
    return "Team";
  }, [dockCount, expanded, hasRealTeamGraph]);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      if (placement === "inline" && hasRealTeamGraph) {
        setExpanded(true);
      }
      previousHasRealGraphRef.current = hasRealTeamGraph;
      previousPlacementRef.current = placement;
      hasInitializedRef.current = true;
      return;
    }

    if (
      previousPlacementRef.current !== placement &&
      placement === "inline" &&
      hasRealTeamGraph
    ) {
      setExpanded(true);
      previousHasRealGraphRef.current = hasRealTeamGraph;
      previousPlacementRef.current = placement;
      return;
    }

    if (!previousHasRealGraphRef.current && hasRealTeamGraph) {
      setExpanded(true);
    }

    previousHasRealGraphRef.current = hasRealTeamGraph;
    previousPlacementRef.current = placement;
  }, [hasRealTeamGraph, placement]);

  const updateInlinePanelLayout = useCallback(() => {
    if (
      !shouldPortalPanel ||
      typeof window === "undefined" ||
      !toggleRef.current
    ) {
      return;
    }

    const rect = toggleRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const availableAbove = Math.max(0, rect.top - 20);
    const availableBelow = Math.max(0, viewportHeight - rect.bottom - 20);
    const direction =
      availableAbove >= 260 || availableAbove >= availableBelow
        ? "above"
        : "below";

    setInlinePanelLayout({
      direction,
      maxHeight:
        direction === "above"
          ? Math.min(620, Math.max(availableAbove, 120))
          : Math.min(620, Math.max(availableBelow, 120)),
      right: Math.max(14, viewportWidth - rect.right),
      top:
        direction === "above"
          ? Math.max(12, rect.top)
          : Math.min(viewportHeight - 12, rect.bottom + 8),
    });
  }, [shouldPortalPanel]);

  useEffect(() => {
    if (!shouldPortalPanel || typeof window === "undefined") {
      setInlinePanelLayout(null);
      return;
    }

    updateInlinePanelLayout();
    window.addEventListener("resize", updateInlinePanelLayout);
    window.addEventListener("scroll", updateInlinePanelLayout, true);
    return () => {
      window.removeEventListener("resize", updateInlinePanelLayout);
      window.removeEventListener("scroll", updateInlinePanelLayout, true);
    };
  }, [shouldPortalPanel, updateInlinePanelLayout]);

  if (!shellVisible && !hasRealTeamGraph) {
    return null;
  }

  const panelContent = hasRealTeamGraph ? (
    <TeamWorkspaceBoard
      embedded={true}
      shellVisible={shellVisible}
      defaultShellExpanded={true}
      currentSessionId={currentSessionId}
      currentSessionName={currentSessionName}
      currentSessionRuntimeStatus={currentSessionRuntimeStatus}
      currentSessionLatestTurnStatus={currentSessionLatestTurnStatus}
      currentSessionQueuedTurnCount={currentSessionQueuedTurnCount}
      childSubagentSessions={childSubagentSessions}
      subagentParentContext={subagentParentContext}
      liveRuntimeBySessionId={liveRuntimeBySessionId}
      liveActivityBySessionId={liveActivityBySessionId}
      activityRefreshVersionBySessionId={activityRefreshVersionBySessionId}
              onSendSubagentInput={onSendSubagentInput}
              onWaitSubagentSession={onWaitSubagentSession}
              onWaitActiveTeamSessions={onWaitActiveTeamSessions}
              onCloseCompletedTeamSessions={onCloseCompletedTeamSessions}
              onCloseSubagentSession={onCloseSubagentSession}
              onResumeSubagentSession={onResumeSubagentSession}
              onOpenSubagentSession={onOpenSubagentSession}
              onReturnToParentSession={onReturnToParentSession}
              teamWaitSummary={teamWaitSummary}
              teamControlSummary={teamControlSummary}
            />
  ) : (
    <EmptyStateCard data-testid="team-workspace-empty-card" role="status">
      <EmptyStateBody>
        <EmptyStateEyebrow>
          <span className="inline-flex items-center gap-2">
            <Workflow className="h-3.5 w-3.5" />
            <span>Team 已启用</span>
          </span>
          <EmptyStateBadge $tone="success">实时订阅</EmptyStateBadge>
        </EmptyStateEyebrow>
        <EmptyStateTitle>等待真实子代理</EmptyStateTitle>
        <EmptyStateDescription>
          模型首次成功调用 <span className="font-mono text-slate-700">spawn_agent</span>{" "}
          后，这里会自动切换到真实团队工作台。
        </EmptyStateDescription>
        {selectedTeamLabel && hasSelectedTeamDetails ? (
          <EmptyStateDetailCard>
            <EmptyStateDetailToggle
              type="button"
              onClick={() => setTeamDetailExpanded((previous) => !previous)}
              aria-expanded={teamDetailExpanded}
              data-testid="team-workspace-selected-team-toggle"
            >
              <div>
                <EmptyStateDetailTitle>{selectedTeamLabel}</EmptyStateDetailTitle>
                <EmptyStateDetailHint>
                  查看当前 Team 配置与角色分工
                </EmptyStateDetailHint>
              </div>
              {teamDetailExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </EmptyStateDetailToggle>
            {teamDetailExpanded ? (
              <EmptyStateRoleList data-testid="team-workspace-selected-team-detail">
                {selectedTeamSummary ? (
                  <EmptyStateRoleItem>
                    <EmptyStateRoleName>Team 摘要</EmptyStateRoleName>
                    <EmptyStateRoleSummary>{selectedTeamSummary}</EmptyStateRoleSummary>
                  </EmptyStateRoleItem>
                ) : null}
                {selectedTeamRoles?.map((role) => (
                  <EmptyStateRoleItem key={`dock-role-${role.id}`}>
                    <EmptyStateRoleName>{role.label}</EmptyStateRoleName>
                    <EmptyStateRoleSummary>{role.summary}</EmptyStateRoleSummary>
                  </EmptyStateRoleItem>
                ))}
              </EmptyStateRoleList>
            ) : null}
          </EmptyStateDetailCard>
        ) : null}
        <EmptyStateFooter>
          {selectedTeamLabel ? (
            <EmptyStateBadge data-testid="team-workspace-selected-team">
              当前 Team：{selectedTeamLabel}
            </EmptyStateBadge>
          ) : null}
          {selectedTeamSummary ? (
            <EmptyStateBadge>{selectedTeamSummary}</EmptyStateBadge>
          ) : null}
          <EmptyStateBadge>不遮挡画布</EmptyStateBadge>
        </EmptyStateFooter>
      </EmptyStateBody>
    </EmptyStateCard>
  );

  const panelNode = (
    <DockPanel
      $compact={isCompact}
      $placement={shouldPortalPanel ? "portal" : placement}
      $portalDirection={inlinePanelLayout?.direction}
      data-testid="team-workspace-dock-panel"
      style={
        shouldPortalPanel && inlinePanelLayout
          ? {
              maxHeight: `${inlinePanelLayout.maxHeight}px`,
              right: `${inlinePanelLayout.right}px`,
              top: `${inlinePanelLayout.top}px`,
            }
          : undefined
      }
    >
      {panelContent}
    </DockPanel>
  );

  return (
    <DockContainer
      $placement={placement}
      $withBottomOverlay={withBottomOverlay}
      data-testid="team-workspace-dock"
    >
      {expanded && !shouldPortalPanel ? panelNode : null}
      <DockToggle
        type="button"
        data-testid="team-workspace-dock-toggle"
        ref={toggleRef}
        aria-expanded={expanded}
        aria-label={expanded ? "收起 Team Workspace" : "展开 Team Workspace"}
        $active={hasRealTeamGraph}
        $expanded={expanded}
        $attention={showAttentionCue}
        onClick={() => setExpanded((previous) => !previous)}
      >
        <DockIconShell $attention={showAttentionCue}>
          <Workflow className="h-4 w-4" />
          {showAttentionCue ? (
            <DockSignal
              aria-hidden="true"
              data-testid="team-workspace-dock-signal"
            />
          ) : null}
        </DockIconShell>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">
          {toggleLabel}
        </span>
      </DockToggle>
      {expanded &&
      shouldPortalPanel &&
      inlinePanelLayout &&
      typeof document !== "undefined"
        ? createPortal(panelNode, document.body)
        : null}
    </DockContainer>
  );
}
