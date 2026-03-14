import type { Message } from "../types";
import { parseSkillSlashCommand } from "../hooks/skillCommand";

export function collectConversationSkillNames(messages: Message[]): string[] {
  const skillNames = new Set<string>();

  messages.forEach((message) => {
    if (message.role !== "user") {
      return;
    }

    const skillName = parseSkillSlashCommand(message.content)?.skillName;
    if (skillName) {
      skillNames.add(skillName);
    }
  });

  return [...skillNames].sort();
}
