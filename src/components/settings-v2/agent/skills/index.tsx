import { SkillsPage } from "@/components/skills/SkillsPage";

export function ExtensionsSettings() {
  return (
    <div className="space-y-5">
      <div className="max-w-3xl">
        <p className="text-sm leading-6 text-muted-foreground">
          Claw 左侧导航已经提供面向最终用户的技能主入口；这里仅保留本地导入、仓库管理与标准检查等高级能力。
          <a
            href="https://github.com/aiclientproxy/lime/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-primary hover:underline"
          >
            问题反馈
          </a>
        </p>
      </div>

      <div>
        <SkillsPage hideHeader />
      </div>
    </div>
  );
}
