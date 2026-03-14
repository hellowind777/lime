import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceTheme } from "@/types/page";
import { GeneratedOutputsPanel } from "./workbenchRightRailGeneratedOutputs";
import {
  GenerateBgmPanel,
  GeneratePodcastPanel,
  GenerateSfxPanel,
  GenerateVoiceoverPanel,
} from "./workbenchRightRailAudioPanels";
import {
  GenerateAIVideoPanel,
  GenerateCoverPanel,
  GenerateImagePanel,
  GenerateStoryboardPanel,
  GenerateTitlePanel,
  GenerateVideoAssetsPanel,
  SearchMaterialPanel,
} from "./workbenchRightRailCreationPanels";
import type { WorkbenchRightRailCapabilityController } from "./useWorkbenchRightRailCapabilityController";
import type { WorkbenchRightRailCapabilityItem, WorkbenchRightRailCapabilitySection } from "./workbenchRightRailTypes";

const SECTION_TONE_CLASS: Record<
  WorkbenchRightRailCapabilitySection["tone"],
  string
> = {
  violet: "text-violet-500",
  blue: "text-blue-500",
  pink: "text-pink-500",
};

const CARD_TONE_CLASS: Record<
  WorkbenchRightRailCapabilityItem["tone"],
  { default: string; hover: string; icon: string }
> = {
  violet: {
    default: "border-violet-200/40 bg-violet-50/50 text-slate-700 dark:border-violet-800/30 dark:bg-violet-900/10 dark:text-slate-300",
    hover:
      "hover:border-violet-300/60 hover:bg-violet-100/80 hover:text-violet-800 hover:shadow-sm dark:hover:border-violet-700/50 dark:hover:bg-violet-900/30 dark:hover:text-violet-200 transition-all",
    icon: "text-violet-500 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300",
  },
  blue: {
    default: "border-blue-200/40 bg-blue-50/50 text-slate-700 dark:border-blue-800/30 dark:bg-blue-900/10 dark:text-slate-300",
    hover:
      "hover:border-blue-300/60 hover:bg-blue-100/80 hover:text-blue-800 hover:shadow-sm dark:hover:border-blue-700/50 dark:hover:bg-blue-900/30 dark:hover:text-blue-200 transition-all",
    icon: "text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300",
  },
  pink: {
    default: "border-pink-200/40 bg-pink-50/50 text-slate-700 dark:border-pink-800/30 dark:bg-pink-900/10 dark:text-slate-300",
    hover:
      "hover:border-pink-300/60 hover:bg-pink-100/80 hover:text-pink-800 hover:shadow-sm dark:hover:border-pink-700/50 dark:hover:bg-pink-900/30 dark:hover:text-pink-200 transition-all",
    icon: "text-pink-500 dark:text-pink-400 group-hover:scale-110 transition-transform duration-300",
  },
};

const EXPANDABLE_ACTION_KEYS = new Set([
  "search-material",
  "generate-title",
  "generate-image",
  "generate-cover",
  "generate-storyboard",
  "generate-video-assets",
  "generate-ai-video",
  "generate-voiceover",
  "generate-bgm",
  "generate-sfx",
  "generate-podcast",
]);

