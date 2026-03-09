import styled from "styled-components";
import { A2UIRenderer } from "@/components/content-creator/a2ui";
import type {
  A2UIFormData,
  A2UIResponse,
} from "@/components/content-creator/a2ui/types";

interface A2UIFloatingFormProps {
  response: A2UIResponse;
  onSubmit: (formData: A2UIFormData) => void;
}

const Card = styled.div`
  position: relative;
  margin-bottom: 10px;
  padding: 12px;
  background: hsl(var(--background) / 0.97);
  border: 1px solid hsl(var(--border) / 0.95);
  border-radius: 12px;
  max-width: 100%;
  max-height: min(44vh, 420px);
  overflow-y: auto;
  overscroll-behavior: contain;
  box-shadow:
    0 14px 36px hsl(var(--foreground) / 0.10),
    0 0 0 1px hsl(var(--background) / 0.72);
  backdrop-filter: blur(14px);
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border)) transparent;

  &::after {
    content: "";
    position: sticky;
    display: block;
    left: 0;
    right: 0;
    bottom: -12px;
    height: 16px;
    margin: 0 -12px -12px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      hsl(var(--background) / 0) 0%,
      hsl(var(--background) / 0.9) 100%
    );
  }

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: hsl(var(--border));
    border-radius: 999px;
  }

  .a2ui-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    line-height: 1.4;
  }

  .a2ui-container > * + * {
    margin-top: 0;
  }

  .a2ui-container .text-sm,
  .a2ui-container label,
  .a2ui-container [class*="text-sm"] {
    font-size: 13px;
    line-height: 1.35;
  }

  .a2ui-container .text-xs,
  .a2ui-container p,
  .a2ui-container [class*="text-xs"] {
    font-size: 12px;
    line-height: 1.3;
  }

  .a2ui-container input,
  .a2ui-container textarea {
    padding: 7px 9px;
    font-size: 12px;
    line-height: 1.35;
    border-color: hsl(var(--border) / 0.95);
    background: hsl(var(--background));
  }

  .a2ui-container textarea {
    min-height: 72px;
  }

  .a2ui-container button {
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.3;
    box-shadow: 0 1px 0 hsl(var(--background) / 0.35);
  }
`;

export function A2UIFloatingForm({
  response,
  onSubmit,
}: A2UIFloatingFormProps) {
  return (
    <Card>
      <A2UIRenderer response={response} onSubmit={onSubmit} />
    </Card>
  );
}
