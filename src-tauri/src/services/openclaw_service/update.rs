use super::*;

impl OpenClawService {
    pub async fn check_update(&self) -> Result<UpdateInfo, String> {
        let Some(openclaw_command) = resolve_openclaw_command().await? else {
            return Ok(UpdateInfo {
                has_update: false,
                current_version: None,
                latest_version: None,
                channel: None,
                install_kind: None,
                package_manager: None,
                message: Some("未检测到 OpenClaw 可执行文件，请先安装。".to_string()),
            });
        };

        let current_version = self
            .read_openclaw_version()
            .await?
            .and_then(|value| parse_openclaw_release_version(&value).or(Some(value)));

        let payload = match read_openclaw_update_status_payload(&openclaw_command).await {
            Ok(payload) => payload,
            Err(message) => {
                return Ok(UpdateInfo {
                    has_update: false,
                    current_version,
                    latest_version: None,
                    channel: None,
                    install_kind: None,
                    package_manager: None,
                    message: Some(message),
                });
            }
        };

        Ok(UpdateInfo {
            has_update: payload
                .pointer("/availability/available")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            current_version,
            latest_version: payload
                .pointer("/availability/latestVersion")
                .and_then(Value::as_str)
                .map(str::to_string),
            channel: payload
                .pointer("/channel/label")
                .or_else(|| payload.pointer("/channel/value"))
                .and_then(Value::as_str)
                .map(str::to_string),
            install_kind: payload
                .pointer("/update/installKind")
                .and_then(Value::as_str)
                .map(str::to_string),
            package_manager: payload
                .pointer("/update/packageManager")
                .and_then(Value::as_str)
                .map(str::to_string),
            message: payload
                .pointer("/update/registry/error")
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    }

    pub async fn perform_update(&mut self, app: &AppHandle) -> Result<ActionResult, String> {
        emit_install_progress(app, "开始执行 OpenClaw 升级。", "info");

        let Some(openclaw_command) = resolve_openclaw_command().await? else {
            return Ok(ActionResult {
                success: false,
                message: "未检测到 OpenClaw 可执行文件，请先安装。".to_string(),
            });
        };
        let current_runtime_bin_dir = openclaw_command
            .command_path()
            .parent()
            .map(Path::to_path_buf);

        self.refresh_process_state().await?;
        let gateway_was_running = self.gateway_status == GatewayStatus::Running;
        if self.gateway_status == GatewayStatus::Running {
            emit_install_progress(
                app,
                "升级前先停止 Gateway，避免占用正在运行的 OpenClaw。",
                "info",
            );
            let stop_result = self.stop_gateway(Some(app)).await?;
            if !stop_result.success {
                return Ok(stop_result);
            }
        }

        if let Some(current_version) = self
            .read_openclaw_version()
            .await
            .ok()
            .flatten()
            .and_then(|value| parse_openclaw_release_version(&value).or(Some(value)))
        {
            emit_install_progress(
                app,
                &format!("当前版本 {current_version}，开始执行升级命令。"),
                "info",
            );
        }

        let update_status_payload =
            match read_openclaw_update_status_payload(&openclaw_command).await {
                Ok(payload) => payload,
                Err(message) => {
                    emit_install_progress(app, &message, "warn");
                    match attempt_direct_openclaw_package_upgrade(
                        app,
                        current_runtime_bin_dir.as_deref(),
                        None,
                        None,
                    )
                    .await
                    {
                        Ok(result) => {
                            set_preferred_runtime_bin_dir(Some(result.runtime_bin_dir.clone()));
                            emit_install_progress(
                                app,
                                &format!(
                                    "已自动切换后续执行环境到 {}。",
                                    result.runtime_bin_dir.display()
                                ),
                                "info",
                            );
                            return self
                                .finalize_successful_openclaw_update(
                                    app,
                                    gateway_was_running,
                                    Some(format!(
                                        "OpenClaw 已通过 {} 的 {} 全局升级完成（{}）。",
                                        result.runtime_source,
                                        result.package_manager,
                                        result.package_spec
                                    )),
                                )
                                .await;
                        }
                        Err(fallback_error) => {
                            emit_install_progress(app, &fallback_error, "error");
                            return Ok(ActionResult {
                                success: false,
                                message,
                            });
                        }
                    }
                }
            };
        let update_context = extract_openclaw_update_execution_context(&update_status_payload);
        if let Some(root) = update_context.root.as_ref().filter(|root| root.is_dir()) {
            emit_install_progress(
                app,
                &format!("已切换到 OpenClaw 安装根目录执行升级：{}", root.display()),
                "info",
            );
        }
        if let Some(install_kind) = update_context.install_kind.as_deref() {
            let package_manager = update_context
                .package_manager
                .as_deref()
                .unwrap_or("默认包管理器");
            emit_install_progress(
                app,
                &format!("检测到安装方式：{install_kind}（包管理器：{package_manager}）。"),
                "info",
            );
        }

        let mut command = openclaw_command.build_command_with_args(["update", "--yes", "--json"]);
        if let Some(root) = update_context.root.as_ref().filter(|root| root.is_dir()) {
            command.current_dir(root);
        }
        let output = command
            .env(OPENCLAW_CONFIG_ENV, openclaw_lime_config_path())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("执行 OpenClaw 升级失败: {e}"))?;

        let stdout_lines = command_output_lines(&output.stdout);
        for line in &stdout_lines {
            emit_install_progress(app, &line, classify_progress_level(&line, "info"));
        }
        let stderr_lines = command_output_lines(&output.stderr);
        for line in &stderr_lines {
            emit_install_progress(app, line, classify_progress_level(line, "warn"));
        }
        let stdout_payload = serde_json::from_slice::<Value>(&output.stdout).ok();

        if !output.status.success() {
            let failure_detail = select_openclaw_update_failure_detail(
                stdout_payload.as_ref(),
                &stderr_lines,
                &stdout_lines,
            );
            let message = format_openclaw_update_failure_message(failure_detail.as_deref());
            emit_install_progress(app, &message, "warn");

            match attempt_direct_openclaw_package_upgrade(
                app,
                current_runtime_bin_dir.as_deref(),
                update_context.root.as_deref(),
                update_context.package_manager.as_deref(),
            )
            .await
            {
                Ok(result) => {
                    set_preferred_runtime_bin_dir(Some(result.runtime_bin_dir.clone()));
                    emit_install_progress(
                        app,
                        &format!(
                            "已自动切换后续执行环境到 {}。",
                            result.runtime_bin_dir.display()
                        ),
                        "info",
                    );
                    return self
                        .finalize_successful_openclaw_update(
                            app,
                            gateway_was_running,
                            Some(format!(
                                "OpenClaw 已通过 {} 的 {} 全局升级完成（{}）。",
                                result.runtime_source, result.package_manager, result.package_spec
                            )),
                        )
                        .await;
                }
                Err(fallback_error) => {
                    emit_install_progress(app, &fallback_error, "error");
                    return Ok(ActionResult {
                        success: false,
                        message,
                    });
                }
            }
        }

        self.finalize_successful_openclaw_update(app, gateway_was_running, None)
            .await
    }

    async fn finalize_successful_openclaw_update(
        &mut self,
        app: &AppHandle,
        gateway_was_running: bool,
        success_message_override: Option<String>,
    ) -> Result<ActionResult, String> {
        self.refresh_process_state().await?;
        let updated_version = self
            .read_openclaw_version()
            .await
            .ok()
            .flatten()
            .and_then(|value| parse_openclaw_release_version(&value).or(Some(value)));

        if gateway_was_running {
            emit_install_progress(app, "升级前 Gateway 处于运行态，开始自动恢复服务。", "info");
            let restart_result = self
                .start_gateway(Some(app), Some(self.gateway_port))
                .await?;
            if !restart_result.success {
                return Ok(restart_result);
            }
        }

        let message = success_message_override.unwrap_or_else(|| {
            updated_version
                .as_ref()
                .map(|version| format!("OpenClaw 已升级完成，当前版本 {version}。"))
                .unwrap_or_else(|| "OpenClaw 已升级完成。".to_string())
        });
        emit_install_progress(app, &message, "info");
        Ok(ActionResult {
            success: true,
            message,
        })
    }
}

pub(crate) fn parse_openclaw_release_version(value: &str) -> Option<String> {
    static VERSION_RE: OnceLock<Regex> = OnceLock::new();
    VERSION_RE
        .get_or_init(|| Regex::new(r"(?i)openclaw\s+([0-9]+(?:\.[0-9]+)+)").expect("valid regex"))
        .captures(value)
        .and_then(|captures| captures.get(1).map(|value| value.as_str().to_string()))
}

pub(crate) async fn read_openclaw_update_status_payload(
    command_spec: &ResolvedOpenClawCommand,
) -> Result<Value, String> {
    let mut command = command_spec.build_command_with_args(["update", "status", "--json"]);
    let output = command
        .env(OPENCLAW_CONFIG_ENV, openclaw_lime_config_path())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("检查 OpenClaw 更新失败: {e}"))?;

