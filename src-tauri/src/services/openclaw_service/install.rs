use super::*;

impl OpenClawService {
    pub async fn install(&mut self, app: &AppHandle) -> Result<ActionResult, String> {
        emit_install_progress(app, "开始准备 OpenClaw 环境。", "info");

        #[cfg(target_os = "windows")]
        {
            let node_status = self.inspect_dependency_status(DependencyKind::Node).await?;
            let git_status = self.inspect_dependency_status(DependencyKind::Git).await?;
            if let Some(result) = windows_install_block_result(&node_status, &git_status) {
                emit_install_progress(app, &result.message, "warn");
                return Ok(result);
            }
        }

        let node_result = self
            .ensure_dependency_ready(app, DependencyKind::Node)
            .await?;
        if !node_result.success {
            return Ok(node_result);
        }

        let git_result = self
            .ensure_dependency_ready(app, DependencyKind::Git)
            .await?;
        if !git_result.success {
            return Ok(git_result);
        }

        let (_, npm_path, npm_prefix, cleanup_command, install_command) =
            self.resolve_install_commands(app).await?;

        emit_install_progress(app, &format!("使用 npm: {npm_path}"), "info");
        if let Some(prefix) = npm_prefix {
            emit_install_progress(app, &format!("npm 全局前缀: {prefix}"), "info");
        }
        emit_install_progress(app, "安装前先清理已有 OpenClaw 全局包。", "info");
        let cleanup_result = run_shell_command_with_progress(app, &cleanup_command).await?;
        if !cleanup_result.success {
            emit_install_progress(
                app,
                &format!(
                    "清理旧版 OpenClaw 失败，继续尝试安装：{}",
                    cleanup_result.message
                ),
                "warn",
            );
        }

        emit_install_progress(app, &format!("执行安装命令: {install_command}"), "info");
        let result = run_shell_command_with_progress(app, &install_command).await?;
        if !result.success {
            return Ok(result);
        }

        let installed = self.check_installed().await?;
        if installed.installed {
            emit_install_progress(app, "已检测到 OpenClaw 可执行文件。", "info");
            return Ok(ActionResult {
                success: true,
                message: installed
                    .path
                    .map(|path| format!("OpenClaw 安装完成：{path}"))
                    .unwrap_or_else(|| "OpenClaw 安装完成。".to_string()),
            });
        }

        Ok(ActionResult {
            success: false,
            message:
                "安装命令执行完成，但仍未检测到 OpenClaw 可执行文件，请检查 npm 全局目录或权限设置。"
                    .to_string(),
        })
    }

    pub async fn install_dependency(
        &mut self,
        app: &AppHandle,
        kind: &str,
    ) -> Result<ActionResult, String> {
        let dependency = match kind {
            "node" => DependencyKind::Node,
            "git" => DependencyKind::Git,
            _ => return Err(format!("不支持的依赖类型: {kind}")),
        };

        #[cfg(target_os = "windows")]
        {
            let status = self.inspect_dependency_status(dependency).await?;
            if status.status == "ok" {
                emit_install_progress(
                    app,
                    &format!(
                        "{} 已就绪{}。",
                        dependency.label(),
                        status
                            .version
                            .as_deref()
                            .map(|version| format!(" · {version}"))
                            .unwrap_or_default()
                    ),
                    "info",
                );
                return Ok(ActionResult {
                    success: true,
                    message: format!("{} 已满足要求。", dependency.label()),
                });
            }

            let result = windows_dependency_action_result(dependency, &status);
            emit_install_progress(app, &result.message, "warn");
            return Ok(result);
        }

        #[cfg(not(target_os = "windows"))]
        {
            self.ensure_dependency_ready(app, dependency).await
        }
    }

    pub async fn cleanup_temp_artifacts(
        &mut self,
        app: Option<&AppHandle>,
    ) -> Result<ActionResult, String> {
        let mut removed = Vec::new();
        let mut failed = Vec::new();

        for target in collect_temp_artifact_paths(app) {
            if !target.exists() {
                continue;
            }

            let result = if target.is_dir() {
                std::fs::remove_dir_all(&target)
            } else {
                std::fs::remove_file(&target)
            };

            match result {
                Ok(_) => {
                    if let Some(app) = app {
                        emit_install_progress(
                            app,
                            &format!("已清理临时文件：{}", target.display()),
                            "info",
                        );
                    }
                    removed.push(target.display().to_string());
                }
                Err(error) => {
                    if let Some(app) = app {
                        emit_install_progress(
                            app,
                            &format!("清理临时文件失败({}): {error}", target.display()),
                            "warn",
                        );
                    }
                    failed.push(format!("{}: {error}", target.display()));
                }
            }
        }

        if failed.is_empty() {
            Ok(ActionResult {
                success: true,
                message: if removed.is_empty() {
                    "未发现需要清理的 OpenClaw 临时文件。".to_string()
                } else {
                    format!("已清理 {} 项临时文件。", removed.len())
                },
            })
        } else {
            Ok(ActionResult {
                success: false,
                message: format!("部分临时文件清理失败：{}", failed.join("；")),
            })
        }
    }

