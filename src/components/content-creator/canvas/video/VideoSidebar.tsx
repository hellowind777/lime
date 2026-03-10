import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Dices,
  ImagePlus,
  Monitor,
  X,
} from "lucide-react";
import { VideoCanvasState, VideoAspectRatio, VideoResolution } from "./types";

export interface VideoProviderOption {
  id: string;
  name: string;
  customModels: string[];
}

interface VideoSidebarProps {
  state: VideoCanvasState;
  providers: VideoProviderOption[];
  availableModels: string[];
  onStateChange: (state: VideoCanvasState) => void;
}

const SidebarWrapper = styled.div`
  height: 100%;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: hsl(var(--muted) / 0.32);
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  line-height: 1.2;
  margin: 0;
  font-weight: 600;
  color: hsl(var(--foreground));
`;

const ModelTrigger = styled.button`
  width: 100%;
  height: 42px;
  border-radius: 12px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0 12px;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;

  &:hover {
    border-color: hsl(var(--primary) / 0.4);
  }

  &:focus-visible {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.12);
  }
`;

const ModelTriggerText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ModelPanelMask = styled.div`
  position: fixed;
  inset: 0;
  background: hsl(220 36% 6% / 0.65);
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
`;

const ModelPanel = styled.div`
  width: min(760px, calc(100vw - 36px));
  max-height: min(780px, calc(100vh - 36px));
  background: linear-gradient(180deg, #0f172a, #0a1020);
  border: 1px solid rgba(110, 130, 170, 0.35);
  border-radius: 16px;
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
`;

const ModelPanelTitle = styled.div`
  font-size: 28px;
  line-height: 1;
  transform: scale(0.5);
  transform-origin: left center;
  margin: -8px 0 -6px 0;
  color: #e7edf9;
  font-weight: 700;
`;

const ModelPanelDivider = styled.div`
  height: 1px;
  background: rgba(134, 157, 197, 0.2);
`;

const ModelPanelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding-right: 2px;
`;

const ModelPanelItem = styled.button<{ $active: boolean }>`
  width: 100%;
  border: 1px solid
    ${(props) =>
      props.$active ? "rgba(112, 164, 255, 0.55)" : "rgba(132, 149, 185, 0.26)"};
  border-radius: 14px;
  background: ${(props) =>
    props.$active
      ? "linear-gradient(180deg, rgba(45, 80, 145, 0.6), rgba(28, 52, 96, 0.6))"
      : "rgba(10, 20, 38, 0.82)"};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  gap: 10px;
  color: #d9e4f7;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(117, 173, 255, 0.48);
    background: ${(props) =>
      props.$active
        ? "linear-gradient(180deg, rgba(45, 80, 145, 0.65), rgba(28, 52, 96, 0.65))"
        : "rgba(18, 32, 60, 0.88)"};
  }
`;

const ModelPanelBody = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const ModelPanelName = styled.div`
  font-size: 30px;
  line-height: 1;
  transform: scale(0.5);
  transform-origin: left center;
  margin: -7px 0 -6px 0;
  font-weight: 700;
  color: #f1f5ff;
`;

const ModelPanelCost = styled.div`
  font-size: 24px;
  line-height: 1;
  transform: scale(0.5);
  transform-origin: left center;
  margin: -3px 0 -3px 0;
  color: #93a6ca;
  font-weight: 600;
`;

const ModelPanelDesc = styled.div`
  font-size: 22px;
  line-height: 1.15;
  transform: scale(0.5);
  transform-origin: left center;
  margin: -2px 0 -2px 0;
  color: #aab8d4;
`;

const ModelPanelSelected = styled.div<{ $active: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid
    ${(props) => (props.$active ? "rgba(92, 154, 255, 0.95)" : "rgba(126, 147, 184, 0.35)")};
  background: ${(props) =>
    props.$active ? "rgba(56, 117, 221, 0.86)" : "rgba(28, 44, 73, 0.68)"};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #eff5ff;
  flex-shrink: 0;
`;