    let stdout_lines = command_output_lines(&output.stdout);
    let stderr_lines = command_output_lines(&output.stderr);
    let payload = serde_json::from_slice::<Value>(&output.stdout).map_err(|error| {
        let detail = select_openclaw_update_failure_detail(None, &stderr_lines, &stdout_lines)
            .unwrap_or_else(|| format!("解析更新状态失败: {error}"));
        format_openclaw_update_failure_message(Some(detail.as_str()))
    })?;

    if !output.status.success() {
        let detail =
            select_openclaw_update_failure_detail(Some(&payload), &stderr_lines, &stdout_lines);
        return Err(format_openclaw_update_failure_message(detail.as_deref()));
    }

    Ok(payload)
}

pub(crate) fn extract_openclaw_update_execution_context(
    payload: &Value,
) -> OpenClawUpdateExecutionContext {
    OpenClawUpdateExecutionContext {
        root: payload
            .pointer("/update/root")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from),
        install_kind: payload
            .pointer("/update/installKind")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        package_manager: payload
            .pointer("/update/packageManager")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
    }
}

pub(crate) fn select_openclaw_update_failure_detail(
    payload: Option<&Value>,
    stderr_lines: &[String],
    stdout_lines: &[String],
) -> Option<String> {
    if let Some(payload) = payload {
        if let Some(reason) = payload.get("reason").and_then(Value::as_str) {
            let root_suffix = payload
                .get("root")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|root| format!(" ({root})"))
                .unwrap_or_default();
            return Some(format!("{reason}{root_suffix}"));
        }

        if let Some(message) = payload.get("message").and_then(Value::as_str) {
            let trimmed = message.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }

        if let Some(message) = payload
            .pointer("/update/registry/error")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Some(message.to_string());
        }
    }

    stderr_lines
        .iter()
        .chain(stdout_lines.iter())
        .filter_map(|line| {
            let trimmed = line.trim();
            let score = openclaw_update_failure_line_score(trimmed);
            (score > 0).then_some((score, trimmed))
        })
        .max_by_key(|(score, _)| *score)
        .map(|(_, line)| line.to_string())
}

