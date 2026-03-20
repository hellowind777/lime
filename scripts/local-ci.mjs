#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";

const options = parseArgs(process.argv.slice(2));
const rootDir = process.cwd();

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const cargoCommand = process.platform === "win32" ? "cargo.exe" : "cargo";
const gitCommand = process.platform === "win32" ? "git.exe" : "git";

const FRONTEND_ROOT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.node.json",
  "eslint.config.js",
  "tailwind.config.js",
  "postcss.config.js",
  "index.html",
]);

const BRIDGE_FILES = new Set([
  "vite.config.ts",
  "scripts/check-dev-bridge-health.mjs",
  "scripts/social-workbench-e2e-smoke.mjs",
  "scripts/chrome-bridge-e2e.mjs",
  "docs/aiprompts/playwright-e2e.md",
]);

function parseArgs(argv) {
  const result = {
    full: false,
    staged: false,
    base: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--full") {
      result.full = true;
      continue;
    }
    if (arg === "--staged") {
      result.staged = true;
      continue;
    }
    if (arg === "--base" && argv[index + 1]) {
      result.base = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Lime 本地校验入口

用法:
  npm run verify:local
  npm run verify:local -- --staged
  npm run verify:local -- --base origin/main
  npm run verify:local:full

选项:
  --full      忽略改动检测，执行全量本地校验
  --staged    仅基于已暂存文件判断要跑的检查
  --base REF  基于指定基线计算改动文件
  -h, --help  显示帮助
`);
}

function runCommand(command, args) {
  console.log(`\n[local-ci] > ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function gitOutput(args) {
  try {
    return execFileSync(gitCommand, args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function splitLines(value) {
  if (!value) {
    return [];
  }
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveDiffBase() {
  if (options.base) {
    return options.base;
  }

  const upstream = gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream) {
    return upstream;
  }

  for (const candidate of ["origin/main", "origin/master", "main", "master"]) {
    const exists = gitOutput(["rev-parse", "--verify", candidate]);
    if (exists) {
      return candidate;
    }
  }

  return "";
}

function collectChangedFiles() {
  if (options.full) {
    return [];
  }

  if (options.staged) {
    return uniquePaths(
      splitLines(gitOutput(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])),
    );
  }

  const base = resolveDiffBase();
  const candidates = [];

  if (base) {
    candidates.push(
      ...splitLines(gitOutput(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`])),
    );
  }

  candidates.push(
    ...splitLines(gitOutput(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"])),
  );
  candidates.push(
    ...splitLines(gitOutput(["ls-files", "--others", "--exclude-standard"])),
  );

  return uniquePaths(candidates);
}

function uniquePaths(paths) {
  return Array.from(new Set(paths));
}

function isFrontendChange(file) {
  return (
    file.startsWith("src/") ||
    FRONTEND_ROOT_FILES.has(file)
  );
}

function isRustChange(file) {
  return file.startsWith("src-tauri/");
}

function isBridgeChange(file) {
  return (
    file.startsWith("src/lib/dev-bridge/") ||
    file.startsWith("src/lib/tauri-mock/") ||
    BRIDGE_FILES.has(file)
  );
}

function isDocsOnlyChange(files) {
  return files.length > 0 && files.every((file) => file.startsWith("docs/"));
}

function detectTasks(changedFiles) {
  if (options.full) {
    return {
      frontend: true,
      rust: true,
      bridge: true,
    };
  }

  if (changedFiles.length === 0) {
    return {
      frontend: true,
      rust: true,
      bridge: true,
      fallback: true,
    };
  }

  if (isDocsOnlyChange(changedFiles)) {
    return {
      frontend: false,
      rust: false,
      bridge: false,
      docsOnly: true,
    };
  }

  const frontend = changedFiles.some(isFrontendChange);
  const rust = changedFiles.some(isRustChange);
  const bridge = changedFiles.some(isBridgeChange);

  return {
    frontend,
    rust,
    bridge,
  };
}

function printSummary(changedFiles, tasks) {
  console.log("[local-ci] 模式:", options.full ? "full" : "smart");
  if (!options.full) {
    console.log("[local-ci] 检测到改动文件数:", changedFiles.length);
    if (changedFiles.length > 0) {
      const preview = changedFiles.slice(0, 12);
      for (const file of preview) {
        console.log(`[local-ci] - ${file}`);
      }
      if (changedFiles.length > preview.length) {
        console.log(`[local-ci] ... 其余 ${changedFiles.length - preview.length} 个文件省略`);
      }
    }
  }

  if (tasks.docsOnly) {
    console.log("[local-ci] 当前仅检测到文档改动，跳过本地代码校验。");
    return;
  }

  console.log("[local-ci] 计划执行:");
  if (tasks.frontend) {
    console.log("[local-ci] - 前端校验");
  }
  if (tasks.bridge) {
    console.log("[local-ci] - bridge 校验");
  }
  if (tasks.rust) {
    console.log("[local-ci] - Rust 校验");
  }
  if (tasks.fallback) {
    console.log("[local-ci] - 未检测到改动，执行全量兜底校验");
  }
}

function runSelectedTasks(tasks) {
  if (tasks.docsOnly) {
    return;
  }

  if (tasks.frontend) {
    runCommand(npmCommand, ["run", "lint"]);
    runCommand(npmCommand, ["run", "typecheck"]);
    runCommand(npmCommand, ["test"]);
  }

  if (tasks.bridge) {
    if (!tasks.frontend) {
      runCommand(npmCommand, ["run", "test:bridge"]);
    }
    runCommand(npmCommand, ["run", "test:contracts"]);
  }

  if (tasks.rust) {
    runCommand(cargoCommand, ["test", "--manifest-path", "src-tauri/Cargo.toml"]);
    if (options.full) {
      runCommand(cargoCommand, ["clippy", "--manifest-path", "src-tauri/Cargo.toml"]);
    }
  }
}

function main() {
  if (options.help) {
    printHelp();
    return;
  }

  const changedFiles = collectChangedFiles();
  const tasks = detectTasks(changedFiles);
  printSummary(changedFiles, tasks);
  runSelectedTasks(tasks);
  console.log("\n[local-ci] 本地校验完成。");
}

main();