const ImageUploadArea = styled.div<{ $dragging?: boolean }>`
  min-height: 116px;
  border-radius: 12px;
  background: ${(props) =>
    props.$dragging ? "hsl(var(--primary) / 0.08)" : "hsl(var(--muted) / 0.3)"};
  border: 1px dashed
    ${(props) => (props.$dragging ? "hsl(var(--primary))" : "hsl(var(--border))")};
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  transition:
    border-color 0.2s,
    background 0.2s;
  padding: 10px;
  cursor: pointer;

  &:hover {
    background: hsl(var(--muted) / 0.5);
    border-color: hsl(var(--primary));
  }
`;

const UploadPrompt = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;

  svg {
    margin-bottom: 6px;
    color: hsl(var(--muted-foreground));
  }
`;

const UploadActionButton = styled.button`
  margin-top: 8px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: hsl(var(--primary));
    color: hsl(var(--primary));
  }
`;

const PreviewBox = styled.div`
  width: 100%;
  min-height: 116px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--border));

  img {
    display: block;
    width: 100%;
    max-height: 140px;
    object-fit: cover;
  }
`;

const ReplaceHint = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  font-size: 11px;
  color: hsl(var(--foreground));
  background: linear-gradient(transparent, hsl(var(--background) / 0.88));
  padding: 20px 8px 8px;
  text-align: center;
`;

const RemovePreviewButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: hsl(var(--background) / 0.9);
  color: hsl(var(--foreground));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const ReplacePreviewButton = styled.button`
  position: absolute;
  top: 8px;
  left: 8px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: hsl(var(--background) / 0.92);
  color: hsl(var(--foreground));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
`;

const RatioGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
`;

const RatioItem = styled.div<{ $active?: boolean }>`
  min-height: 56px;
  border-radius: 10px;
  background: ${(props) =>
    props.$active ? "hsl(var(--primary)/0.1)" : "hsl(var(--muted)/0.3)"};
  border: 1px solid
    ${(props) => (props.$active ? "hsl(var(--primary) / 0.5)" : "transparent")};
  color: ${(props) =>
    props.$active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;

  &:hover {
    background: ${(props) =>
      props.$active ? "hsl(var(--primary)/0.1)" : "hsl(var(--muted)/0.5)"};
  }

  svg {
    margin-bottom: 3px;
    width: 16px;
    height: 16px;
  }
`;

const RatioShape = styled.div<{ $active?: boolean }>`
  width: 12px;
  height: 12px;
  border: 1px solid
    ${(props) =>
      props.$active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"};
  border-radius: 3px;
  margin-bottom: 4px;
`;

const ResolutionWrapper = styled.div`
  padding: 2px;
  border-radius: 12px;
  background: hsl(var(--muted) / 0.35);
`;

const ResolutionGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
`;

const ResolutionButton = styled.button<{ $active?: boolean }>`
  height: 34px;
  border-radius: 9px;
  border: 1px solid
    ${(props) => (props.$active ? "hsl(var(--primary))" : "hsl(var(--border))")};
  background: ${(props) =>
    props.$active ? "hsl(var(--background))" : "hsl(var(--muted) / 0.1)"};
  color: ${(props) =>
    props.$active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: hsl(var(--primary));
    color: hsl(var(--primary));
  }
`;

const DurationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const DurationSlider = styled.input`
  flex: 1;
  accent-color: hsl(var(--foreground));
  cursor: pointer;
`;

const DurationValue = styled.input`
  width: 52px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  text-align: center;
  font-size: 14px;
  outline: none;
`;

const SeedRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SeedInput = styled.input`
  flex: 1;
  height: 38px;
  border-radius: 10px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0 10px;
  font-size: 12px;
  outline: none;
`;

const SeedRandomButton = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    color: hsl(var(--foreground));
    border-color: hsl(var(--primary) / 0.4);
  }
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 600;
  color: hsl(var(--foreground));
`;

const ToggleSwitch = styled.button<{ $checked: boolean }>`
  width: 42px;
  height: 24px;
  border: none;
  border-radius: 999px;
  padding: 2px;
  cursor: pointer;
  background: ${(props) =>
    props.$checked ? "hsl(var(--foreground))" : "hsl(var(--border))"};
  display: flex;
  align-items: center;
  justify-content: ${(props) => (props.$checked ? "flex-end" : "flex-start")};
  transition: all 0.2s;
`;

const ToggleDot = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: hsl(var(--background));
`;

const FooterBar = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0 0;
`;

const FooterButton = styled.button`
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--accent));
  }
