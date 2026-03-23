#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const DEFAULT_SINCE_DAYS = 180;
const DEFAULT_MODULE_DEPTH = 2;
const DEFAULT_TOP_MODULES = 18;
const DEFAULT_OUTPUT_DIR_NAME = "lime-project-heatmap";

const TEXT_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".conf",
  ".css",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const INCLUDED_FILE_NAMES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "Dockerfile",
  "LICENSE",
  "Makefile",
  "README.md",
]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "target-codex-verify",
  "tmp",
  "vendor",
  "modified_files",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "Cargo.lock",
]);

const COLOR_STOPS = [
  { at: 0, color: "#ecfdf5" },
  { at: 0.2, color: "#c7f9cc" },
  { at: 0.45, color: "#6ee7b7" },
  { at: 0.7, color: "#fbbf24" },
  { at: 1, color: "#f97316" },
];

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const gitCommand = process.platform === "win32" ? "git.exe" : "git";
const requestedRoot = path.resolve(options.root || process.cwd());
const repoRoot = resolveRepoRoot(requestedRoot);
const outputDir = path.resolve(
  options.output ||
    path.join(
      os.tmpdir(),
      `${path.basename(repoRoot) || DEFAULT_OUTPUT_DIR_NAME}-project-heatmap`,
    ),
);

const scanResult = scanProjectFiles(repoRoot, options.moduleDepth);
const gitChurn = collectGitChurn({
  gitCommand,
  repoRoot,
  sinceDays: options.days,
  trackedFiles: scanResult.fileIndex,
});
const report = buildReport({
  repoRoot,
  scanResult,
  gitChurn,
  sinceDays: options.days,
  moduleDepth: options.moduleDepth,
  topModules: options.top,
});

fs.mkdirSync(outputDir, { recursive: true });

const jsonOutputPath = path.join(outputDir, "project-heatmap.json");
const htmlOutputPath = path.join(outputDir, "index.html");