pub(crate) fn openclaw_update_failure_line_score(line: &str) -> u8 {
    if line.is_empty() {
        return 0;
    }

    let normalized = line.to_ascii_lowercase();
    if normalized.starts_with("updating openclaw")
        || normalized.starts_with("update result")
        || normalized.starts_with("total time")
        || normalized.starts_with("root:")
    {
        return 0;
    }

    if normalized.contains("not-openclaw-root") {
        return 100;
    }

    if normalized.contains("node.js") && normalized.contains("required") {
        return 95;
    }

    if normalized.contains("fetch failed") || normalized.contains("network") {
        return 90;
    }

    if normalized.contains("pnpm") && normalized.contains("not found")
        || normalized.contains("npm") && normalized.contains("not found")
    {
        return 85;
    }

    if normalized.contains("already up to date") || normalized.contains("not modified") {
        return 80;
    }

    if normalized.starts_with("reason:") {
        return 70;
    }

    20
}

pub(crate) fn format_openclaw_update_failure_message(detail: Option<&str>) -> String {
    let Some(detail) = detail.map(str::trim).filter(|value| !value.is_empty()) else {
        return "OpenClaw 升级失败，请查看日志输出。".to_string();
    };

    let normalized = detail.to_ascii_lowercase();
    if normalized.contains("not-openclaw-root") {
        return "OpenClaw 升级失败：未在 OpenClaw 安装根目录执行更新。Lime 会优先切换到安装目录；如仍失败，请重新检测安装状态后重试。"
            .to_string();
    }

    if normalized.contains("node.js") && normalized.contains("required") {
        return format!(
            "OpenClaw 升级失败：当前用于执行 openclaw 的 Node.js 版本过低，需要 {}+。请切换到满足要求的 Node.js 后重试。",
            format_semver(NODE_MIN_VERSION)
        );
    }

    if normalized.contains("fetch failed") || normalized.contains("network") {
        return "OpenClaw 升级失败：当前无法访问更新源，请检查网络或代理设置后重试。".to_string();
    }

    if normalized.contains("not modified") || normalized.contains("already up to date") {
        return "OpenClaw 当前已经是最新版本，无需升级。".to_string();
    }

    if normalized.contains("pnpm") && normalized.contains("not found") {
        return "OpenClaw 升级失败：当前安装方式依赖 pnpm，但系统未找到 pnpm。请先修复 Node.js / pnpm 环境后重试。"
            .to_string();
    }

    if normalized.contains("npm") && normalized.contains("not found") {
        return "OpenClaw 升级失败：当前安装方式依赖 npm，但系统未找到 npm。请先修复 Node.js / npm 环境后重试。"
            .to_string();
    }

    format!("OpenClaw 升级失败：{detail}")
}