`;

const RATIOS: { label: string; value: VideoAspectRatio }[] = [
  { label: "adaptive", value: "adaptive" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "21:9", value: "21:9" },
];

type FrameImageField = "startImage" | "endImage";
type FrameDropArea = "start" | "end";

interface VideoModelOption {
  key: string;
  providerId: string;
  providerName: string;
  model: string;
  label: string;
  cost: string;
  description: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("文件读取失败"));
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function getModelLabel(model: string): string {
  const normalized = model.toLowerCase();
  if (
    normalized === "sora-2-pro" ||
    normalized.includes("sora-2-pro") ||
    normalized.includes("sora2-pro")
  ) {
    return "Sora-2-Pro";
  }
  if (
    normalized === "veo-3.1" ||
    normalized === "veo 3.1" ||
    normalized.includes("veo-3.1")
  ) {
    return "Veo 3.1";
  }
  if (normalized === "sora-2" || normalized.includes("sora-2")) {
    return "Sora-2";
  }
  if (normalized.includes("seedance-1-5-pro")) {
    return "Seedance 1.5 Pro";
  }
  if (normalized.includes("seedance-1-5-lite")) {
    return "Seedance 1.5 Lite";
  }
  if (normalized === "kling-2.6" || normalized.includes("kling-2.6")) {
    return "Kling 2.6";
  }
  if (
    normalized === "minimax-hailuo-2.3" ||
    normalized.includes("hailuo-2.3")
  ) {
    return "Minimax Hailuo 2.3";
  }
  if (
    normalized === "minimax-hailuo-02" ||
    normalized.includes("hailuo-02")
  ) {
    return "Minimax Hailuo-02";
  }
  if (
    normalized === "runway-gen-4-turbo" ||
    normalized.includes("runway-gen-4-turbo")
  ) {
    return "Runway Gen-4 Turbo";
  }
  if (normalized.includes("wanx2.1-t2v-turbo")) {
    return "Wanx 2.1 T2V Turbo";
  }
  if (normalized.includes("wanx2.1-kf2v-plus")) {
    return "Wanx 2.1 KF2V Plus";
  }
  return model;
}

function normalizeModelKey(model: string): string {
  return model.toLowerCase().replace(/\s+/g, "");
}

function getModelMeta(model: string): { cost: string; description: string } {
  const normalized = normalizeModelKey(model);
  if (normalized.includes("veo-3.1")) {
    return {
      cost: "30 credits / sec · est. 240 for 8s",
      description: "Google Veo 3.1 支持1080p/4K，多图参考与首尾帧",
    };
  }
  if (normalized.includes("sora-2-pro") || normalized.includes("sora2-pro")) {
    return {
      cost: "20 credits / sec · est. 80 for 4s",
      description: "Sora-2 Pro 生成时间约2分钟，稳定性高",
    };
  }
  if (normalized.includes("sora-2")) {
    return {
      cost: "2.7 credits / sec · est. 40.5 for 15s",
      description: "Sora2最长15秒，不支持上传人物图",
    };
  }
  if (normalized.includes("seedance-1-5-pro")) {
    return {
      cost: "20 credits / sec · est. 100 for 5s",
      description: "支持文生视频与首帧/首尾帧图生视频",
    };
  }
  if (normalized.includes("kling-2.6")) {
    return {
      cost: "27 credits / sec · est. 135 for 5s",
      description: "支持1080p文生视频和图生视频",
    };
  }
  if (normalized.includes("minimax-hailuo-2.3")) {
    return {
      cost: "25 credits / sec · est. 150 for 6s",
      description: "全新升级的视频生成模型，支持文生视频和图生视频",
    };
  }
  if (normalized.includes("minimax-hailuo-02")) {
    return {
      cost: "25 credits / sec · est. 150 for 6s",
      description: "支持首尾帧与1080p",
    };
  }
  if (normalized.includes("runway-gen-4-turbo")) {
    return {
      cost: "30 credits / sec · est. 150 for 5s",
      description: "仅支持图生视频",
    };
  }
  if (normalized.includes("seedance-1-5-lite")) {
    return {
      cost: "8 credits / sec · est. 40 for 5s",
      description: "轻量版 Seedance，速度更快，成本更低",
    };
  }
  if (normalized.includes("wanx2.1-t2v-turbo")) {
    return {
      cost: "18 credits / sec · est. 90 for 5s",
      description: "阿里万相文生视频 Turbo 模型",
    };
  }
  if (normalized.includes("wanx2.1-kf2v-plus")) {
    return {
      cost: "22 credits / sec · est. 110 for 5s",
      description: "阿里万相关键帧图生视频 Plus 模型",
    };
  }
  return {
    cost: "按服务商计费",
    description: "具体能力与计费以服务商后台为准",
  };
}

function nextRandomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

export const VideoSidebar: React.FC<VideoSidebarProps> = memo(
  ({ state, providers, availableModels, onStateChange }) => {
    const startFileInputRef = useRef<HTMLInputElement>(null);
    const endFileInputRef = useRef<HTMLInputElement>(null);
    const modelPanelRef = useRef<HTMLDivElement>(null);
    const [modelPanelOpen, setModelPanelOpen] = useState(false);
    const [draggingArea, setDraggingArea] = useState<FrameDropArea | null>(null);

    useEffect(() => {
      if (!modelPanelOpen) {
        return;
      }
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setModelPanelOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [modelPanelOpen]);

    const modelOptions = useMemo(() => {
      const options: VideoModelOption[] = [];
      const seenKeys = new Set<string>();
      for (const provider of providers) {
        const providerModels =
          provider.customModels.length > 0
            ? provider.customModels
            : provider.id === state.providerId
              ? availableModels
              : [];
        for (const model of providerModels) {
          const key = `${provider.id}::${model}`;
          if (seenKeys.has(key)) {
            continue;
          }
          seenKeys.add(key);
          const meta = getModelMeta(model);
          options.push({
            key,
            providerId: provider.id,
            providerName: provider.name,
            model,
            label: getModelLabel(model),
            cost: meta.cost,
            description: meta.description,
          });
        }
      }
      if (options.length === 0 && state.providerId && state.model) {
        const meta = getModelMeta(state.model);
        const fallbackProviderName =
          providers.find((provider) => provider.id === state.providerId)?.name ??
          state.providerId;
        options.push({
          key: `${state.providerId}::${state.model}`,
          providerId: state.providerId,
          providerName: fallbackProviderName,
          model: state.model,
          label: getModelLabel(state.model),
          cost: meta.cost,
          description: meta.description,
        });
      }
      return options;
    }, [availableModels, providers, state.model, state.providerId]);

    const selectedModelKey = useMemo(() => {
      const currentKey = `${state.providerId}::${state.model}`;
      if (modelOptions.some((item) => item.key === currentKey)) {
        return currentKey;
      }
      return modelOptions[0]?.key ?? "";
    }, [modelOptions, state.model, state.providerId]);
    const selectedModelOption = useMemo(
      () => modelOptions.find((item) => item.key === selectedModelKey) ?? null,
      [modelOptions, selectedModelKey],
    );

    const frameConfigs: {
      title: string;
      field: FrameImageField;
      area: FrameDropArea;
    }[] = [
      { title: "起始画面", field: "startImage", area: "start" },
      { title: "结束画面", field: "endImage", area: "end" },
    ];

    const setFrameImage = (field: FrameImageField, value?: string) => {
      if (field === "startImage") {
        onStateChange({ ...state, startImage: value });
        return;
      }
      onStateChange({ ...state, endImage: value });
    };

    const openFramePicker = (field: FrameImageField) => {
      const inputRef =
        field === "startImage" ? startFileInputRef : endFileInputRef;
      inputRef.current?.click();
    };

    const handleUploadFiles = async (
      field: FrameImageField,
      files: FileList | null,
    ) => {
      const imageFile = Array.from(files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );
      if (!imageFile) {
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(imageFile);
        setFrameImage(field, dataUrl);
      } catch (_error) {
        return;
      }
    };

    return (
      <SidebarWrapper>
        <Section>
          <ModelTrigger
            type="button"
            onClick={() => setModelPanelOpen(true)}
            title="选择视频模型"
          >
            <ModelTriggerText>
              {selectedModelOption?.label ?? "暂无可用视频模型"}
            </ModelTriggerText>
            <ChevronDown size={16} />
          </ModelTrigger>
        </Section>

        {modelPanelOpen ? (
          <ModelPanelMask
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setModelPanelOpen(false);
              }
            }}
          >
            <ModelPanel ref={modelPanelRef}>
              <ModelPanelTitle>AI models</ModelPanelTitle>
              <ModelPanelDivider />
              <ModelPanelList>
                {modelOptions.length === 0 ? (
                  <ModelPanelItem
                    type="button"
                    $active={false}
                    onClick={() => setModelPanelOpen(false)}
                  >
                    <ModelPanelBody>
                      <ModelPanelName>暂无可用视频模型</ModelPanelName>
                      <ModelPanelDesc>请先配置支持视频的 Provider</ModelPanelDesc>
                    </ModelPanelBody>
                    <ModelPanelSelected $active={false}>
                      <X size={14} />
                    </ModelPanelSelected>
                  </ModelPanelItem>
                ) : (
                  modelOptions.map((option) => (
                    <ModelPanelItem
                      key={option.key}
                      type="button"
                      $active={option.key === selectedModelKey}
                      onClick={() => {
                        onStateChange({
                          ...state,
                          providerId: option.providerId,
                          model: option.model,
                        });
                        setModelPanelOpen(false);
                      }}
                    >
                      <ModelPanelBody>
                        <ModelPanelName>{option.label}</ModelPanelName>
                        <ModelPanelCost>{option.cost}</ModelPanelCost>
                        <ModelPanelDesc>{option.description}</ModelPanelDesc>
                        <ModelPanelDesc>Provider: {option.providerName}</ModelPanelDesc>
                      </ModelPanelBody>
                      <ModelPanelSelected $active={option.key === selectedModelKey}>
                        {option.key === selectedModelKey ? (
                          <Check size={15} />
                        ) : null}
                      </ModelPanelSelected>
                    </ModelPanelItem>
                  ))
                )}
              </ModelPanelList>
            </ModelPanel>
          </ModelPanelMask>
        ) : null}

        {frameConfigs.map((frame) => {
          const previewImage =
            frame.field === "startImage" ? state.startImage : state.endImage;
          const inputRef =
            frame.field === "startImage" ? startFileInputRef : endFileInputRef;

          return (
            <Section key={frame.field}>
              <SectionTitle>{frame.title}</SectionTitle>
              <ImageUploadArea
                $dragging={draggingArea === frame.area}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDraggingArea(frame.area);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  const relatedTarget = event.relatedTarget as Node | null;
                  if (
                    relatedTarget &&
                    event.currentTarget.contains(relatedTarget)
                  ) {
                    return;
                  }
                  setDraggingArea((current) =>
                    current === frame.area ? null : current,
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDraggingArea(null);
                  void handleUploadFiles(frame.field, event.dataTransfer.files);
                }}
              >
                {previewImage ? (
                  <PreviewBox>
                    <img src={previewImage} alt={`${frame.title}预览`} />
                    <ReplacePreviewButton
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openFramePicker(frame.field);
                      }}
                    >
                      更换
                    </ReplacePreviewButton>
                    <RemovePreviewButton
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFrameImage(frame.field, undefined);
                      }}
                    >
                        <X size={14} />
                      </RemovePreviewButton>
                    <ReplaceHint>拖拽上传可替换图片</ReplaceHint>
                  </PreviewBox>
                ) : (
                  <UploadPrompt>
                    <ImagePlus size={18} />
                    <div>添加图片</div>
                    <div>拖拽上传参考图</div>
                    <UploadActionButton
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openFramePicker(frame.field);
                      }}
                    >
                      选择图片
                    </UploadActionButton>
                  </UploadPrompt>
                )}
              </ImageUploadArea>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  void handleUploadFiles(frame.field, event.target.files);
                  event.target.value = "";
                }}
              />
            </Section>
          );
        })}

        <Section>
          <SectionTitle>宽高比</SectionTitle>
          <RatioGrid>
            {RATIOS.map((ratio) => (
              <RatioItem
                key={ratio.value}
                $active={state.aspectRatio === ratio.value}
                onClick={() =>
                  onStateChange({ ...state, aspectRatio: ratio.value })
                }
              >
                <RatioShape
                  $active={state.aspectRatio === ratio.value}
                  style={{
                    aspectRatio:
                      ratio.value === "adaptive"
                        ? "1 / 1"
                        : ratio.value.replace(":", "/"),
                    borderStyle: ratio.value === "adaptive" ? "dashed" : "solid",
                  }}
                />
                {ratio.label}
              </RatioItem>
            ))}
          </RatioGrid>
        </Section>

        <Section>
          <SectionTitle>分辨率</SectionTitle>
          <ResolutionWrapper>
            <ResolutionGroup>
              {(["480p", "720p", "1080p"] as VideoResolution[]).map(
                (resolution) => (
                  <ResolutionButton
                    key={resolution}
                    $active={state.resolution === resolution}
                    onClick={() => onStateChange({ ...state, resolution })}
                  >
                    {resolution}
                  </ResolutionButton>
                ),
              )}
            </ResolutionGroup>
          </ResolutionWrapper>
        </Section>

        <Section>
          <SectionTitle>时长</SectionTitle>
          <DurationRow>
            <DurationSlider
              type="range"
              min={1}
              max={20}
              step={1}
              value={state.duration}
              onChange={(event) =>
                onStateChange({
                  ...state,
                  duration: Number.parseInt(event.target.value, 10),
                })
              }
            />
            <DurationValue
              type="number"
              min={1}
              max={20}
              value={state.duration}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(value)) {
                  return;
                }
                onStateChange({
                  ...state,
                  duration: Math.min(20, Math.max(1, value)),
                });
              }}
            />
          </DurationRow>
        </Section>

        <Section>
          <SectionTitle>种子</SectionTitle>
          <SeedRow>
            <SeedInput
              type="number"
              placeholder="随机"
              value={state.seed ?? ""}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  onStateChange({ ...state, seed: undefined });
                  return;
                }
                const value = Number.parseInt(raw, 10);
                if (!Number.isFinite(value)) {
                  return;
                }
                onStateChange({
                  ...state,
                  seed: Math.max(0, value),
                });
              }}
            />
            <SeedRandomButton
              type="button"
              title="随机种子"
              onClick={() =>
                onStateChange({
                  ...state,
                  seed: nextRandomSeed(),
                })
              }
            >
              <Dices size={16} />
            </SeedRandomButton>
          </SeedRow>
        </Section>

        <Section>
          <ToggleRow>
            <span>生成音频</span>
            <ToggleSwitch
              type="button"
              $checked={state.generateAudio}
              onClick={() =>
                onStateChange({ ...state, generateAudio: !state.generateAudio })
              }
            >
              <ToggleDot />
            </ToggleSwitch>
          </ToggleRow>
          <ToggleRow>
            <span>固定镜头</span>
            <ToggleSwitch
              type="button"
              $checked={state.cameraFixed}
              onClick={() =>
                onStateChange({ ...state, cameraFixed: !state.cameraFixed })
              }
            >
              <ToggleDot />
            </ToggleSwitch>
          </ToggleRow>
        </Section>

        <FooterBar>
          <FooterButton title="帮助">
            <CircleHelp size={14} />
          </FooterButton>
          <FooterButton title="面板">
            <Monitor size={14} />
          </FooterButton>
        </FooterBar>
      </SidebarWrapper>
    );
  },
);

VideoSidebar.displayName = "VideoSidebar";
