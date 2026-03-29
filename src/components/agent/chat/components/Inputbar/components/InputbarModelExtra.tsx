import React from "react";
import { Badge } from "@/components/ui/badge";
import type { ModelSelectorProps } from "@/components/input-kit";
import type { AsterSessionExecutionRuntime } from "@/lib/api/agentRuntime";
import { ChatModelSelector } from "../../ChatModelSelector";
import { getOutputSchemaRuntimeLabel } from "../../../utils/sessionExecutionRuntime";

interface InputbarModelExtraProps {
  isFullscreen?: boolean;
  isThemeWorkbenchVariant?: boolean;
  providerType?: string;
  setProviderType?: (type: string) => void;
  model?: string;
  setModel?: (model: string) => void;
  activeTheme?: string;
  onManageProviders?: () => void;
  executionRuntime?: AsterSessionExecutionRuntime | null;
  backgroundPreload?: ModelSelectorProps["backgroundPreload"];
}

const NOOP_SET_PROVIDER_TYPE = (_type: string) => {};
const NOOP_SET_MODEL = (_model: string) => {};

export const InputbarModelExtra: React.FC<InputbarModelExtraProps> = ({
  isFullscreen = false,
  isThemeWorkbenchVariant = false,
  providerType,
  setProviderType,
  model,
  setModel,
  activeTheme,
  onManageProviders,
  executionRuntime = null,
  backgroundPreload,
}) => {
  if (isFullscreen || isThemeWorkbenchVariant || !providerType || !model) {
    return null;
  }

  const outputSchemaLabel = getOutputSchemaRuntimeLabel(
    executionRuntime?.output_schema_runtime,
  );

  return (
    <div className="flex items-center flex-wrap gap-2">
      <ChatModelSelector
        providerType={providerType}
        setProviderType={setProviderType || NOOP_SET_PROVIDER_TYPE}
        model={model}
        setModel={setModel || NOOP_SET_MODEL}
        activeTheme={activeTheme}
        compactTrigger
        popoverSide="top"
        onManageProviders={onManageProviders}
        backgroundPreload={backgroundPreload}
      />
      {outputSchemaLabel ? (
        <Badge
          variant="outline"
          className="h-7 max-w-[180px] rounded-full border-slate-300/70 bg-white/90 px-3 text-[11px] font-medium text-slate-500 shadow-none"
          title={`结构化输出 ${outputSchemaLabel}`}
        >
          结构化输出 {outputSchemaLabel}
        </Badge>
      ) : null}
    </div>
  );
};
