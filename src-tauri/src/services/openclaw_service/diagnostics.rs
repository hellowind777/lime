use super::*;

impl OpenClawService {
    pub async fn get_environment_status(&self) -> Result<EnvironmentStatus, String> {
        let node = inspect_node_dependency_status().await?;
        let git = inspect_git_dependency_status().await?;
        let openclaw = inspect_openclaw_dependency_status().await?;
        let diagnostics = collect_environment_diagnostics().await;

        Ok(build_environment_status(node, git, openclaw, diagnostics))
    }

    pub async fn check_installed(&self) -> Result<BinaryInstallStatus, String> {
        let openclaw = inspect_openclaw_dependency_status().await?;
        Ok(BinaryInstallStatus {
            installed: openclaw.status == "ok",
            path: openclaw.path,
        })
    }

    pub async fn check_git_available(&self) -> Result<BinaryAvailabilityStatus, String> {
        let git = inspect_git_dependency_status().await?;
        Ok(BinaryAvailabilityStatus {
            available: git.status == "ok",
            path: git.path,
        })
    }

    pub async fn check_node_version(&self) -> Result<NodeCheckResult, String> {
        let node = inspect_node_dependency_status().await?;
        Ok(NodeCheckResult {
            status: match node.status.as_str() {
                "missing" => "not_found".to_string(),
                other => other.to_string(),
            },
            version: node.version,
            path: node.path,
        })
    }

    pub fn get_node_download_url(&self) -> String {
        if cfg!(target_os = "windows") {
            "https://nodejs.org/en/download".to_string()
        } else if cfg!(target_os = "macos") {
            "https://nodejs.org/en/download".to_string()
        } else if cfg!(target_os = "linux") {
            "https://nodejs.org/en/download".to_string()
        } else {
            "https://nodejs.org/en/download".to_string()
        }
    }

    pub fn get_git_download_url(&self) -> String {
        if cfg!(target_os = "windows") {
            "https://git-scm.com/download/win".to_string()
        } else if cfg!(target_os = "macos") {
            "https://git-scm.com/download/mac".to_string()
        } else if cfg!(target_os = "linux") {
            "https://git-scm.com/download/linux".to_string()
        } else {
            "https://git-scm.com/downloads".to_string()
        }
    }
}

#[cfg(any(target_os = "windows", test))]
pub(crate) fn windows_dependency_setup_message(
    dependency: DependencyKind,
    status: &DependencyStatus,
) -> String {
    let guidance = match dependency {
        DependencyKind::Node => format!(
            "Windows 下请先从 nodejs.org 安装或升级 Node.js {}+，完成后点击“重新检测”，再安装 OpenClaw。",
            NODE_MIN_VERSION.0
        ),
        DependencyKind::Git => {
            "Windows 下请先从 git-scm.com 安装 Git（安装时请勾选加入 PATH），完成后点击“重新检测”，再安装 OpenClaw。"
                .to_string()
        }
    };

    format!("{} {}", status.message, guidance)
}

#[cfg(any(target_os = "windows", test))]
pub(crate) fn windows_dependency_action_result(
    dependency: DependencyKind,
    status: &DependencyStatus,
) -> ActionResult {
    ActionResult {
        success: false,
        message: windows_dependency_setup_message(dependency, status),
    }
}

#[cfg(any(target_os = "windows", test))]
pub(crate) fn windows_install_block_result(
    node_status: &DependencyStatus,
    git_status: &DependencyStatus,
) -> Option<ActionResult> {
    if node_status.status != "ok" {
        return Some(windows_dependency_action_result(
            DependencyKind::Node,
            node_status,
        ));
    }

    if git_status.status != "ok" {
        return Some(windows_dependency_action_result(
            DependencyKind::Git,
            git_status,
        ));
    }

    None
}

pub(crate) fn dependency_setup_summary(dependency: DependencyKind) -> String {
    if cfg!(target_os = "windows") {
        return match dependency {
            DependencyKind::Node => format!(
                "当前缺少可用的 Node.js {}+ 运行时，Windows 下请先手动安装 Node.js，完成后点击“重新检测”，再安装 OpenClaw。",
                NODE_MIN_VERSION.0
            ),
            DependencyKind::Git => {
                "当前缺少可用的 Git，Windows 下请先手动安装 Git（安装时请勾选加入 PATH），完成后点击“重新检测”，再安装 OpenClaw。"
                    .to_string()
            }
        };
    }

    if cfg!(target_os = "macos") {
        return match dependency {
            DependencyKind::Node => format!(
                "当前缺少可用的 Node.js {}+ 运行时，建议先一键安装或修复 Node.js。",
                format_semver(NODE_MIN_VERSION)
            ),
            DependencyKind::Git => "当前缺少可用的 Git，建议先一键安装或修复 Git。".to_string(),
        };
    }

    match dependency {
        DependencyKind::Node => format!(
            "当前缺少可用的 Node.js {}+ 运行时，请先手动安装后重新检测。",
            format_semver(NODE_MIN_VERSION)
        ),
        DependencyKind::Git => "当前缺少可用的 Git，请先手动安装后重新检测。".to_string(),
    }
}

