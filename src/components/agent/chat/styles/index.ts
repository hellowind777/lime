import styled from "styled-components";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Navbar = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ $compact }) => ($compact ? "8px" : "12px")};
  padding: ${({ $compact }) =>
    $compact ? "7px 10px 7px" : "12px 16px 10px"};
  min-height: ${({ $compact }) => ($compact ? "50px" : "64px")};
  border-bottom: 1px solid rgba(226, 232, 240, 0.88);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.96) 0%,
      rgba(248, 250, 252, 0.94) 58%,
      rgba(241, 245, 249, 0.88) 100%
    );
  box-shadow:
    inset 0 -1px 0 rgba(255, 255, 255, 0.74),
    0 10px 28px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
`;

export const MessageListContainer = styled(ScrollArea)`
  flex: 1;
  padding: 6px 0 14px;
  background:
    linear-gradient(
      180deg,
      rgba(248, 250, 252, 0.66) 0%,
      rgba(248, 250, 252, 0.26) 22%,
      rgba(255, 255, 255, 0) 100%
    );
`;

// Linear Layout Wrapper: Always Row, Left Aligned
export const MessageWrapper = styled.div<{
  $isUser: boolean;
  $compactLeadingSpacing?: boolean;
}>`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: ${({ $compactLeadingSpacing }) =>
    $compactLeadingSpacing ? "14px 2px" : "14px 6px"};
  gap: ${({ $compactLeadingSpacing }) =>
    $compactLeadingSpacing ? "10px" : "12px"};
  width: 100%;
  max-width: none;
  margin: 0;

  &:hover .message-actions {
    opacity: 1;
  }
`;

export const AvatarColumn = styled.div`
  flex-shrink: 0;
  padding-top: 2px;
`;

export const ContentColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
`;

export const SenderName = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

// Placeholder for time if needed
export const TimeStamp = styled.span`
  font-size: 12px;
  color: var(--muted-foreground);
  font-weight: normal;
`;

export const AvatarCircle = styled.div<{ $isUser: boolean }>`
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(203, 213, 225, 0.82);
  background:
    linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.94) 0%,
      rgba(30, 41, 59, 0.98) 100%
    );
  color: white;
  font-size: 14px;
  overflow: hidden;
  box-shadow: 0 10px 24px -18px rgba(15, 23, 42, 0.5);
`;

// Removed Bubble Styling - Now Transparent Text Block
export const MessageBubble = styled.div<{ $isUser: boolean }>`
  width: 100%;
  color: var(--foreground);
  font-size: 15px;
  line-height: 1.7;
  position: relative;
  /* Markdown styling would go here */
`;

export const MessageActions = styled.div`
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  background-color: transparent;
  margin-top: 10px;
`;