function renderExpandedActionPanel(
  itemKey: string,
  controller: WorkbenchRightRailCapabilityController,
) {
  if (itemKey === "search-material") {
    return (
      <SearchMaterialPanel
        key={`panel-${itemKey}`}
        resourceType={controller.searchResourceType}
        searchQuery={controller.searchQuery}
        isSubmitting={controller.searchMaterialSubmitting}
        resultSummary={controller.searchMaterialResultSummary}
        onResourceTypeChange={controller.setSearchResourceType}
        onSearchQueryChange={controller.setSearchQuery}
        onSubmit={() => {
          void controller.handleSubmitSearchMaterial();
        }}
        onCancel={controller.closeSearchMaterialPanel}
      />
    );
  }

  if (itemKey === "generate-title") {
    return (
      <GenerateTitlePanel
        key={`panel-${itemKey}`}
        requirement={controller.titleRequirement}
        onRequirementChange={controller.setTitleRequirement}
        onSubmit={() => {
          void controller.handleSubmitTitleTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-image") {
    return (
      <GenerateImagePanel
        key={`panel-${itemKey}`}
        model={controller.imageModel}
        size={controller.imageSize}
        prompt={controller.imagePrompt}
        isSubmitting={controller.imageSubmitting}
        onModelChange={controller.setImageModel}
        onSizeChange={controller.setImageSize}
        onPromptChange={controller.setImagePrompt}
        onSubmit={() => {
          void controller.handleSubmitImageTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-cover") {
    return (
      <GenerateCoverPanel
        key={`panel-${itemKey}`}
        platform={controller.coverPlatform}
        count={controller.coverCount}
        description={controller.coverDescription}
        isSubmitting={controller.coverSubmitting}
        onPlatformChange={controller.setCoverPlatform}
        onCountChange={controller.setCoverCount}
        onDescriptionChange={controller.setCoverDescription}
        onSubmit={() => {
          void controller.handleSubmitCoverTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-storyboard") {
    return (
      <GenerateStoryboardPanel
        key={`panel-${itemKey}`}
        onSubmit={() => {
          void controller.handleSubmitStoryboardTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-video-assets") {
    return (
      <GenerateVideoAssetsPanel
        key={`panel-${itemKey}`}
        model={controller.videoAssetModel}
        version={controller.videoAssetVersion}
        ratio={controller.videoAssetRatio}
        duration={controller.videoAssetDuration}
        prompt={controller.videoAssetPrompt}
        isSubmitting={controller.videoAssetSubmitting}
        onModelChange={controller.setVideoAssetModel}
        onVersionChange={controller.setVideoAssetVersion}
        onRatioChange={controller.setVideoAssetRatio}
        onDurationChange={controller.setVideoAssetDuration}
        onPromptChange={controller.setVideoAssetPrompt}
        onSubmit={() => {
          void controller.handleSubmitVideoAssetsTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-ai-video") {
    return (
      <GenerateAIVideoPanel
        key={`panel-${itemKey}`}
        scriptContent={controller.aiVideoScriptContent}
        isSubmitting={controller.aiVideoSubmitting}
        onScriptContentChange={controller.setAiVideoScriptContent}
        onSubmit={() => {
          void controller.handleSubmitAIVideoTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-voiceover") {
    return (
      <GenerateVoiceoverPanel
        key={`panel-${itemKey}`}
        speed={controller.voiceoverSpeed}
        toneId={controller.voiceoverToneId}
        prompt={controller.voiceoverPrompt}
        isSubmitting={controller.voiceoverSubmitting}
        generatedAudioUrl={controller.voiceoverAudioUrl}
        toneDialogOpen={controller.voiceToneDialogOpen}
        toneDialogTab={controller.voiceToneDialogTab}
        toneDialogSearchKeyword={controller.voiceToneDialogSearchKeyword}
        onSpeedChange={controller.setVoiceoverSpeed}
        onPromptChange={controller.setVoiceoverPrompt}
        onToneDialogOpenChange={controller.setVoiceToneDialogOpen}
        onToneDialogTabChange={controller.setVoiceToneDialogTab}
        onToneDialogSearchKeywordChange={controller.setVoiceToneDialogSearchKeyword}
        onToneSelect={controller.setVoiceoverToneId}
        onSubmit={() => {
          void controller.handleSubmitVoiceoverTask();
        }}
        onCancel={controller.closeVoiceoverPanel}
      />
    );
  }

  if (itemKey === "generate-bgm") {
    return (
      <GenerateBgmPanel
        key={`panel-${itemKey}`}
        duration={controller.bgmDuration}
        prompt={controller.bgmPrompt}
        isSubmitting={controller.bgmSubmitting}
        onDurationChange={controller.setBgmDuration}
        onPromptChange={controller.setBgmPrompt}
        onSubmit={() => {
          void controller.handleSubmitBgmTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-sfx") {
    return (
      <GenerateSfxPanel
        key={`panel-${itemKey}`}
        duration={controller.sfxDuration}
        prompt={controller.sfxPrompt}
        isSubmitting={controller.sfxSubmitting}
        onDurationChange={controller.setSfxDuration}
        onPromptChange={controller.setSfxPrompt}
        onSubmit={() => {
          void controller.handleSubmitSfxTask();
        }}
        onCancel={controller.closeExpandedAction}
      />
    );
  }

  if (itemKey === "generate-podcast") {
    return (
      <GeneratePodcastPanel
        key={`panel-${itemKey}`}
        mode={controller.podcastMode}
        prompt={controller.podcastPrompt}
        isSubmitting={controller.podcastSubmitting}
        podcastVoiceDialogOpen={controller.podcastVoiceDialogOpen}
        podcastSpeakerMode={controller.podcastSpeakerMode}
        podcastVoiceSearchKeyword={controller.podcastVoiceSearchKeyword}
        onModeChange={controller.setPodcastMode}
        onPromptChange={controller.setPodcastPrompt}
        onPodcastVoiceDialogOpenChange={controller.setPodcastVoiceDialogOpen}
        onPodcastSpeakerModeChange={controller.setPodcastSpeakerMode}
        onPodcastVoiceSearchKeywordChange={controller.setPodcastVoiceSearchKeyword}
        onImportPrompt={controller.handleImportPodcastPrompt}
        onSubmit={() => {
          void controller.handleSubmitPodcastTask();
        }}
        onCancel={controller.closePodcastPanel}
      />
    );
  }

  return null;
}

export function WorkbenchRightRailActionSections({
  sections,
  controller,
  theme,
}: {
  sections: WorkbenchRightRailCapabilitySection[];
  controller: WorkbenchRightRailCapabilityController;
  theme?: WorkspaceTheme;
}) {
  const shouldRenderGeneratedOutputs =
    theme !== "video" || controller.generatedOutputs.length > 0;

  return (
    <>
      {sections.map((section) => {
        const expandedActionInSection = section.items.find(
          (item) => item.key === controller.expandedActionKey,
        )?.key;

        return (
          <section key={section.key} className="space-y-2">
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-semibold",
                SECTION_TONE_CLASS[section.tone],
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{section.title}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {section.items.map((item) => {
                if (item.key === expandedActionInSection) {
                  return renderExpandedActionPanel(item.key, controller);
                }

                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-testid={`workbench-right-rail-action-${item.key}`}
                    className={cn(
                      "group relative h-[58px] rounded-xl border px-3 py-2 text-left transition-all",
                      CARD_TONE_CLASS[item.tone].default,
                      CARD_TONE_CLASS[item.tone].hover,
                    )}
                    onClick={() => {
                      if (EXPANDABLE_ACTION_KEYS.has(item.key)) {
                        controller.handleToggleActionPanel(item.key);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium leading-none">
                      <Icon className={cn("h-3.5 w-3.5 transition-colors", CARD_TONE_CLASS[item.tone].icon)} />
                      <span className="leading-tight">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {shouldRenderGeneratedOutputs ? (
        <GeneratedOutputsPanel items={controller.generatedOutputs} />
      ) : null}
    </>
  );
}
