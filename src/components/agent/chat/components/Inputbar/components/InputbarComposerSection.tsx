import React from "react";
import type { ChatInputAdapter } from "@/components/input-kit/adapters/types";
import type { Character } from "@/lib/api/memory";
import type { Skill } from "@/lib/api/skills";
import type { QueuedTurnSnapshot } from "@/lib/api/agentRuntime";
import type { MessageImage } from "../../../types";
import { CharacterMention } from "./CharacterMention";
import { InputbarCore } from "./InputbarCore";
import { SkillSelector } from "./SkillSelector";
import { ThemeWorkbenchStatusPanel } from "./ThemeWorkbenchStatusPanel";
import { InputbarModelExtra } from "./InputbarModelExtra";
import { InputbarExecutionStrategySelect } from "./InputbarExecutionStrategySelect";
import { isGeneralResearchTheme } from "../../../utils/generalAgentPrompt";
import type {
  ThemeWorkbenchGateState,
  ThemeWorkbenchQuickAction,
  ThemeWorkbenchWorkflowStep,
} from "../hooks/useThemeWorkbenchInputState";

interface InputbarComposerSectionProps {
  renderThemeWorkbenchGeneratingPanel: boolean;
  themeWorkbenchGate?: ThemeWorkbenchGateState | null;
  themeWorkbenchQuickActions: ThemeWorkbenchQuickAction[];
  themeWorkbenchQueueItems: ThemeWorkbenchWorkflowStep[];
  inputAdapter: ChatInputAdapter;
  characters: Character[];
  skills: Skill[];
  isSkillsLoading?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  input: string;
  activeSkill?: Skill | null;
  onSelectCharacter?: (character: Character) => void;
  onSelectSkill: (skill: Skill) => void;
  onClearSkill?: () => void;
  onNavigateToSettings?: () => void;
  onImportSkill?: () => void | Promise<void>;
  onRefreshSkills?: () => void | Promise<void>;
  onSend: () => void;
  onToolClick: (tool: string) => void;
  activeTools: Record<string, boolean>;
  executionStrategy?: "react" | "code_orchestrated" | "auto";
  pendingImages: MessageImage[];
  onRemoveImage: (index: number) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  isFullscreen: boolean;
  isCanvasOpen: boolean;
  isThemeWorkbenchVariant: boolean;
  activeTheme?: string;
  onManageProviders?: () => void;
  setExecutionStrategy?: (
    strategy: "react" | "code_orchestrated" | "auto",
  ) => void;
  topExtra?: React.ReactNode;
  queuedTurns: QueuedTurnSnapshot[];
  onRemoveQueuedTurn?: (queuedTurnId: string) => void | Promise<boolean>;
}

export const InputbarComposerSection: React.FC<
  InputbarComposerSectionProps
> = ({
  renderThemeWorkbenchGeneratingPanel,
  themeWorkbenchGate,
  themeWorkbenchQuickActions,
  themeWorkbenchQueueItems,
  inputAdapter,
  characters,
  skills,
  isSkillsLoading,
  textareaRef,
  input,
  activeSkill,
  onSelectCharacter,
  onSelectSkill,
  onClearSkill,
  onNavigateToSettings,
  onImportSkill,
  onRefreshSkills,
  onSend,
  onToolClick,
  activeTools,
  executionStrategy,
  pendingImages,
  onRemoveImage,
  onPaste,
  isFullscreen,
  isCanvasOpen,
  isThemeWorkbenchVariant,
  activeTheme,
  onManageProviders,
  setExecutionStrategy,
  topExtra,
  queuedTurns,
  onRemoveQueuedTurn,
}) => {
  const showSkillSelector =
    !isThemeWorkbenchVariant && isGeneralResearchTheme(activeTheme);

  if (renderThemeWorkbenchGeneratingPanel) {
    return (
      <ThemeWorkbenchStatusPanel
        gate={themeWorkbenchGate}
        quickActions={themeWorkbenchQuickActions}
        queueItems={themeWorkbenchQueueItems}
        renderGeneratingPanel
        onQuickAction={inputAdapter.actions.setText}
        onStop={inputAdapter.actions.stop}
      />
    );
  }

  return (
    <>
      <ThemeWorkbenchStatusPanel
        gate={themeWorkbenchGate}
        quickActions={themeWorkbenchQuickActions}
        queueItems={themeWorkbenchQueueItems}
        renderGeneratingPanel={false}
        onQuickAction={inputAdapter.actions.setText}
        onStop={inputAdapter.actions.stop}
      />
      <CharacterMention
        characters={characters}
        skills={skills}
        inputRef={textareaRef}
        value={input}
        onChange={inputAdapter.actions.setText}
        onSelectCharacter={onSelectCharacter}
        onSelectSkill={onSelectSkill}
        onNavigateToSettings={onNavigateToSettings}
      />
      <InputbarCore
        textareaRef={textareaRef}
        text={inputAdapter.state.text}
        setText={inputAdapter.actions.setText}
        onSend={onSend}
        onStop={inputAdapter.actions.stop}
        isLoading={inputAdapter.state.isSending}
        disabled={inputAdapter.state.disabled}
        onToolClick={onToolClick}
        activeTools={activeTools}
        executionStrategy={executionStrategy}
        showExecutionStrategy={false}
        pendingImages={
          (inputAdapter.state.attachments as MessageImage[] | undefined) ||
          pendingImages
        }
        onRemoveImage={onRemoveImage}
        onPaste={onPaste}
        isFullscreen={isFullscreen}
        isCanvasOpen={isCanvasOpen}
        placeholder={
          isThemeWorkbenchVariant
            ? themeWorkbenchGate?.status === "waiting"
              ? "说说你的选择，剩下的交给我"
              : "试着输入任何指令，剩下的交给我"
            : undefined
        }
        toolMode={isThemeWorkbenchVariant ? "attach-only" : "default"}
        showTranslate={!isThemeWorkbenchVariant}
        showDragHandle={!isThemeWorkbenchVariant}
        visualVariant={isThemeWorkbenchVariant ? "floating" : "default"}
        topExtra={topExtra}
        activeTheme={activeTheme}
        queuedTurns={queuedTurns}
        onRemoveQueuedTurn={onRemoveQueuedTurn}
        leftExtra={
          <>
            {showSkillSelector ? (
              <SkillSelector
                skills={skills}
                activeSkill={activeSkill}
                isLoading={isSkillsLoading}
                onSelectSkill={onSelectSkill}
                onClearSkill={onClearSkill}
                onNavigateToSettings={onNavigateToSettings}
                onImportSkill={onImportSkill}
                onRefreshSkills={onRefreshSkills}
              />
            ) : null}
            <InputbarModelExtra
              isFullscreen={isFullscreen}
              isThemeWorkbenchVariant={isThemeWorkbenchVariant}
              providerType={inputAdapter.model?.providerType}
              setProviderType={inputAdapter.actions.setProviderType}
              model={inputAdapter.model?.model}
              setModel={inputAdapter.actions.setModel}
              activeTheme={activeTheme}
              onManageProviders={onManageProviders}
            />
          </>
        }
        rightExtra={
          <InputbarExecutionStrategySelect
            isFullscreen={isFullscreen}
            isThemeWorkbenchVariant={isThemeWorkbenchVariant}
            executionStrategy={executionStrategy}
            setExecutionStrategy={setExecutionStrategy}
          />
        }
      />
    </>
  );
};
