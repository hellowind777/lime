import React from "react";
import { User, Zap } from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Character } from "@/lib/api/memory";
import type { Skill } from "@/lib/api/skills";

interface CharacterMentionPanelProps {
  mentionQuery: string;
  filteredCharacters: Character[];
  installedSkills: Skill[];
  availableSkills: Skill[];
  commandRef: React.RefObject<HTMLDivElement>;
  onQueryChange: (query: string) => void;
  onSelectCharacter: (character: Character) => void;
  onSelectInstalledSkill: (skill: Skill) => void;
  onSelectAvailableSkill: (skill: Skill) => void;
  onNavigateToSettings?: () => void;
}

export const CharacterMentionPanel: React.FC<CharacterMentionPanelProps> = ({
  mentionQuery,
  filteredCharacters,
  installedSkills,
  availableSkills,
  commandRef,
  onQueryChange,
  onSelectCharacter,
  onSelectInstalledSkill,
  onSelectAvailableSkill,
  onNavigateToSettings,
}) => {
  const hasFilteredResults =
    filteredCharacters.length > 0 ||
    installedSkills.length > 0 ||
    availableSkills.length > 0;

  return (
    <Command ref={commandRef} className="bg-background">
      <CommandInput
        placeholder="搜索角色或技能..."
        value={mentionQuery}
        onValueChange={onQueryChange}
      />
      <CommandList>
        {!hasFilteredResults ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            <div>暂无可用角色或技能</div>
            {onNavigateToSettings ? (
              <button
                type="button"
                className="mt-2 text-primary hover:underline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onNavigateToSettings}
              >
                去技能设置
              </button>
            ) : null}
          </div>
        ) : null}
        {filteredCharacters.length > 0 ? (
          <CommandGroup heading="角色">
            {filteredCharacters.map((character) => (
              <CommandItem
                key={character.id}
                onSelect={() => onSelectCharacter(character)}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">{character.name}</div>
                  {character.description ? (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {character.description}
                    </div>
                  ) : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {installedSkills.length > 0 ? (
          <CommandGroup heading="已安装技能">
            {installedSkills.map((skill) => (
              <CommandItem
                key={skill.directory}
                onSelect={() => onSelectInstalledSkill(skill)}
                className="cursor-pointer"
              >
                <Zap className="mr-2 h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{skill.name}</div>
                  {skill.description ? (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {skill.description}
                    </div>
                  ) : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {availableSkills.length > 0 ? (
          <CommandGroup heading="未安装技能">
            {availableSkills.map((skill) => (
              <CommandItem
                key={skill.directory}
                onSelect={() => onSelectAvailableSkill(skill)}
                className="cursor-pointer opacity-60"
              >
                <Zap className="mr-2 h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">{skill.name}</div>
                  {skill.description ? (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {skill.description}
                    </div>
                  ) : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
};