pub(crate) fn build_environment_status(
    node: DependencyStatus,
    git: DependencyStatus,
    mut openclaw: DependencyStatus,
    diagnostics: EnvironmentDiagnostics,
) -> EnvironmentStatus {
    let node_ready = node.status == "ok";
    let git_ready = git.status == "ok";
    openclaw.auto_install_supported = node_ready && git_ready;

    let (recommended_action, summary) = if !node_ready {
        (
            "install_node".to_string(),
            dependency_setup_summary(DependencyKind::Node),
        )
    } else if !git_ready {
        (
            "install_git".to_string(),
            dependency_setup_summary(DependencyKind::Git),
        )
    } else if openclaw.status == "needs_reload" {
        (
            "refresh_openclaw_env".to_string(),
            "已检测到 OpenClaw 包，但命令尚未生效；请点击“重新检测”，必要时重启 Lime。".to_string(),
        )
    } else if openclaw.status != "ok" {
        (
            "install_openclaw".to_string(),
            "运行环境已就绪，可以继续一键安装 OpenClaw。".to_string(),
        )
    } else {
        (
            "ready".to_string(),
            "Node.js、Git 和 OpenClaw 均已就绪，可以继续配置与启动。".to_string(),
        )
    };

    EnvironmentStatus {
        node,
        git,
        openclaw,
        recommended_action,
        summary,
        diagnostics,
        temp_artifacts: collect_temp_artifact_paths(None)
            .into_iter()
            .filter(|path| path.exists())
            .map(|path| path.display().to_string())
            .collect(),
    }
}

pub(crate) async fn inspect_node_dependency_status() -> Result<DependencyStatus, String> {
    let Some(path) = find_command_in_shell("node").await? else {
        return Ok(DependencyStatus {
            status: "missing".to_string(),
            version: None,
            path: None,
            message: format!(
                "未检测到 Node.js，需要安装 {}+。",
                format_semver(NODE_MIN_VERSION)
            ),
            auto_install_supported: cfg!(target_os = "macos"),
        });
    };

    let version_text = read_command_version_text(&path, &["--version"]).await?;
    let Some(version) = parse_semver_from_text(&version_text) else {
        return Ok(DependencyStatus {
            status: "version_low".to_string(),
            version: Some(version_text.clone()),
            path: Some(path),
            message: format!(
                "检测到 Node.js，但无法识别版本：{version_text}。请安装 {}+。",
                format_semver(NODE_MIN_VERSION)
            ),
            auto_install_supported: cfg!(target_os = "macos"),
        });
    };

    let normalized = format_semver(version);
    if version >= NODE_MIN_VERSION {
        Ok(DependencyStatus {
            status: "ok".to_string(),
            version: Some(normalized.clone()),
            path: Some(path),
            message: format!("Node.js 已就绪：{normalized}"),
            auto_install_supported: cfg!(target_os = "macos"),
        })
    } else {
        Ok(DependencyStatus {
            status: "version_low".to_string(),
            version: Some(normalized.clone()),
            path: Some(path),
            message: format!(
                "Node.js 版本过低：{normalized}，需要 {}+。",
                format_semver(NODE_MIN_VERSION)
            ),
            auto_install_supported: cfg!(target_os = "macos"),
        })
    }
}

pub(crate) async fn inspect_git_dependency_status() -> Result<DependencyStatus, String> {
    let Some(path) = find_command_in_shell("git").await? else {
        return Ok(DependencyStatus {
            status: "missing".to_string(),
            version: None,
            path: None,
            message: "未检测到 Git。".to_string(),
            auto_install_supported: git_auto_install_supported().await?,
        });
    };

    let version_text = read_command_version_text(&path, &["--version"]).await?;
    let version = parse_semver_from_text(&version_text).map(format_semver);
    let detail = version.clone().unwrap_or(version_text);

    Ok(DependencyStatus {
        status: "ok".to_string(),
        version,
        path: Some(path),
        message: format!("Git 已就绪：{detail}"),
        auto_install_supported: git_auto_install_supported().await?,
    })
}

