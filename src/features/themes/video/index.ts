import type { ThemeModule } from "@/features/themes/types";
import { VideoThemeWorkspace } from "@/features/themes/video/VideoThemeWorkspace";
import {
  DefaultMaterialPanel,
  DefaultSettingsPanel,
} from "@/features/themes/shared/panelRenderers";
import { VideoTasksPanel } from "@/features/themes/video/panelRenderers";

export const videoThemeModule: ThemeModule = {
  theme: "video",
  capabilities: {
    workspaceKind: "video-canvas",
    showWorkspaceRightRailInWorkspace: false,
  },
  navigation: {
    defaultView: "create",
    items: [
      { key: "create", label: "创作" },
      { key: "material", label: "素材" },
      { key: "publish", label: "任务" },
      { key: "settings", label: "设置" },
    ],
  },
  primaryWorkspaceRenderer: VideoThemeWorkspace,
  workspaceRenderer: VideoThemeWorkspace,
  panelRenderers: {
    material: DefaultMaterialPanel,
    publish: VideoTasksPanel,
    settings: DefaultSettingsPanel,
  },
};