pub(crate) async fn attempt_direct_openclaw_package_upgrade(
    app: &AppHandle,
    runtime_bin_dir_hint: Option<&Path>,
    install_root_hint: Option<&Path>,
    package_manager_hint: Option<&str>,
) -> Result<OpenClawDirectUpgradeResult, String> {
    let mut runtime_candidates = list_openclaw_runtime_candidates().await?;
    runtime_candidates.sort_by(|left, right| {
        let left_matches_root = install_root_hint
            .map(|root| runtime_candidate_matches_install_root(left, root))
            .unwrap_or(false);
        let right_matches_root = install_root_hint
            .map(|root| runtime_candidate_matches_install_root(right, root))
            .unwrap_or(false);
        let left_matches_bin = runtime_bin_dir_hint
            .map(|hint| Path::new(&left.bin_dir) == hint)
            .unwrap_or(false);
        let right_matches_bin = runtime_bin_dir_hint
            .map(|hint| Path::new(&right.bin_dir) == hint)
            .unwrap_or(false);

        right_matches_root
            .cmp(&left_matches_root)
            .then_with(|| right_matches_bin.cmp(&left_matches_bin))
            .then_with(|| compare_openclaw_runtime_candidates(left, right))
    });
    let mut last_error = None;
    let mut attempted = 0usize;

    if let Some(install_root_hint) = install_root_hint {
        emit_install_progress(
            app,
            &format!(
                "官方 updater 报告的安装根目录为 {}，将优先匹配该安装来源执行兜底升级。",
                install_root_hint.display()
            ),
            "info",
        );
    }

    for candidate in runtime_candidates {
        let Some(plan) = resolve_direct_openclaw_upgrade_plan(
            app,
            &candidate,
            runtime_bin_dir_hint,
            install_root_hint,
            package_manager_hint,
        )
        .await?
        else {
            continue;
        };

        attempted += 1;
        emit_install_progress(
            app,
            &format!(
                "官方自更新未能完成，开始尝试全局包升级兜底：{} · {}。",
                plan.runtime_source, plan.package_manager
            ),
            "warn",
        );
        emit_install_progress(
            app,
            &format!("目标执行环境：{}", plan.runtime_bin_dir.display()),
            "info",
        );
        emit_install_progress(app, &format!("升级包：{}", plan.package_spec), "info");

        let result = run_shell_command_with_progress(app, &plan.command_line).await?;
        if result.success {
            emit_install_progress(
                app,
                &format!(
                    "已通过 {} 的 {} 全局安装方式完成兜底升级。",
                    plan.runtime_source, plan.package_manager
                ),
                "info",
            );
            return Ok(OpenClawDirectUpgradeResult {
                runtime_source: plan.runtime_source,
                runtime_bin_dir: plan.runtime_bin_dir,
                package_manager: plan.package_manager,
                package_spec: plan.package_spec,
            });
        }

        emit_install_progress(
            app,
            &format!(
                "全局包升级兜底失败：{} · {}。",
                plan.runtime_source, result.message
            ),
            "warn",
        );
        last_error = Some(result.message);
    }

    if attempted == 0 {
        return Err("未检测到可用于全局升级的 OpenClaw 安装来源。".to_string());
    }

    Err(last_error.unwrap_or_else(|| "已自动尝试全局升级兜底，但仍未成功。".to_string()))
}

