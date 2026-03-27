import React from "react";
import { TimelineInlineItem } from "./TimelineInlineItem";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";

interface TimelineFlowDemoProps {
  items: AgentThreadItem[];
}

/**
 * 时间线流式展示演示组件
 *
 * 这是一个简化的演示，展示新的时间线 + 内联操作设计
 */
export function TimelineFlowDemo({ items }: TimelineFlowDemoProps) {
  // 过滤出需要在时间线上显示的项目
  const timelineItems = items.filter(
    (item) =>
      item.type === "tool_call" ||
      item.type === "command_execution" ||
      item.type === "web_search"
  );

  // 分组：将 Agent 消息和工具调用交错显示
  const groupedItems: Array<{ type: "text" | "timeline"; content: any }> = [];

  items.forEach((item, index) => {
    if (item.type === "agent_message") {
      groupedItems.push({
        type: "text",
        content: item,
      });
    } else if (
      item.type === "tool_call" ||
      item.type === "command_execution" ||
      item.type === "web_search"
    ) {
      // 检查是否已经有一个 timeline 组
      const lastGroup = groupedItems[groupedItems.length - 1];
      if (lastGroup && lastGroup.type === "timeline") {
        lastGroup.content.push(item);
      } else {
        groupedItems.push({
          type: "timeline",
          content: [item],
        });
      }
    }
  });

  return (
    <div className="space-y-4">
      {groupedItems.map((group, groupIndex) => {
        if (group.type === "text") {
          // Agent 文本消息
          const item = group.content;
          return (
            <div key={`text-${groupIndex}`} className="text-sm text-slate-700">
              {item.text}
            </div>
          );
        } else {
          // 时间线组
          const timelineItems = group.content as AgentThreadItem[];
          return (
            <div key={`timeline-${groupIndex}`} className="space-y-0">
              {timelineItems.map((item, itemIndex) => (
                <TimelineInlineItem
                  key={item.id}
                  item={item}
                  isLast={itemIndex === timelineItems.length - 1}
                />
              ))}
            </div>
          );
        }
      })}
    </div>
  );
}
