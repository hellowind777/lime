import { A2UIRenderer } from "@/components/content-creator/a2ui/components";
import type {
  A2UIEvent,
  A2UIFormData,
  A2UIResponse,
} from "@/components/content-creator/a2ui/types";

export interface A2uiSurfaceProps {
  surface: A2UIResponse;
  className?: string;
  onEvent?: (event: A2UIEvent) => void;
  onSubmit?: (formData: A2UIFormData) => void;
}

export function A2uiSurface({
  surface,
  className,
  onEvent,
  onSubmit,
}: A2uiSurfaceProps) {
  return (
    <A2UIRenderer
      response={surface}
      className={className}
      onEvent={onEvent}
      onSubmit={onSubmit}
    />
  );
}

export default A2uiSurface;
