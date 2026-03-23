import { type ComponentProps, type ReactNode } from "react";
import { Inputbar } from "../components/Inputbar";
import { TeamWorkspaceDock } from "../components/TeamWorkspaceDock";

interface WorkspaceInputbarProps {
  inputbarProps: Omit<ComponentProps<typeof Inputbar>, "overlayAccessory">;
  accessory?: ReactNode;
  teamWorkspaceDockProps?: ComponentProps<typeof TeamWorkspaceDock> | null;
}

export function WorkspaceInputbar({
  inputbarProps,
  accessory,
  teamWorkspaceDockProps,
}: WorkspaceInputbarProps) {
  const overlayAccessory =
    accessory || teamWorkspaceDockProps ? (
      <>
        {accessory}
        {teamWorkspaceDockProps ? (
          <TeamWorkspaceDock {...teamWorkspaceDockProps} />
        ) : null}
      </>
    ) : undefined;

  return <Inputbar {...inputbarProps} overlayAccessory={overlayAccessory} />;
}