pub(crate) async fn resolve_direct_openclaw_upgrade_plan(
    app: &AppHandle,
    candidate: &OpenClawRuntimeCandidate,
    runtime_bin_dir_hint: Option<&Path>,
    install_root_hint: Option<&Path>,
    package_manager_hint: Option<&str>,
) -> Result<Option<OpenClawDirectUpgradePlan>, String> {
    let runtime_bin_dir = PathBuf::from(&candidate.bin_dir);
    let runtime_matches_hint = runtime_bin_dir_hint
        .map(|hint| hint == runtime_bin_dir.as_path())
        .unwrap_or(false);
    let runtime_matches_install_root = install_root_hint
        .map(|root| runtime_candidate_matches_install_root(candidate, root))
        .unwrap_or(false);

    if runtime_bin_dir_hint.is_some()
        && !runtime_matches_hint
        && !runtime_matches_install_root
        && candidate.openclaw_path.is_none()
        && candidate.openclaw_package_path.is_none()
    {
        return Ok(None);
    }

    if candidate.openclaw_path.is_none() && candidate.openclaw_package_path.is_none() {
        return Ok(None);
    }

    let package_spec = resolve_openclaw_upgrade_package_spec(app, candidate).await?;
    let registry = package_registry_for_package_spec(&package_spec);
    let package_manager_hint = package_manager_hint
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let npm_path = candidate
        .npm_path
        .as_deref()
        .map(PathBuf::from)
        .or_else(|| find_command_in_bin_dir("npm", &runtime_bin_dir));
    let pnpm_path = find_command_in_bin_dir("pnpm", &runtime_bin_dir);
    let shell_platform = current_shell_platform();

    let (package_manager, command_line) = match package_manager_hint.as_deref() {
        Some("pnpm") => {
            if let Some(pnpm_path) = pnpm_path.as_ref().and_then(|path| path.to_str()) {
                (
                    "pnpm".to_string(),
                    build_openclaw_pnpm_install_command(
                        shell_platform,
                        pnpm_path,
                        &package_spec,
                        registry,
                    ),
                )
            } else if let Some(npm_path) = npm_path.as_ref().and_then(|path| path.to_str()) {
                (
                    "npm".to_string(),
                    build_openclaw_install_command(
                        shell_platform,
                        npm_path,
                        candidate.npm_global_prefix.as_deref(),
                        &package_spec,
                        registry,
                    ),
                )
            } else {
                return Ok(None);
            }
        }
        _ => {
            if let Some(npm_path) = npm_path.as_ref().and_then(|path| path.to_str()) {
                (
                    "npm".to_string(),
                    build_openclaw_install_command(
                        shell_platform,
                        npm_path,
                        candidate.npm_global_prefix.as_deref(),
                        &package_spec,
                        registry,
                    ),
                )
            } else if let Some(pnpm_path) = pnpm_path.as_ref().and_then(|path| path.to_str()) {
                (
                    "pnpm".to_string(),
                    build_openclaw_pnpm_install_command(
                        shell_platform,
                        pnpm_path,
                        &package_spec,
                        registry,
                    ),
                )
            } else {
                return Ok(None);
            }
        }
    };

    Ok(Some(OpenClawDirectUpgradePlan {
        runtime_source: candidate.source.clone(),
        runtime_bin_dir,
        package_manager,
        package_spec,
        command_line,
    }))
}

pub(crate) async fn resolve_openclaw_upgrade_package_spec(
    app: &AppHandle,
    candidate: &OpenClawRuntimeCandidate,
) -> Result<String, String> {
    if let Some(prefix) = candidate.npm_global_prefix.as_deref() {
        if let Some(package) = find_installed_openclaw_package_details(prefix) {
            return Ok(format!("{}@latest", package.name));
        }
    }

    if let Some(package_path) = candidate.openclaw_package_path.as_deref() {
        if let Some(package_name) = infer_openclaw_package_name_from_path(Path::new(package_path)) {
            return Ok(format!("{package_name}@latest"));
        }
    }

    Ok(if should_use_china_package(app).await {
        OPENCLAW_CN_PACKAGE.to_string()
    } else {
        OPENCLAW_DEFAULT_PACKAGE.to_string()
    })
}

pub(crate) fn infer_openclaw_package_name_from_path(path: &Path) -> Option<&'static str> {
    let normalized = path
        .display()
        .to_string()
        .replace('\\', "/")
        .to_ascii_lowercase();
    if normalized.contains("@qingchencloud/openclaw-zh") {
        return Some("@qingchencloud/openclaw-zh");
    }
    if normalized.contains("/openclaw/package.json") {
        return Some("openclaw");
    }
    None
}

pub(crate) fn package_registry_for_package_spec(package_spec: &str) -> Option<&'static str> {
    package_spec
        .starts_with("@qingchencloud/openclaw-zh@")
        .then_some(NPM_MIRROR_CN)
}

pub(crate) fn runtime_candidate_matches_install_root(
    candidate: &OpenClawRuntimeCandidate,
    install_root_hint: &Path,
) -> bool {
    [
        Some(candidate.bin_dir.as_str()),
        Some(candidate.node_path.as_str()),
        candidate.npm_path.as_deref(),
        candidate.npm_global_prefix.as_deref(),
        candidate.openclaw_path.as_deref(),
        candidate.openclaw_package_path.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(PathBuf::from)
    .any(|path| path.starts_with(install_root_hint))
}