    pub async fn uninstall(&mut self, app: &AppHandle) -> Result<ActionResult, String> {
        if self.gateway_status == GatewayStatus::Running || self.gateway_process.is_some() {
            let _ = self.stop_gateway(None).await;
        }

        let (npm_path, npm_prefix, command) = self.resolve_uninstall_command().await?;

        emit_install_progress(app, &format!("使用 npm: {npm_path}"), "info");
        if let Some(prefix) = npm_prefix {
            emit_install_progress(app, &format!("npm 全局前缀: {prefix}"), "info");
        }
        emit_install_progress(app, &format!("执行卸载命令: {command}"), "info");
        run_shell_command_with_progress(app, &command).await
    }

    async fn ensure_dependency_ready(
        &mut self,
        app: &AppHandle,
        dependency: DependencyKind,
    ) -> Result<ActionResult, String> {
        let status = self.inspect_dependency_status(dependency).await?;
        if status.status == "ok" {
            emit_install_progress(
                app,
                &format!(
                    "{} 已就绪{}。",
                    dependency.label(),
                    status
                        .version
                        .as_deref()
                        .map(|version| format!(" · {version}"))
                        .unwrap_or_default()
                ),
                "info",
            );
            return Ok(ActionResult {
                success: true,
                message: format!("{} 已满足要求。", dependency.label()),
            });
        }

        emit_install_progress(
            app,
            &format!("{}，开始修复 {} 环境。", status.message, dependency.label()),
            "warn",
        );

        match dependency {
            DependencyKind::Node => self.install_node_runtime(app).await,
            DependencyKind::Git => self.install_git_runtime(app).await,
        }
    }

    async fn inspect_dependency_status(
        &self,
        dependency: DependencyKind,
    ) -> Result<DependencyStatus, String> {
        match dependency {
            DependencyKind::Node => inspect_node_dependency_status().await,
            DependencyKind::Git => inspect_git_dependency_status().await,
        }
    }