pub(crate) async fn inspect_openclaw_dependency_status() -> Result<DependencyStatus, String> {
    let Some(command) = resolve_openclaw_command().await? else {
        if let Some(status) = inspect_openclaw_package_reload_status().await? {
            return Ok(status);
        }

        return Ok(DependencyStatus {
            status: "missing".to_string(),
            version: None,
            path: None,
            message: "未检测到 OpenClaw，可在环境就绪后一键安装。".to_string(),
            auto_install_supported: false,
        });
    };

    let version_text = read_openclaw_version_from_command(&command)
        .await?
        .unwrap_or_default();
    Ok(DependencyStatus {
        status: "ok".to_string(),
        version: if version_text.is_empty() {
            None
        } else {
            Some(version_text.clone())
        },
        path: Some(command.install_path_display()),
        message: if matches!(command, ResolvedOpenClawCommand::NodeCli { .. }) {
            if version_text.is_empty() {
                "已检测到 OpenClaw 包，Lime 将通过当前 Node 运行时直接启动。".to_string()
            } else {
                format!("已检测到 OpenClaw 包，Lime 将通过当前 Node 运行时直接启动：{version_text}")
            }
        } else if version_text.is_empty() {
            "已检测到 OpenClaw。".to_string()
        } else {
            format!("已检测到 OpenClaw：{version_text}")
        },
        auto_install_supported: false,
    })
}

pub(crate) async fn inspect_openclaw_package_reload_status(
) -> Result<Option<DependencyStatus>, String> {
    let Some(npm_path) = find_command_in_standard_locations("npm").await? else {
        return Ok(None);
    };
    let Some(prefix) = detect_npm_global_prefix(&npm_path).await else {
        return Ok(None);
    };
    let Some(package) = find_installed_openclaw_package_details(&prefix) else {
        return Ok(None);
    };

    let version_suffix = package
        .version
        .as_deref()
        .map(|item| format!("（{item}）"))
        .unwrap_or_default();

    Ok(Some(DependencyStatus {
        status: "needs_reload".to_string(),
        version: package.version.clone(),
        path: Some(prefix.clone()),
        message: format!(
            "已在 npm 全局目录检测到 {}{}，但当前进程尚未解析到 openclaw 命令。请点击“重新检测”；若仍失败，请重启 Lime，或确认 {prefix} 已加入 PATH。", package.name, version_suffix
        ),
        auto_install_supported: false,
    }))
}

pub(crate) async fn git_auto_install_supported() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(true)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

pub(crate) async fn read_command_version_text(
    command_path: &str,
    args: &[&str],
) -> Result<String, String> {
    let mut command = Command::new(command_path);
    apply_binary_runtime_path(&mut command, command_path);
    for arg in args {
        command.arg(arg);
    }
    let output = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("执行命令失败({command_path}): {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stdout.is_empty() {
        Ok(stdout)
    } else {
        Ok(stderr)
    }
}

pub(crate) async fn collect_environment_diagnostics() -> EnvironmentDiagnostics {
    let npm_path = find_command_in_standard_locations("npm")
        .await
        .ok()
        .flatten();
    let npm_global_prefix = match npm_path.as_deref() {
        Some(path) => detect_npm_global_prefix(path).await,
        None => None,
    };

    #[cfg(target_os = "windows")]
    let where_candidates = find_commands_via_where("openclaw")
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.display().to_string())
        .collect();

    #[cfg(not(target_os = "windows"))]
    let where_candidates = Vec::new();

    let supplemental_search_dirs =
        collect_supplemental_openclaw_search_dirs(npm_global_prefix.as_deref());
    let supplemental_command_candidates =
        find_all_commands_in_paths("openclaw", &supplemental_search_dirs)
            .into_iter()
            .map(|path| path.display().to_string())
            .collect();
    let openclaw_package_path = npm_global_prefix
        .as_deref()
        .and_then(find_installed_openclaw_package_details)
        .map(|package| package.path.display().to_string());

    #[cfg(target_os = "windows")]
    let git_where_candidates = find_commands_via_where("git")
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.display().to_string())
        .collect();

    #[cfg(not(target_os = "windows"))]
    let git_where_candidates = Vec::new();

    let git_supplemental_search_dirs = collect_supplemental_git_search_dirs();
    let git_supplemental_command_candidates =
        find_all_commands_in_paths("git", &git_supplemental_search_dirs)
            .into_iter()
            .map(|path| path.display().to_string())
            .collect();

    EnvironmentDiagnostics {
        npm_path,
        npm_global_prefix,
        openclaw_package_path,
        where_candidates,
        supplemental_search_dirs: supplemental_search_dirs
            .into_iter()
            .map(|path| path.display().to_string())
            .collect(),
        supplemental_command_candidates,
        git_where_candidates,
        git_supplemental_search_dirs: git_supplemental_search_dirs
            .into_iter()
            .map(|path| path.display().to_string())
            .collect(),
        git_supplemental_command_candidates,
    }
}

pub(crate) fn collect_supplemental_openclaw_search_dirs(
    npm_global_prefix: Option<&str>,
) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        dirs.extend(windows_known_command_dirs_from_env());
    }

    if let Some(prefix) = npm_global_prefix {
        dirs.extend(npm_global_command_dirs(prefix));
    }

    collect_existing_unique_dirs(dirs)
}

pub(crate) fn collect_supplemental_git_search_dirs() -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return collect_existing_unique_dirs(windows_known_git_command_dirs_from_env());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}