fs.writeFileSync(jsonOutputPath, JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(htmlOutputPath, renderHtml(report), "utf8");

console.log(`[heatmap] 报告已生成`);
console.log(`[heatmap] HTML: ${htmlOutputPath}`);
console.log(`[heatmap] JSON: ${jsonOutputPath}`);
console.log(`[heatmap] 打开方式: file://${htmlOutputPath}`);

function parseArgs(argv) {
  const result = {
    root: "",
    output: "",
    days: DEFAULT_SINCE_DAYS,
    moduleDepth: DEFAULT_MODULE_DEPTH,
    top: DEFAULT_TOP_MODULES,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--root" && argv[index + 1]) {
      result.root = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      result.output = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }

    if (arg === "--days" && argv[index + 1]) {
      result.days = normalizePositiveNumber(argv[index + 1], DEFAULT_SINCE_DAYS);
      index += 1;
      continue;
    }

    if (arg === "--depth" && argv[index + 1]) {
      result.moduleDepth = normalizePositiveNumber(
        argv[index + 1],
        DEFAULT_MODULE_DEPTH,
      );
      index += 1;
      continue;
    }

    if (arg === "--top" && argv[index + 1]) {
      result.top = normalizePositiveNumber(argv[index + 1], DEFAULT_TOP_MODULES);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function normalizePositiveNumber(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function printHelp() {
  console.log(`
Lime 项目热力图生成器

用法:
  npm run heatmap:project
  npm run heatmap:project -- --days 90
  npm run heatmap:project -- --root "../other-repo" --output "./tmp/heatmap"

选项:
  --root PATH    指定要分析的仓库路径，默认当前 Git 根目录
  --output PATH  指定报告输出目录，默认系统临时目录
  --days N       分析最近 N 天的 Git churn，默认 ${DEFAULT_SINCE_DAYS}
  --depth N      模块聚合目录深度，默认 ${DEFAULT_MODULE_DEPTH}
  --top N        矩阵热力图显示前 N 个热点模块，默认 ${DEFAULT_TOP_MODULES}
  -h, --help     显示帮助

说明:
  - 默认忽略 node_modules、dist、target 等目录
  - 默认忽略 package-lock.json、pnpm-lock.yaml、Cargo.lock 等锁文件
  - HTML 报告为纯本地静态文件，可直接使用浏览器打开
`);
}

function resolveRepoRoot(targetPath) {
  try {
    const output = execFileSync(gitCommand, ["-C", targetPath, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (output) {
      return path.resolve(output);
    }
  } catch {
    return targetPath;
  }

  return targetPath;
}

function scanProjectFiles(repoPath, moduleDepth) {
  const modules = new Map();
  const files = [];
  const fileIndex = new Map();

  walkDirectory(repoPath);

  const moduleList = Array.from(modules.values()).sort((left, right) => {
    if (right.loc !== left.loc) {
      return right.loc - left.loc;
    }
    return left.path.localeCompare(right.path);
  });

  return {
    files,
    fileIndex,
    modules: moduleList,
    summary: {
      fileCount: files.length,
      loc: files.reduce((total, file) => total + file.loc, 0),
    },
  };

  function walkDirectory(currentDir) {
    const dirEntries = fs
      .readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of dirEntries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(repoPath, absolutePath));

      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name, relativePath)) {
          continue;
        }

        walkDirectory(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!shouldIncludeFile(entry.name, relativePath)) {
        continue;
      }

      const loc = countLinesSafely(absolutePath);
      const modulePath = resolveModulePath(relativePath, moduleDepth);
      const group = resolveGroup(modulePath);

      const fileRecord = {
        path: relativePath,
        modulePath,
        group,
        loc,
      };

      files.push(fileRecord);
      fileIndex.set(relativePath, fileRecord);

      let moduleRecord = modules.get(modulePath);
      if (!moduleRecord) {
        moduleRecord = {
          id: modulePath,
          path: modulePath,
          group,
          loc: 0,
          fileCount: 0,
        };
        modules.set(modulePath, moduleRecord);
      }

      moduleRecord.loc += loc;
      moduleRecord.fileCount += 1;
    }
  }
}

function shouldIgnoreDirectory(entryName, relativePath) {
  if (IGNORED_DIRECTORIES.has(entryName)) {
    return true;
  }

  const segments = relativePath.split("/").filter(Boolean);
  return segments.some((segment) => IGNORED_DIRECTORIES.has(segment));
}

function shouldIncludeFile(fileName, relativePath) {
  if (IGNORED_FILES.has(fileName)) {
    return false;
  }

  if (relativePath.startsWith("docs/node_modules/")) {
    return false;
  }

  const extension = path.extname(fileName).toLowerCase();

  if (TEXT_FILE_EXTENSIONS.has(extension)) {
    return true;
  }

  return INCLUDED_FILE_NAMES.has(fileName);
}

function countLinesSafely(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content) {
      return 0;
    }
    return content.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

function resolveModulePath(relativePath, moduleDepth) {
  const parts = relativePath.split("/").filter(Boolean);

  if (parts.length <= 1) {
    return "(root)";
  }

  const safeDepth = Math.max(1, moduleDepth);
  const moduleParts = parts.slice(0, Math.min(safeDepth, parts.length - 1));
  return moduleParts.join("/");
}

function resolveGroup(modulePath) {
  if (modulePath === "(root)") {
    return "root";
  }

  const [firstSegment = "root"] = modulePath.split("/");
  return firstSegment;
}

function collectGitChurn({ gitCommand, repoRoot, sinceDays, trackedFiles }) {
  const fileChurn = new Map();
  const weekSet = new Set();
  let gitAvailable = true;
  let commitCount = 0;

  let output = "";

  try {
    output = execFileSync(
      gitCommand,
      [
        "-C",
        repoRoot,
        "log",
        `--since=${sinceDays}.days`,
        "--numstat",
        "--date=short",
        "--format=format:@@@%cs",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    gitAvailable = false;
  }

  if (!gitAvailable || !output) {
    return {
      gitAvailable,
      commitCount,
      fileChurn,
      weeks: [],
    };
  }

  let currentDate = "";

  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    if (line.startsWith("@@@")) {
      currentDate = line.slice(3).trim();
      commitCount += 1;
      continue;
    }

    const parts = line.split("\t");
    if (parts.length !== 3) {
      continue;
    }

    const [added, deleted, rawPath] = parts;
    if (added === "-" || deleted === "-" || !currentDate) {
      continue;
    }

    const normalizedPath = normalizeGitPath(rawPath);
    const trackedFile = trackedFiles.get(normalizedPath);
    if (!trackedFile) {
      continue;
    }

    const churn = Number.parseInt(added, 10) + Number.parseInt(deleted, 10);
    if (!Number.isFinite(churn) || churn <= 0) {
      continue;
    }

    const weekKey = toWeekKey(currentDate);
    weekSet.add(weekKey);

    let fileRecord = fileChurn.get(normalizedPath);
    if (!fileRecord) {
      fileRecord = {
        path: normalizedPath,
        churn: 0,
        weekly: {},
      };
      fileChurn.set(normalizedPath, fileRecord);
    }

    fileRecord.churn += churn;
    fileRecord.weekly[weekKey] = (fileRecord.weekly[weekKey] || 0) + churn;
  }

  return {
    gitAvailable,
    commitCount,
    fileChurn,
    weeks: Array.from(weekSet).sort(),
  };
}

function normalizeGitPath(rawPath) {
  let normalized = rawPath.trim().replaceAll("\\", "/");

  if (!normalized.includes("=>")) {
    return normalized;
  }

  normalized = normalized.replace(
    /\{([^{}]+)\s=>\s([^{}]+)\}/g,
    (_, _before, after) => after,
  );

  if (normalized.includes("=>")) {
    const segments = normalized.split("=>");
    normalized = segments[segments.length - 1].trim();
  }

  return normalized.replaceAll("//", "/");
}

function toWeekKey(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function buildReport({
  repoRoot,
  scanResult,
  gitChurn,
  sinceDays,
  moduleDepth,
  topModules,
}) {
  const modulesById = new Map();

  for (const moduleRecord of scanResult.modules) {
    modulesById.set(moduleRecord.path, {
      ...moduleRecord,
      churn: 0,
      churnDensity: 0,
      weekly: {},
      files: [],
    });
  }

  const enrichedFiles = scanResult.files.map((file) => {
    const churnRecord = gitChurn.fileChurn.get(file.path);
    const churn = churnRecord?.churn || 0;
    const churnDensity = file.loc > 0 ? roundTo(churn / file.loc, 4) : 0;
    const weekly = churnRecord?.weekly || {};

    const enriched = {
      ...file,
      churn,
      churnDensity,
      weekly,
    };

    const moduleRecord = modulesById.get(file.modulePath);
    if (moduleRecord) {
      moduleRecord.churn += churn;
      moduleRecord.files.push({
        path: file.path,
        loc: file.loc,
        churn,
        churnDensity,
      });

      for (const [week, value] of Object.entries(weekly)) {
        moduleRecord.weekly[week] = (moduleRecord.weekly[week] || 0) + value;
      }
    }

    return enriched;
  });

  const modules = Array.from(modulesById.values())
    .map((moduleRecord) => ({
      ...moduleRecord,
      activeWeekCount: Object.keys(moduleRecord.weekly).length,
      churnDensity:
        moduleRecord.loc > 0
          ? roundTo(moduleRecord.churn / moduleRecord.loc, 4)
          : 0,
      files: moduleRecord.files
        .sort((left, right) => {
          if (right.churn !== left.churn) {
            return right.churn - left.churn;
          }
          return right.loc - left.loc;
        })
        .slice(0, 6),
    }))
    .sort((left, right) => {
      if (right.churn !== left.churn) {
        return right.churn - left.churn;
      }
      if (right.loc !== left.loc) {
        return right.loc - left.loc;
      }
      return left.path.localeCompare(right.path);
    });

  const hotFiles = enrichedFiles
    .filter((file) => file.churn > 0 || file.loc > 0)
    .sort((left, right) => {
      if (right.churn !== left.churn) {
        return right.churn - left.churn;
      }
      if (right.loc !== left.loc) {
        return right.loc - left.loc;
      }
      return left.path.localeCompare(right.path);
    })
    .slice(0, 24);

  const lastTouchedByPath = resolveLastTouchedDates(
    repoRoot,
    hotFiles.map((file) => file.path),
  );

  const hotFilesWithDates = hotFiles.map((file) => ({
    ...file,
    lastTouchedAt: lastTouchedByPath.get(file.path) || "",
  }));

  const groups = buildGroups(modules);
  const weeks = gitChurn.weeks;
  const governance = buildGovernanceCandidates(
    modules,
    Math.max(8, Math.min(12, topModules)),
  );

  return {
    meta: {
      repoName: path.basename(repoRoot),
      repoRoot: toPosixPath(repoRoot),
      generatedAt: new Date().toISOString(),
      sinceDays,
      moduleDepth,
      topModules,
      gitAvailable: gitChurn.gitAvailable,
      commitCount: gitChurn.commitCount,
      ignoredDirectories: Array.from(IGNORED_DIRECTORIES).sort(),
      ignoredFiles: Array.from(IGNORED_FILES).sort(),
      notes: [
        "面积代表 LOC，颜色代表最近窗口内的 churn 强度。",
        "默认只统计当前仍存在的文件；历史已删除文件不会进入报告。",
        "重命名文件的早期历史可能无法完全归并到当前路径，这是当前 MVP 的已知取舍。",
      ],
    },
    summary: {
      totalFiles: scanResult.summary.fileCount,
      totalLoc: scanResult.summary.loc,
      totalModules: modules.length,
      totalChurn: modules.reduce((total, moduleRecord) => total + moduleRecord.churn, 0),
      activeWeeks: weeks.length,
    },
    weeks,
    groups,
    modules,
    hotFiles: hotFilesWithDates,
    governance,
  };
}

function buildGovernanceCandidates(modules, topN) {
  if (modules.length === 0) {
    return {
      thresholds: {
        locHigh: 0,
        churnHigh: 0,
        densityHigh: 0,
        filesHigh: 0,
        activeWeeksHigh: 0,
      },
      candidates: [],
    };
  }

  const locValues = modules.map((moduleRecord) => moduleRecord.loc);
  const churnValues = modules.map((moduleRecord) => moduleRecord.churn);
  const densityValues = modules.map((moduleRecord) => moduleRecord.churnDensity);
  const fileCountValues = modules.map((moduleRecord) => moduleRecord.fileCount);
  const activeWeekValues = modules.map(
    (moduleRecord) => moduleRecord.activeWeekCount,
  );

  const thresholds = {
    locHigh: percentileValue(locValues, 0.85),
    churnHigh: percentileValue(churnValues, 0.85),
    densityHigh: percentileValue(densityValues, 0.8),
    filesHigh: percentileValue(fileCountValues, 0.85),
    activeWeeksHigh: percentileValue(activeWeekValues, 0.8),
  };

  const maxLoc = Math.max(...locValues, 1);
  const maxChurn = Math.max(...churnValues, 1);
  const maxDensity = Math.max(...densityValues, 0.0001);
  const maxFiles = Math.max(...fileCountValues, 1);
  const maxActiveWeeks = Math.max(...activeWeekValues, 1);

  const candidates = modules
    .map((moduleRecord) => {
      const sizeScore = Math.log1p(moduleRecord.loc) / Math.log1p(maxLoc);
      const churnScore =
        Math.log1p(moduleRecord.churn) / Math.log1p(Math.max(1, maxChurn));
      const densityScore = moduleRecord.churnDensity / maxDensity;
      const scatterScore =
        Math.log1p(moduleRecord.fileCount) / Math.log1p(maxFiles);
      const persistenceScore =
        Math.log1p(moduleRecord.activeWeekCount) / Math.log1p(maxActiveWeeks);
      const governanceScore = roundTo(
        (sizeScore * 0.32 +
          churnScore * 0.28 +
          densityScore * 0.18 +
          scatterScore * 0.12 +
          persistenceScore * 0.1) *
          100,
        1,
      );

      const reasons = buildGovernanceReasons(moduleRecord, thresholds);

      return {
        path: moduleRecord.path,
        group: moduleRecord.group,
        loc: moduleRecord.loc,
        churn: moduleRecord.churn,
        churnDensity: moduleRecord.churnDensity,
        fileCount: moduleRecord.fileCount,
        activeWeekCount: moduleRecord.activeWeekCount,
        governanceScore,
        severity: resolveGovernanceSeverity(governanceScore, reasons),
        reasons,
        suggestion: buildGovernanceSuggestion(reasons),
      };
    })
    .sort((left, right) => {
      if (right.governanceScore !== left.governanceScore) {
        return right.governanceScore - left.governanceScore;
      }
      if (right.churn !== left.churn) {
        return right.churn - left.churn;
      }
      return right.loc - left.loc;
    })
    .slice(0, topN);

  return {
    thresholds: {
      ...thresholds,
      densityHigh: roundTo(thresholds.densityHigh, 4),
    },
    candidates,
  };
}

function percentileValue(values, percentile) {
  if (!values || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * percentile)),
  );
  return sorted[index];
}

function buildGovernanceReasons(moduleRecord, thresholds) {
  const reasons = [];

  if (moduleRecord.loc >= thresholds.locHigh) {
    reasons.push("体量大");
  }

  if (moduleRecord.churn >= thresholds.churnHigh && moduleRecord.churn > 0) {
    reasons.push("近期变更频繁");
  }

  if (
    moduleRecord.churnDensity >= thresholds.densityHigh &&
    moduleRecord.churn > 0
  ) {
    reasons.push("单位体量改动密");
  }

  if (moduleRecord.fileCount >= thresholds.filesHigh) {
    reasons.push("文件分散");
  }

  if (
    moduleRecord.activeWeekCount >= thresholds.activeWeeksHigh &&
    moduleRecord.activeWeekCount > 1
  ) {
    reasons.push("持续发热");
  }

  if (reasons.length === 0) {
    reasons.push("需要观察");
  }

  return reasons;
}

function resolveGovernanceSeverity(governanceScore, reasons) {
  const hasScaleSignal =
    reasons.includes("体量大") || reasons.includes("文件分散");
  const hasHeatSignal =
    reasons.includes("近期变更频繁") || reasons.includes("单位体量改动密");

  if (governanceScore >= 80 && hasScaleSignal && hasHeatSignal) {
    return "立即治理";
  }

  if (governanceScore >= 60 && reasons.length >= 2) {
    return "尽快治理";
  }

  return "持续观察";
}

function buildGovernanceSuggestion(reasons) {
  if (reasons.includes("体量大") && reasons.includes("文件分散")) {
    return "先定义唯一事实源，再收敛入口与目录边界。";
  }

  if (reasons.includes("单位体量改动密") && reasons.includes("持续发热")) {
    return "先冻结抽象，再补守卫，避免继续长出平级实现。";
  }

  if (reasons.includes("近期变更频繁")) {
    return "优先盘点入口层与服务层，找出重复分支后做减法。";
  }

  return "先保持观测，等下一轮需求前确认是否要收口。";
}

function buildGroups(modules) {
  const groupMap = new Map();

  for (const moduleRecord of modules) {
    let group = groupMap.get(moduleRecord.group);
    if (!group) {
      group = {
        id: moduleRecord.group,
        label: moduleRecord.group === "root" ? "根目录" : moduleRecord.group,
        loc: 0,
        churn: 0,
        moduleCount: 0,
        fileCount: 0,
      };
      groupMap.set(moduleRecord.group, group);
    }

    group.loc += moduleRecord.loc;
    group.churn += moduleRecord.churn;
    group.moduleCount += 1;
    group.fileCount += moduleRecord.fileCount;
  }

  const result = [
    {
      id: "all",
      label: "全部",
      loc: modules.reduce((total, moduleRecord) => total + moduleRecord.loc, 0),
      churn: modules.reduce(
        (total, moduleRecord) => total + moduleRecord.churn,
        0,
      ),
      moduleCount: modules.length,
      fileCount: modules.reduce(
        (total, moduleRecord) => total + moduleRecord.fileCount,
        0,
      ),
    },
    ...Array.from(groupMap.values()).sort((left, right) => {
      if (right.churn !== left.churn) {
        return right.churn - left.churn;
      }
      return right.loc - left.loc;
    }),
  ];

  return result;
}

function resolveLastTouchedDates(repoRoot, filePaths) {
  const result = new Map();

  if (filePaths.length === 0) {
    return result;
  }

  for (const filePath of filePaths) {
    try {
      const value = execFileSync(
        gitCommand,
        ["-C", repoRoot, "log", "-1", "--date=short", "--format=%cs", "--", filePath],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ).trim();

      if (value) {
        result.set(filePath, value);
      }
    } catch {
      result.set(filePath, "");
    }
  }

  return result;
}

function renderHtml(report) {
  const embeddedData = JSON.stringify(report).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.meta.repoName)} 项目热力图</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f8f7;
        --panel: #ffffff;
        --panel-muted: #f8fbfa;
        --border: #dbe4e2;
        --text: #0f172a;
        --muted: #5f6b6a;
        --accent: #0f3d3e;
        --success: #0f766e;
        --shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          sans-serif;
        background:
          radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 36%),
          radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent 30%),
          var(--bg);
        color: var(--text);
      }

      .page {
        max-width: 1440px;
        margin: 0 auto;
        padding: 28px 24px 40px;
      }

      .hero {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 24px 28px;
        box-shadow: var(--shadow);
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
        gap: 20px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #ecfdf5;
        color: var(--success);
        font-size: 13px;
        font-weight: 600;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      .hero h1 {
        font-size: 32px;
        line-height: 1.15;
        margin-top: 14px;
      }

      .hero p {
        margin-top: 12px;
        color: var(--muted);
        line-height: 1.7;
      }

      .meta-list,
      .note-list,
      .legend-list {
        display: grid;
        gap: 10px;
      }

      .meta-item,
      .note-item {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: var(--panel-muted);
      }

      .meta-item strong,
      .note-item strong {
        display: block;
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .meta-item span,
      .note-item span {
        font-size: 15px;
        line-height: 1.5;
      }

      .section {
        margin-top: 22px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: var(--shadow);
        padding: 22px 24px 24px;
      }

      .section-header {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 18px;
      }

      .section-header p {
        color: var(--muted);
        line-height: 1.6;
        max-width: 780px;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .stat-card {
        padding: 18px 18px 16px;
        border-radius: 20px;
        background: linear-gradient(180deg, #ffffff, #f8fbfa);
        border: 1px solid var(--border);
      }

      .stat-card strong {
        display: block;
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 10px;
      }

      .stat-card span {
        display: block;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      .filter-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .filter-button {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: #fff;
        color: var(--muted);
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color 160ms ease,
          color 160ms ease,
          border-color 160ms ease;
      }

      .filter-button.active {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }

      .toolbar-note {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--muted);
        font-size: 13px;
      }

      .legend-bar {
        width: 180px;
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #ecfdf5 0%, #6ee7b7 45%, #fbbf24 75%, #f97316 100%);
        border: 1px solid rgba(15, 23, 42, 0.06);
      }

      .chart-shell {
        border: 1px solid var(--border);
        background: var(--panel-muted);
        border-radius: 22px;
        padding: 18px;
      }

      .chart-shell svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .governance-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .governance-card {
        border: 1px solid var(--border);
        background: linear-gradient(180deg, #ffffff, #f8fbfa);
        border-radius: 20px;
        padding: 16px;
      }

      .governance-card header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .governance-card h3 {
        font-size: 15px;
        line-height: 1.4;
      }

      .score-badge {
        min-width: 58px;
        padding: 7px 10px;
        border-radius: 999px;
        background: #ecfdf5;
        color: var(--success);
        text-align: center;
        font-size: 13px;
        font-weight: 700;
      }

      .severity-badge {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 12px;
        font-weight: 600;
      }

      .severity-badge.urgent {
        background: #fff7ed;
        color: #c2410c;
      }

      .severity-badge.warn {
        background: #fef3c7;
        color: #a16207;
      }

      .signal-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
      }

      .signal-pill {
        display: inline-flex;
        align-items: center;
        padding: 5px 9px;
        border-radius: 999px;
        background: var(--panel-muted);
        border: 1px solid var(--border);
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }

      .governance-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .governance-tip {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid var(--border);
        color: #334155;
        font-size: 12px;
        line-height: 1.6;
      }

      .split-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
        gap: 18px;
        align-items: start;
      }

      .list-card {
        border: 1px solid var(--border);
        background: #fff;
        border-radius: 20px;
        padding: 16px;
      }

      .list-card h3 {
        font-size: 16px;
        margin-bottom: 14px;
      }

      .ranking-list {
        display: grid;
        gap: 10px;
      }

      .ranking-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        padding: 12px 14px;
        border-radius: 16px;
        background: var(--panel-muted);
        border: 1px solid var(--border);
      }

      .ranking-item strong {
        display: block;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .ranking-item span {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .ranking-item em {
        font-style: normal;
        font-size: 13px;
        font-weight: 700;
        color: var(--accent);
      }

      .table-shell {
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 20px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
      }

      thead {
        background: #f8fbfa;
      }

      th,
      td {
        padding: 14px 16px;
        text-align: left;
        font-size: 13px;
        border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }

      th {
        color: var(--muted);
        font-weight: 600;
        white-space: nowrap;
      }

      td code {
        font-family:
          "SFMono-Regular",
          Consolas,
          "Liberation Mono",
          Menlo,
          monospace;
        font-size: 12px;
        color: var(--accent);
      }

      .empty {
        padding: 22px;
        color: var(--muted);
        text-align: center;
        border: 1px dashed var(--border);
        border-radius: 18px;
        background: var(--panel-muted);
      }

      .footer {
        margin-top: 16px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .tooltip {
        position: fixed;
        pointer-events: none;
        max-width: 320px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.94);
        color: #fff;
        font-size: 12px;
        line-height: 1.55;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.24);
        opacity: 0;
        transform: translateY(6px);
        transition:
          opacity 120ms ease,
          transform 120ms ease;
        z-index: 20;
      }

      .tooltip.visible {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1180px) {
        .hero,
        .split-layout {
          grid-template-columns: 1fr;
        }

        .stat-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .governance-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .page {
          padding: 18px 14px 28px;
        }

        .hero,
        .section {
          border-radius: 20px;
          padding: 18px;
        }

        .stat-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <div>
          <div class="eyebrow">项目观察热力图 · ${escapeHtml(report.meta.repoName)}</div>
          <h1>用规模、变更和时间热度观察仓库演化</h1>
          <p>
            这份报告聚合了当前仓库文件规模、最近 ${report.meta.sinceDays}
            天 Git churn，以及按周汇总的模块活跃度。
            面积优先回答“哪里大”，颜色优先回答“哪里热”，矩阵优先回答“什么时候热”。
          </p>
        </div>
        <div class="meta-list">
          <div class="meta-item">
            <strong>仓库路径</strong>
            <span>${escapeHtml(report.meta.repoRoot)}</span>
          </div>
          <div class="meta-item">
            <strong>生成时间</strong>
            <span>${escapeHtml(formatTimestamp(report.meta.generatedAt))}</span>
          </div>
          <div class="meta-item">
            <strong>统计窗口</strong>
            <span>最近 ${report.meta.sinceDays} 天 · 模块深度 ${report.meta.moduleDepth}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>摘要</h2>
            <p>先用总量判断项目体积，再用 churn 观察演化速度。</p>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card">
            <strong>纳入统计文件</strong>
            <span>${formatNumber(report.summary.totalFiles)}</span>
          </div>
          <div class="stat-card">
            <strong>总代码/文档行数</strong>
            <span>${formatNumber(report.summary.totalLoc)}</span>
          </div>
          <div class="stat-card">
            <strong>聚合模块数</strong>
            <span>${formatNumber(report.summary.totalModules)}</span>
          </div>
          <div class="stat-card">
            <strong>${report.meta.sinceDays} 天 churn</strong>
            <span>${formatNumber(report.summary.totalChurn)}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>治理候选</h2>
            <p>
              这里不是单纯看“谁最热”，而是综合了体量、近期 churn、单位体量热度、文件分散度和持续活跃度。
              分数越高，越适合优先做“收口、减法、封老路”。
            </p>
          </div>
        </div>
        <div class="governance-grid">
          ${report.governance.candidates
            .map((candidate) => {
              const severityClass =
                candidate.severity === "立即治理"
                  ? "urgent"
                  : candidate.severity === "尽快治理"
                    ? "warn"
                    : "";
              return `<article class="governance-card">
                <header>
                  <div>
                    <h3>${escapeHtml(candidate.path)}</h3>
                    <div class="severity-badge ${severityClass}">${escapeHtml(candidate.severity)}</div>
                  </div>
                  <div class="score-badge">${candidate.governanceScore}</div>
                </header>
                <div class="signal-list">
                  ${candidate.reasons
                    .map(
                      (reason) =>
                        `<span class="signal-pill">${escapeHtml(reason)}</span>`,
                    )
                    .join("")}
                </div>
                <div class="governance-metrics">
                  <div>LOC：${formatNumber(candidate.loc)}</div>
                  <div>文件：${formatNumber(candidate.fileCount)}</div>
                  <div>churn：${formatNumber(candidate.churn)}</div>
                  <div>活跃周：${formatNumber(candidate.activeWeekCount)}</div>
                </div>
                <div class="governance-tip">${escapeHtml(candidate.suggestion)}</div>
              </article>`;
            })
            .join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>模块体量 + 热度</h2>
            <p>
              Treemap 使用模块级聚合结果：矩形面积代表 LOC，颜色深浅代表 churn/LOC。
              这样既能看出大模块，也能看出“单位体量上特别热”的区域。
            </p>
          </div>
        </div>

        <div class="toolbar">
          <div class="filter-group" id="group-filters"></div>
          <div class="toolbar-note">
            <span>颜色：低热 → 高热</span>
            <div class="legend-bar"></div>
          </div>
        </div>

        <div class="split-layout">
          <div class="chart-shell">
            <svg id="treemap-chart" viewBox="0 0 980 560" role="img" aria-label="模块 Treemap"></svg>
          </div>
          <aside class="list-card">
            <h3>当前筛选 Top 模块</h3>
            <div class="ranking-list" id="module-ranking"></div>
          </aside>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>时间 × 模块热力矩阵</h2>
            <p>
              横轴是按周聚合的时间窗口，纵轴是当前筛选下 churn 最高的模块。
              这张图最适合看“某一类模块是否持续发热”。
            </p>
          </div>
        </div>

        <div class="chart-shell">
          <svg id="matrix-chart" viewBox="0 0 1180 620" role="img" aria-label="模块周活跃矩阵"></svg>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>热点文件</h2>
            <p>
              这里列出 churn 最高的当前文件，帮助从模块热区继续向下钻取到具体实现。
            </p>
          </div>
        </div>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>文件</th>
                <th>模块</th>
                <th>LOC</th>
                <th>${report.meta.sinceDays} 天 churn</th>
                <th>热度密度</th>
                <th>最近触达</th>
              </tr>
            </thead>
            <tbody id="hot-files-body"></tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>说明</h2>
            <p>这份报告刻意保持 KISS：只做项目观察最有用的三类指标，不混入过多推断。</p>
          </div>
        </div>
        <div class="note-list">
          ${report.meta.notes
            .map(
              (note, index) => `<div class="note-item"><strong>说明 ${index + 1}</strong><span>${escapeHtml(note)}</span></div>`,
            )
            .join("")}
        </div>
        <div class="footer">
          ${report.meta.gitAvailable
            ? `Git 统计可用，共扫描到 ${formatNumber(report.meta.commitCount)} 个提交标记与 ${formatNumber(report.summary.activeWeeks)} 个活跃周。`
            : "当前环境未能读取 Git 历史，因此本报告仅展示文件规模，不展示 churn。"}
        </div>
      </section>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <script>
      const report = ${embeddedData};

      const groupFiltersElement = document.getElementById("group-filters");
      const moduleRankingElement = document.getElementById("module-ranking");
      const treemapElement = document.getElementById("treemap-chart");
      const matrixElement = document.getElementById("matrix-chart");
      const hotFilesBodyElement = document.getElementById("hot-files-body");
      const tooltipElement = document.getElementById("tooltip");

      const state = {
        activeGroup: "all",
      };

      renderFilters();
      renderAll();

      function renderFilters() {
        groupFiltersElement.innerHTML = "";

        for (const group of report.groups) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "filter-button";
          button.textContent = group.label;
          button.addEventListener("click", () => {
            state.activeGroup = group.id;
            renderAll();
          });
          groupFiltersElement.appendChild(button);
        }
      }

      function renderAll() {
        syncActiveFilterButton();
        const filteredModules = getFilteredModules();
        renderTreemap(filteredModules);
        renderModuleRanking(filteredModules);
        renderMatrix(filteredModules);
        renderHotFiles(filteredModules);
      }

      function syncActiveFilterButton() {
        const buttons = groupFiltersElement.querySelectorAll(".filter-button");
        buttons.forEach((button, index) => {
          const group = report.groups[index];
          button.classList.toggle("active", group.id === state.activeGroup);
        });
      }

      function getFilteredModules() {
        if (state.activeGroup === "all") {
          return [...report.modules];
        }
        return report.modules.filter((module) => module.group === state.activeGroup);
      }

      function renderTreemap(modules) {
        clearSvg(treemapElement);

        if (modules.length === 0) {
          renderSvgEmptyState(treemapElement, "当前筛选下没有模块数据");
          return;
        }

        const chartWidth = 980;
        const chartHeight = 560;
        const innerX = 12;
        const innerY = 12;
        const innerWidth = chartWidth - 24;
        const innerHeight = chartHeight - 24;

        const layoutItems = modules
          .map((item) => ({ ...item, value: Math.max(item.loc, 1) }))
          .sort((left, right) => right.value - left.value);

        const rectangles = layoutTreemap(layoutItems, innerX, innerY, innerWidth, innerHeight);
        const maxDensity = Math.max(...modules.map((item) => item.churnDensity), 0.0001);

        for (const rect of rectangles) {
          const color = colorFromScale(rect.churnDensity, 0, maxDensity);
          const group = createSvgElement("g");
          const block = createSvgElement("rect");
          block.setAttribute("x", String(rect.x));
          block.setAttribute("y", String(rect.y));
          block.setAttribute("width", String(Math.max(0, rect.width - 4)));
          block.setAttribute("height", String(Math.max(0, rect.height - 4)));
          block.setAttribute("rx", "14");
          block.setAttribute("fill", color);
          block.setAttribute("stroke", "#ffffff");
          block.setAttribute("stroke-width", "2");
          block.style.cursor = "default";

          const tooltipText = [
            rect.path,
            "LOC: " + formatNumber(rect.loc),
            "${report.meta.sinceDays} 天 churn: " + formatNumber(rect.churn),
            "热度密度: " + formatDensity(rect.churnDensity),
            "文件数: " + formatNumber(rect.fileCount),
          ].join("\\n");

          bindTooltip(group, tooltipText);
          group.appendChild(block);

          if (rect.width > 150 && rect.height > 78) {
            const title = createSvgElement("text");
            title.setAttribute("x", String(rect.x + 14));
            title.setAttribute("y", String(rect.y + 24));
            title.setAttribute("fill", "#0f172a");
            title.setAttribute("font-size", "16");
            title.setAttribute("font-weight", "700");
            title.textContent = rect.path;

            const subtitle = createSvgElement("text");
            subtitle.setAttribute("x", String(rect.x + 14));
            subtitle.setAttribute("y", String(rect.y + 48));
            subtitle.setAttribute("fill", "#334155");
            subtitle.setAttribute("font-size", "13");
            subtitle.textContent =
              "LOC " +
              formatNumber(rect.loc) +
              " · churn " +
              formatNumber(rect.churn);

            group.appendChild(title);
            group.appendChild(subtitle);
          } else if (rect.width > 90 && rect.height > 34) {
            const title = createSvgElement("text");
            title.setAttribute("x", String(rect.x + 12));
            title.setAttribute("y", String(rect.y + 22));
            title.setAttribute("fill", "#0f172a");
            title.setAttribute("font-size", "12");
            title.setAttribute("font-weight", "700");
            title.textContent = truncateLabel(rect.path, 18);
            group.appendChild(title);
          }

          treemapElement.appendChild(group);
        }
      }

      function renderModuleRanking(modules) {
        moduleRankingElement.innerHTML = "";

        const sorted = [...modules]
          .sort((left, right) => {
            if (right.governanceScore !== left.governanceScore) {
              return right.governanceScore - left.governanceScore;
            }
            if (right.churn !== left.churn) {
              return right.churn - left.churn;
            }
            return right.loc - left.loc;
          })
          .slice(0, 8);

        if (sorted.length === 0) {
          moduleRankingElement.innerHTML =
            '<div class="empty">当前筛选下没有可展示模块</div>';
          return;
        }

        for (const item of sorted) {
          const row = document.createElement("div");
          row.className = "ranking-item";
          row.innerHTML = \`
            <div>
              <strong>\${escapeHtmlHtml(item.path)}</strong>
              <span>治理分 \${formatScore(item.governanceScore)} · LOC \${formatNumber(item.loc)} · 文件 \${formatNumber(item.fileCount)}</span>
            </div>
            <em>\${formatNumber(item.churn)}</em>
          \`;
          moduleRankingElement.appendChild(row);
        }
      }

      function renderMatrix(modules) {
        clearSvg(matrixElement);

        const sortedModules = [...modules]
          .sort((left, right) => {
            if (right.churn !== left.churn) {
              return right.churn - left.churn;
            }
            return right.loc - left.loc;
          })
          .slice(0, report.meta.topModules);

        const weeks = report.weeks;

        if (sortedModules.length === 0 || weeks.length === 0) {
          renderSvgEmptyState(matrixElement, "当前筛选下没有足够的时间热度数据");
          return;
        }

        const width = 1180;
        const height = Math.max(340, 100 + sortedModules.length * 28);
        matrixElement.setAttribute("viewBox", \`0 0 \${width} \${height}\`);

        const margin = {
          top: 48,
          right: 24,
          bottom: 54,
          left: 220,
        };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const cellWidth = innerWidth / weeks.length;
        const cellHeight = innerHeight / sortedModules.length;

        const maxValue = Math.max(
          1,
          ...sortedModules.flatMap((module) =>
            weeks.map((week) => module.weekly[week] || 0),
          ),
        );

        const axisColor = "#64748b";
        const gridGroup = createSvgElement("g");

        sortedModules.forEach((module, rowIndex) => {
          const y = margin.top + rowIndex * cellHeight;

          const label = createSvgElement("text");
          label.setAttribute("x", String(margin.left - 12));
          label.setAttribute("y", String(y + cellHeight / 2 + 4));
          label.setAttribute("text-anchor", "end");
          label.setAttribute("font-size", "12");
          label.setAttribute("fill", axisColor);
          label.textContent = truncateLabel(module.path, 28);
          bindTooltip(label, [
            module.path,
            "LOC: " + formatNumber(module.loc),
            "总 churn: " + formatNumber(module.churn),
          ].join("\\n"));
          gridGroup.appendChild(label);
        });

        const xLabelStep = Math.max(1, Math.ceil(weeks.length / 8));

        weeks.forEach((week, columnIndex) => {
          const x = margin.left + columnIndex * cellWidth;

          if (columnIndex % xLabelStep === 0 || columnIndex === weeks.length - 1) {
            const label = createSvgElement("text");
            label.setAttribute("x", String(x + cellWidth / 2));
            label.setAttribute("y", String(height - 18));
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("font-size", "11");
            label.setAttribute("fill", axisColor);
            label.textContent = week;
            gridGroup.appendChild(label);
          }
        });

        sortedModules.forEach((module, rowIndex) => {
          const y = margin.top + rowIndex * cellHeight;

          weeks.forEach((week, columnIndex) => {
            const value = module.weekly[week] || 0;
            const x = margin.left + columnIndex * cellWidth;
            const rect = createSvgElement("rect");
            rect.setAttribute("x", String(x + 1));
            rect.setAttribute("y", String(y + 1));
            rect.setAttribute("width", String(Math.max(0, cellWidth - 2)));
            rect.setAttribute("height", String(Math.max(0, cellHeight - 2)));
            rect.setAttribute("rx", String(Math.min(6, cellHeight / 4)));
            rect.setAttribute(
              "fill",
              value > 0 ? colorFromScale(value, 0, maxValue) : "#edf2f7",
            );
            rect.setAttribute("stroke", "#ffffff");
            rect.setAttribute("stroke-width", "1");
            bindTooltip(
              rect,
              [
                module.path,
                week,
                "周 churn: " + formatNumber(value),
                "模块总 churn: " + formatNumber(module.churn),
              ].join("\\n"),
            );
            gridGroup.appendChild(rect);
          });
        });

        matrixElement.appendChild(gridGroup);
      }

      function renderHotFiles(modules) {
        const allowedModules = new Set(modules.map((module) => module.path));
        const filteredFiles = report.hotFiles.filter((file) =>
          allowedModules.has(file.modulePath),
        );

        hotFilesBodyElement.innerHTML = "";

        if (filteredFiles.length === 0) {
          hotFilesBodyElement.innerHTML =
            '<tr><td colspan="6"><div class="empty">当前筛选下没有热点文件</div></td></tr>';
          return;
        }

        filteredFiles.slice(0, 16).forEach((file) => {
          const row = document.createElement("tr");
          row.innerHTML = \`
            <td><code>\${escapeHtmlHtml(file.path)}</code></td>
            <td>\${escapeHtmlHtml(file.modulePath)}</td>
            <td>\${formatNumber(file.loc)}</td>
            <td>\${formatNumber(file.churn)}</td>
            <td>\${formatDensity(file.churnDensity)}</td>
            <td>\${file.lastTouchedAt ? escapeHtmlHtml(file.lastTouchedAt) : "—"}</td>
          \`;
          hotFilesBodyElement.appendChild(row);
        });
      }

      function clearSvg(svg) {
        while (svg.firstChild) {
          svg.removeChild(svg.firstChild);
        }
      }

      function renderSvgEmptyState(svg, message) {
        const width = Number(svg.getAttribute("viewBox").split(" ")[2]) || 980;
        const height = Number(svg.getAttribute("viewBox").split(" ")[3]) || 560;
        const text = createSvgElement("text");
        text.setAttribute("x", String(width / 2));
        text.setAttribute("y", String(height / 2));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#64748b");
        text.setAttribute("font-size", "16");
        text.textContent = message;
        svg.appendChild(text);
      }

      function createSvgElement(name) {
        return document.createElementNS("http://www.w3.org/2000/svg", name);
      }

      function bindTooltip(target, text) {
        target.addEventListener("mouseenter", (event) => {
          tooltipElement.textContent = text;
          tooltipElement.classList.add("visible");
          moveTooltip(event);
        });
        target.addEventListener("mousemove", moveTooltip);
        target.addEventListener("mouseleave", () => {
          tooltipElement.classList.remove("visible");
        });
      }

      function moveTooltip(event) {
        const offset = 16;
        const maxX = window.innerWidth - tooltipElement.offsetWidth - 12;
        const maxY = window.innerHeight - tooltipElement.offsetHeight - 12;
        const nextX = Math.min(event.clientX + offset, Math.max(12, maxX));
        const nextY = Math.min(event.clientY + offset, Math.max(12, maxY));
        tooltipElement.style.left = nextX + "px";
        tooltipElement.style.top = nextY + "px";
      }

      function layoutTreemap(items, x, y, width, height) {
        if (items.length === 0) {
          return [];
        }

        if (items.length === 1) {
          return [
            {
              ...items[0],
              x,
              y,
              width,
              height,
            },
          ];
        }

        const total = items.reduce((sum, item) => sum + item.value, 0);
        const horizontal = width >= height;
        const midpoint = total / 2;
        let leftSum = 0;
        let splitIndex = 0;

        while (splitIndex < items.length && leftSum < midpoint) {
          leftSum += items[splitIndex].value;
          splitIndex += 1;
        }

        if (splitIndex <= 0) {
          splitIndex = 1;
        }

        if (splitIndex >= items.length) {
          splitIndex = items.length - 1;
          leftSum = items
            .slice(0, splitIndex)
            .reduce((sum, item) => sum + item.value, 0);
        }

        const rightSum = total - leftSum;
        const leftItems = items.slice(0, splitIndex);
        const rightItems = items.slice(splitIndex);

        if (horizontal) {
          const leftWidth = total > 0 ? (width * leftSum) / total : width / 2;
          return [
            ...layoutTreemap(leftItems, x, y, leftWidth, height),
            ...layoutTreemap(rightItems, x + leftWidth, y, width - leftWidth, height),
          ];
        }

        const topHeight = total > 0 ? (height * leftSum) / total : height / 2;
        return [
          ...layoutTreemap(leftItems, x, y, width, topHeight),
          ...layoutTreemap(rightItems, x, y + topHeight, width, height - topHeight),
        ];
      }

      function colorFromScale(value, min, max) {
        const safeMax = max <= min ? min + 1 : max;
        const ratio = clamp((value - min) / (safeMax - min), 0, 1);
        return interpolateStops(ratio);
      }

      function interpolateStops(ratio) {
        const stops = ${JSON.stringify(COLOR_STOPS)};
        for (let index = 1; index < stops.length; index += 1) {
          const previous = stops[index - 1];
          const current = stops[index];
          if (ratio <= current.at) {
            const local = (ratio - previous.at) / (current.at - previous.at);
            return mixColor(previous.color, current.color, local);
          }
        }
        return stops[stops.length - 1].color;
      }

      function mixColor(left, right, ratio) {
        const from = hexToRgb(left);
        const to = hexToRgb(right);
        const r = Math.round(from.r + (to.r - from.r) * ratio);
        const g = Math.round(from.g + (to.g - from.g) * ratio);
        const b = Math.round(from.b + (to.b - from.b) * ratio);
        return \`rgb(\${r}, \${g}, \${b})\`;
      }

      function hexToRgb(hex) {
        const value = hex.replace("#", "");
        return {
          r: Number.parseInt(value.slice(0, 2), 16),
          g: Number.parseInt(value.slice(2, 4), 16),
          b: Number.parseInt(value.slice(4, 6), 16),
        };
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function formatDensity(value) {
        return Number(value || 0).toFixed(3);
      }

      function formatScore(value) {
        return Number(value || 0).toFixed(1);
      }

      function formatNumber(value) {
        return new Intl.NumberFormat("zh-CN").format(value || 0);
      }

      function truncateLabel(value, maxLength) {
        if (value.length <= maxLength) {
          return value;
        }
        return value.slice(0, Math.max(0, maxLength - 1)) + "…";
      }

      function escapeHtmlHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function roundTo(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}