    async fn install_node_runtime(&mut self, app: &AppHandle) -> Result<ActionResult, String> {
        #[cfg(target_os = "windows")]
        {
            let winget_path = find_command_in_shell("winget").await?;
            match resolve_windows_dependency_install_plan(
                DependencyKind::Node,
                winget_path.is_some(),
            ) {
                WindowsDependencyInstallPlan::Winget { package_id } => {
                    let winget_path = winget_path.expect("winget path should exist");
                    emit_install_progress(
                        app,
                        "检测到 winget，准备通过 winget 安装 Node.js。",
                        "info",
                    );
                    let command = build_winget_install_command(&winget_path, package_id);
                    let result = run_shell_command_with_progress(app, &command).await?;
                    if !result.success {
                        return Ok(result);
                    }
                    return self
                        .verify_dependency_after_install(app, DependencyKind::Node)
                        .await;
                }
                WindowsDependencyInstallPlan::OfficialInstaller => {
                    emit_install_progress(
                        app,
                        "未检测到 winget，准备下载官方 Node.js 安装器。",
                        "warn",
                    );
                    let asset = resolve_node_installer_asset().await?;
                    let installer_path = download_installer_asset(app, &asset).await?;
                    launch_installer(&installer_path)?;
                    return self
                        .wait_for_dependency_ready(app, DependencyKind::Node, 900)
                        .await;
                }
                WindowsDependencyInstallPlan::ManualDownload => {
                    unreachable!("Node.js 在 Windows 上不应返回手动下载计划")
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(brew_path) = find_command_in_shell("brew").await? {
                emit_install_progress(
                    app,
                    "检测到 Homebrew，准备通过 Homebrew 安装 Node.js。",
                    "info",
                );
                let brew_cmd = shell_command_escape(&brew_path);
                let path_env = shell_path_assignment(&brew_path);
                let command = format!(
                    "{path_env}{brew_cmd} install node || {path_env}{brew_cmd} upgrade node"
                );
                let result = run_shell_command_with_progress(app, &command).await?;
                if !result.success {
                    return Ok(result);
                }
                return self
                    .verify_dependency_after_install(app, DependencyKind::Node)
                    .await;
            }

            emit_install_progress(
                app,
                "未检测到 Homebrew，准备下载官方 Node.js 安装器。",
                "warn",
            );
            let asset = resolve_node_installer_asset().await?;
            let installer_path = download_installer_asset(app, &asset).await?;
            launch_installer(&installer_path)?;
            return self
                .wait_for_dependency_ready(app, DependencyKind::Node, 900)
                .await;
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let message = "当前平台暂不支持应用内自动安装 Node.js，请手动安装 Node.js 22+ 后重试。"
                .to_string();
            emit_install_progress(app, &message, "warn");
            Ok(ActionResult {
                success: false,
                message,
            })
        }
    }

    async fn install_git_runtime(&mut self, app: &AppHandle) -> Result<ActionResult, String> {
        #[cfg(target_os = "windows")]
        {
            let winget_path = find_command_in_shell("winget").await?;
            match resolve_windows_dependency_install_plan(
                DependencyKind::Git,
                winget_path.is_some(),
            ) {
                WindowsDependencyInstallPlan::Winget { package_id } => {
                    let winget_path = winget_path.expect("winget path should exist");
                    emit_install_progress(app, "检测到 winget，准备通过 winget 安装 Git。", "info");
                    let command = build_winget_install_command(&winget_path, package_id);
                    let result = run_shell_command_with_progress(app, &command).await?;
                    if !result.success {
                        return Ok(result);
                    }
                    return self
                        .verify_dependency_after_install(app, DependencyKind::Git)
                        .await;
                }
                WindowsDependencyInstallPlan::OfficialInstaller => {
                    unreachable!("Git 在 Windows 上不应返回官方安装器计划")
                }
                WindowsDependencyInstallPlan::ManualDownload => {
                    let message = windows_manual_install_message(DependencyKind::Git).to_string();
                    emit_install_progress(app, &message, "warn");
                    return Ok(ActionResult {
                        success: false,
                        message,
                    });
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(brew_path) = find_command_in_shell("brew").await? {
                emit_install_progress(app, "检测到 Homebrew，准备通过 Homebrew 安装 Git。", "info");
                let brew_cmd = shell_command_escape(&brew_path);
                let path_env = shell_path_assignment(&brew_path);
                let command =
                    format!("{path_env}{brew_cmd} install git || {path_env}{brew_cmd} upgrade git");
                let result = run_shell_command_with_progress(app, &command).await?;
                if !result.success {
                    return Ok(result);
                }
                return self
                    .verify_dependency_after_install(app, DependencyKind::Git)
                    .await;
            }

            emit_install_progress(
                app,
                "未检测到 Homebrew，准备拉起 macOS Command Line Tools 安装器。",
                "warn",
            );
            let trigger_result = trigger_macos_command_line_tools_install().await?;
            emit_install_progress(app, &trigger_result, "info");
            return self
                .wait_for_dependency_ready(app, DependencyKind::Git, 1200)
                .await;
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let message = "当前平台暂不支持应用内自动安装 Git，请使用系统包管理器手动安装后重试。"
                .to_string();
            emit_install_progress(app, &message, "warn");
            Ok(ActionResult {
                success: false,
                message,
            })
        }
    }

    async fn verify_dependency_after_install(
        &self,
        app: &AppHandle,
        dependency: DependencyKind,
    ) -> Result<ActionResult, String> {
        // 在 Windows 上刷新 PATH 环境变量
        #[cfg(target_os = "windows")]
        {
            if let Err(e) = refresh_windows_path_from_registry() {
                emit_install_progress(app, &format!("刷新环境变量失败: {}", e), "warn");
            } else {
                emit_install_progress(app, "已刷新系统环境变量。", "info");
            }
        }

        let status = self.inspect_dependency_status(dependency).await?;
        if status.status == "ok" {
            emit_install_progress(
                app,
                &format!(
                    "{} 已准备完成{}。",
                    dependency.label(),
                    status
                        .version
                        .as_deref()
                        .map(|version| format!(" · {version}"))
                        .unwrap_or_default()
                ),
                "info",
            );
            return Ok(ActionResult {
                success: true,
                message: format!("{} 已安装完成。", dependency.label()),
            });
        }

        Ok(ActionResult {
            success: false,
            message: format!(
                "{} 安装完成后仍未通过校验：{}",
                dependency.label(),
                status.message
            ),
        })
    }

    async fn wait_for_dependency_ready(
        &self,
        app: &AppHandle,
        dependency: DependencyKind,
        timeout_secs: u64,
    ) -> Result<ActionResult, String> {
        emit_install_progress(
            app,
            &format!(
                "已拉起 {} 安装器，正在等待安装完成（最长 {} 秒）。",
                dependency.label(),
                timeout_secs
            ),
            "info",
        );

        let start = tokio::time::Instant::now();
        let mut last_notice_at = 0_u64;
        #[cfg(target_os = "windows")]
        let mut last_refresh_at = 0_u64;

        while start.elapsed() < Duration::from_secs(timeout_secs) {
            let elapsed = start.elapsed().as_secs();

            // 每 10 秒刷新一次 Windows PATH（因为用户可能在安装过程中）
            #[cfg(target_os = "windows")]
            if elapsed >= last_refresh_at + 10 {
                last_refresh_at = elapsed;
                let _ = refresh_windows_path_from_registry();
            }

            if elapsed >= last_notice_at + 15 {
                last_notice_at = elapsed;
                emit_install_progress(
                    app,
                    &format!("正在等待 {} 安装完成…", dependency.label()),
                    "info",
                );
            }

            sleep(Duration::from_secs(2)).await;
            let status = self.inspect_dependency_status(dependency).await?;
            if status.status == "ok" {
                emit_install_progress(
                    app,
                    &format!(
                        "{} 已检测通过{}。",
                        dependency.label(),
                        status
                            .version
                            .as_deref()
                            .map(|version| format!(" · {version}"))
                            .unwrap_or_default()
                    ),
                    "info",
                );
                return Ok(ActionResult {
                    success: true,
                    message: format!("{} 已安装完成。", dependency.label()),
                });
            }
        }

        Ok(ActionResult {
            success: false,
            message: format!(
                "等待 {} 安装完成超时，请完成安装后重新点击重试。",
                dependency.label()
            ),
        })
    }
    pub(crate) async fn resolve_install_commands(
        &self,
        app: &AppHandle,
    ) -> Result<(String, String, Option<String>, String, String), String> {
        let npm_path = find_command_in_shell("npm")
            .await?
            .ok_or_else(|| "未检测到 npm，可先安装或修复 Node.js 环境。".to_string())?;
        let npm_prefix = detect_npm_global_prefix(&npm_path).await;
        let use_china_package = should_use_china_package(app).await;
        let package = if use_china_package {
            OPENCLAW_CN_PACKAGE
        } else {
            OPENCLAW_DEFAULT_PACKAGE
        };
        let shell_platform = current_shell_platform();
        let cleanup_command =
            build_openclaw_cleanup_command(shell_platform, &npm_path, npm_prefix.as_deref());
        let install_command = build_openclaw_install_command(
            shell_platform,
            &npm_path,
            npm_prefix.as_deref(),
            package,
            use_china_package.then_some(NPM_MIRROR_CN),
        );
        Ok((
            package.to_string(),
            npm_path,
            npm_prefix,
            cleanup_command,
            install_command,
        ))
    }

    pub(crate) async fn resolve_uninstall_command(
        &self,
    ) -> Result<(String, Option<String>, String), String> {
        let npm_path = find_command_in_shell("npm")
            .await?
            .ok_or_else(|| "未检测到 npm，可先安装或修复 Node.js 环境。".to_string())?;
        let npm_prefix = detect_npm_global_prefix(&npm_path).await;
        let command = build_openclaw_cleanup_command(
            current_shell_platform(),
            &npm_path,
            npm_prefix.as_deref(),
        );
        Ok((npm_path, npm_prefix, command))
    }
}

pub(crate) fn openclaw_installer_download_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let _ = app;
    let app_data_dir = lime_core::app_paths::preferred_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    let dir = app_data_dir.join("downloads").join("openclaw-installers");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建 OpenClaw 下载目录失败: {e}"))?;
    Ok(dir)
}

pub(crate) fn collect_temp_artifact_paths(app: Option<&AppHandle>) -> Vec<PathBuf> {
    let mut targets = Vec::new();

    #[cfg(not(target_os = "windows"))]
    {
        targets.push(PathBuf::from(OPENCLAW_TEMP_CARGO_CHECK_DIR));
    }

    if let Some(app) = app {
        if let Ok(dir) = openclaw_installer_download_dir(app) {
            targets.push(dir);
        }
    }

    targets
}

pub(crate) async fn resolve_node_installer_asset() -> Result<InstallerAsset, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://nodejs.org/dist/index.json")
        .header("User-Agent", OPENCLAW_INSTALLER_USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("请求 Node.js 版本列表失败: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "获取 Node.js 版本列表失败: HTTP {}",
            response.status()
        ));
    }

    let releases: Vec<Value> = response
        .json()
        .await
        .map_err(|e| format!("解析 Node.js 版本列表失败: {e}"))?;

    let select_version = |only_lts: bool| -> Option<String> {
        releases.iter().find_map(|release| {
            let version = release.get("version")?.as_str()?;
            let parsed = parse_semver(version)?;
            let is_lts = release
                .get("lts")
                .map(|value| match value {
                    Value::Bool(flag) => *flag,
                    Value::String(text) => !text.trim().is_empty() && text != "false",
                    _ => false,
                })
                .unwrap_or(false);
            if parsed >= NODE_MIN_VERSION && (!only_lts || is_lts) {
                Some(version.to_string())
            } else {
                None
            }
        })
    };

    let version = select_version(true)
        .or_else(|| select_version(false))
        .ok_or_else(|| "未找到满足要求的 Node.js 官方安装包版本。".to_string())?;

    #[cfg(target_os = "windows")]
    let filename = {
        #[cfg(target_arch = "aarch64")]
        {
            format!("node-{version}-arm64.msi")
        }
        #[cfg(not(target_arch = "aarch64"))]
        {
            format!("node-{version}-x64.msi")
        }
    };

    #[cfg(target_os = "macos")]
    let filename = format!("node-{version}.pkg");

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let filename = String::new();

    if filename.is_empty() {
        return Err("当前平台暂不支持自动下载官方 Node.js 安装器。".to_string());
    }

    Ok(InstallerAsset {
        download_url: format!("https://nodejs.org/dist/{version}/{filename}"),
        filename,
    })
}

pub(crate) async fn download_installer_asset(
    app: &AppHandle,
    asset: &InstallerAsset,
) -> Result<PathBuf, String> {
    let download_dir = openclaw_installer_download_dir(app)?;
    let installer_path = download_dir.join(&asset.filename);
    if installer_path.exists() {
        let _ = std::fs::remove_file(&installer_path);
    }

    emit_install_progress(
        app,
        &format!("开始下载安装器：{}", asset.download_url),
        "info",
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&asset.download_url)
        .header("User-Agent", OPENCLAW_INSTALLER_USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("下载官方安装器失败: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("下载安装器失败: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取安装器文件失败: {e}"))?;
    std::fs::write(&installer_path, bytes)
        .map_err(|e| format!("保存安装器失败({}): {e}", installer_path.display()))?;

    emit_install_progress(
        app,
        &format!("安装器已保存到：{}", installer_path.display()),
        "info",
    );

    Ok(installer_path)
}

pub(crate) fn launch_installer(file_path: &Path) -> Result<(), String> {
    let extension = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "exe" => {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new(file_path)
                    .spawn()
                    .map_err(|e| format!("启动安装程序失败: {e}"))?;
            }

            #[cfg(not(target_os = "windows"))]
            {
                return Err("EXE 安装器只能在 Windows 上运行。".to_string());
            }
        }
        "msi" => {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("msiexec")
                    .arg("/i")
                    .arg(file_path)
                    .spawn()
                    .map_err(|e| format!("启动 MSI 安装程序失败: {e}"))?;
            }

            #[cfg(not(target_os = "windows"))]
            {
                return Err("MSI 安装器只能在 Windows 上运行。".to_string());
            }
        }
        "pkg" | "dmg" => {
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .arg(file_path)
                    .spawn()
                    .map_err(|e| format!("打开 macOS 安装器失败: {e}"))?;
            }

            #[cfg(not(target_os = "macos"))]
            {
                return Err("该安装器只能在 macOS 上运行。".to_string());
            }
        }
        _ => return Err(format!("不支持的安装器文件类型: {extension}")),
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub(crate) async fn trigger_macos_command_line_tools_install() -> Result<String, String> {
    let output = Command::new("/usr/bin/xcode-select")
        .arg("--install")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("拉起 macOS 开发者工具安装器失败: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = if !stderr.is_empty() { stderr } else { stdout };
    let lower = combined.to_ascii_lowercase();

    if output.status.success()
        || lower.contains("install requested")
        || lower.contains("already been requested")
    {
        return Ok("已拉起 macOS 开发者工具安装器。".to_string());
    }

    if lower.contains("already installed") {
        return Err(
            "系统提示 Command Line Tools 已安装，但当前仍未检测到 Git，请先执行系统更新或安装 Homebrew 后重试。"
                .to_string(),
        );
    }

    Err(format!("拉起 macOS 开发者工具安装器失败: {combined}"))
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
pub(crate) async fn trigger_macos_command_line_tools_install() -> Result<String, String> {
    Err("当前平台不支持拉起 macOS 开发者工具安装器。".to_string())
}
