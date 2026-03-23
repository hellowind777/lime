use super::*;

impl OpenClawService {
    pub async fn start_gateway(
        &mut self,
        app: Option<&AppHandle>,
        port: Option<u16>,
    ) -> Result<ActionResult, String> {
        if let Some(next_port) = port {
            self.gateway_port = next_port.max(1);
        }

        if let Some(app) = app {
            emit_install_progress(
                app,
                &format!("准备启动 Gateway，目标端口 {}。", self.gateway_port),
                "info",
            );
        }

        self.ensure_runtime_config(None, None)?;
        self.refresh_process_state().await?;

        if self.gateway_status == GatewayStatus::Running {
            if let Some(app) = app {
                emit_install_progress(
                    app,
                    &format!("检测到 Gateway 已在端口 {} 运行。", self.gateway_port),
                    "info",
                );
            }
            return Ok(ActionResult {
                success: true,
                message: format!("Gateway 已在端口 {} 运行", self.gateway_port),
            });
        }

        let Some(openclaw_command) = resolve_openclaw_command().await? else {
            self.gateway_status = GatewayStatus::Error;
            if let Some(app) = app {
                emit_install_progress(app, "未检测到 OpenClaw 可执行文件，请先安装。", "error");
            }
            return Ok(ActionResult {
                success: false,
                message: "未检测到 OpenClaw 可执行文件，请先安装。".to_string(),
            });
        };

        self.gateway_status = GatewayStatus::Starting;

        let config_path = openclaw_lime_config_path();
        if let Some(app) = app {
            emit_install_progress(
                app,
                &format!("使用配置文件启动 Gateway: {}", config_path.display()),
                "info",
            );
        }
        let start_args = gateway_start_args(self.gateway_port, &self.gateway_auth_token);
        let mut command = openclaw_command.build_command_with_args(&start_args);
        command
            .env(OPENCLAW_CONFIG_ENV, &config_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|e| format!("启动 Gateway 失败: {e}"))?;

        let gateway_error_lines = Arc::new(StdMutex::new(Vec::<String>::new()));

        if let Some(stdout) = child.stdout.take() {
            let app = app.cloned();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    tracing::info!(target: "openclaw", "Gateway stdout: {}", line);
                    if let Some(app) = app.as_ref() {
                        emit_install_progress(app, &line, classify_progress_level(&line, "info"));
                    }
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let app = app.cloned();
            let gateway_error_lines = gateway_error_lines.clone();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    tracing::warn!(target: "openclaw", "Gateway stderr: {}", line);
                    if let Ok(mut slot) = gateway_error_lines.lock() {
                        push_gateway_error_line(&mut slot, &line);
                    }
                    if let Some(app) = app.as_ref() {
                        emit_install_progress(app, &line, classify_progress_level(&line, "warn"));
                    }
                }
            });
        }

        self.gateway_process = Some(child);
        self.gateway_started_at = Some(SystemTime::now());

        if let Some(app) = app {
            emit_install_progress(app, "Gateway 进程已拉起，等待服务就绪。", "info");
        }

        let start_at = tokio::time::Instant::now();
        while start_at.elapsed() < Duration::from_secs(30) {
            sleep(Duration::from_millis(300)).await;
            self.refresh_process_state().await?;
            let gateway_error_lines = gateway_error_lines
                .lock()
                .ok()
                .map(|slot| slot.clone())
                .unwrap_or_default();

            if self.gateway_process.is_none() && self.gateway_status == GatewayStatus::Error {
                let message = format_gateway_start_failure_message(
                    select_gateway_start_failure_detail(&gateway_error_lines),
                );
                if let Some(app) = app {
                    emit_install_progress(app, &message, "error");
                }
                return Ok(ActionResult {
                    success: false,
                    message,
                });
            }

            if self.gateway_status == GatewayStatus::Running {
                if let Some(app) = app {
                    emit_install_progress(
                        app,
                        &format!("Gateway 启动成功，监听端口 {}。", self.gateway_port),
                        "info",
                    );
                }
                return Ok(ActionResult {
                    success: true,
                    message: format!("Gateway 已启动，端口 {}", self.gateway_port),
                });
            }

            if self.check_port_open().await {
                self.gateway_status = GatewayStatus::Running;
                if let Some(app) = app {
                    emit_install_progress(
                        app,
                        &format!("Gateway 探测成功，监听端口 {}。", self.gateway_port),
                        "info",
                    );
                }
                return Ok(ActionResult {
                    success: true,
                    message: format!("Gateway 已启动，端口 {}", self.gateway_port),
                });
            }
        }

        self.gateway_status = GatewayStatus::Error;
        let gateway_error_lines = gateway_error_lines
            .lock()
            .ok()
            .map(|slot| slot.clone())
            .unwrap_or_default();
        let message = format_gateway_start_failure_message(select_gateway_start_failure_detail(
            &gateway_error_lines,
        ));
        if let Some(app) = app {
            emit_install_progress(app, &message, "error");
        }
        Ok(ActionResult {
            success: false,
            message,
        })
    }

    pub async fn stop_gateway(&mut self, app: Option<&AppHandle>) -> Result<ActionResult, String> {
        if let Some(app) = app {
            emit_install_progress(app, "准备停止 Gateway。", "info");
        }

        self.restore_auth_token_from_config();

        if let Some(mut child) = self.gateway_process.take() {
            if let Some(app) = app {
                emit_install_progress(app, "正在终止当前托管的 Gateway 子进程。", "info");
            }
            let _ = child.kill().await;
            let _ = timeout(Duration::from_secs(3), child.wait()).await;
        }

        if self
            .wait_for_gateway_shutdown(Duration::from_secs(3))
            .await?
        {
            if let Some(app) = app {
                emit_install_progress(app, "Gateway 已停止。", "info");
            }
            return Ok(ActionResult {
                success: true,
                message: "Gateway 已停止。".to_string(),
            });
        }

        let stop_commands = self.collect_gateway_stop_commands().await?;
        if stop_commands.is_empty() {
            if let Some(app) = app {
                emit_install_progress(
                    app,
                    "未检测到可用的 OpenClaw 停止命令，将尝试按端口回收旧 Gateway。",
                    "warn",
                );
            }
        } else {
            for command_spec in &stop_commands {
                self.request_gateway_stop_via_command(command_spec, app)
                    .await;
                if self
                    .wait_for_gateway_shutdown(Duration::from_secs(4))
                    .await?
                {
                    if let Some(app) = app {
                        emit_install_progress(app, "Gateway 已停止。", "info");
                    }
                    return Ok(ActionResult {
                        success: true,
                        message: "Gateway 已停止。".to_string(),
                    });
                }
            }
        }

        let reclaimed_by_pid = self.force_stop_gateway_listener_processes(app).await?;
        if reclaimed_by_pid
            && self
                .wait_for_gateway_shutdown(Duration::from_secs(5))
                .await?
        {
            if let Some(app) = app {
                emit_install_progress(app, "Gateway 已停止。", "info");
            }
            return Ok(ActionResult {
                success: true,
                message: "Gateway 已停止。".to_string(),
            });
        }

        self.refresh_process_state().await?;
        let message = if self.check_port_open().await {
            format!(
                "Gateway 停止失败：端口 {} 仍被旧进程占用，升级已中止。请使用“立即重启生效”或结束旧 OpenClaw 进程后重试。",
                self.gateway_port
            )
        } else {
            "Gateway 停止流程已结束，但未能确认运行态完全退出，请重试。".to_string()
        };

        if let Some(app) = app {
            emit_install_progress(app, &message, "error");
        }

        Ok(ActionResult {
            success: false,
            message,
        })
    }

    pub async fn restart_gateway(&mut self, app: &AppHandle) -> Result<ActionResult, String> {
        emit_install_progress(app, "开始重启 Gateway。", "info");
        let stop_result = self.stop_gateway(Some(app)).await?;
        if !stop_result.success {
            return Ok(stop_result);
        }
        emit_install_progress(app, "Gateway 停止阶段结束，开始重新启动。", "info");
        self.start_gateway(Some(app), Some(self.gateway_port)).await
    }

    pub async fn get_status(&mut self) -> Result<GatewayStatusInfo, String> {
        self.refresh_process_state().await?;
        Ok(GatewayStatusInfo {
            status: self.gateway_status.clone(),
            port: self.gateway_port,
        })
    }

    pub async fn check_health(&mut self) -> Result<HealthInfo, String> {
        self.refresh_process_state().await?;

        self.restore_auth_token_from_config();

        let health_snapshot = self.fetch_authenticated_gateway_health_json().await;
        let healthy = self.gateway_status == GatewayStatus::Running
            && self.check_port_open().await
            && health_snapshot
                .as_ref()
                .and_then(|value| value.get("ok").and_then(Value::as_bool))
                .unwrap_or(false);
        let version = self.read_openclaw_version().await.ok().flatten();
        let uptime = self.gateway_started_at.and_then(|start| {
            SystemTime::now()
                .duration_since(start)
                .ok()
                .map(|elapsed| elapsed.as_secs())
        });

        Ok(HealthInfo {
            status: if healthy { "healthy" } else { "unhealthy" }.to_string(),
            gateway_port: self.gateway_port,
            uptime,
            version,
        })
    }

    pub fn get_dashboard_url(&mut self) -> String {
        self.restore_auth_token_from_config();
        let mut url = format!("http://127.0.0.1:{}", self.gateway_port);
        if !self.gateway_auth_token.is_empty() {
            url.push_str(&format!(
                "/#token={}",
                urlencoding::encode(&self.gateway_auth_token)
            ));
        }
        url
    }

    pub async fn get_channels(&mut self) -> Result<Vec<ChannelInfo>, String> {
        self.refresh_process_state().await?;
        if self.gateway_status != GatewayStatus::Running {
            return Ok(Vec::new());
        }

        self.restore_auth_token_from_config();

        let Some(body) = self.fetch_authenticated_gateway_health_json().await else {
            return Ok(Vec::new());
        };

        let channels_map = body
            .get("channels")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let labels = body
            .get("channelLabels")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let ordered_ids = body
            .get("channelOrder")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let mut ordered = Vec::new();
        for channel_id in ordered_ids.iter().filter_map(Value::as_str) {
            if let Some(entry) = channels_map.get(channel_id) {
                ordered.push(build_channel_info(
                    channel_id,
                    entry,
                    labels.get(channel_id),
                ));
            }
        }

        if ordered.is_empty() {
            ordered = channels_map
                .iter()
                .map(|(channel_id, entry)| {
                    build_channel_info(channel_id, entry, labels.get(channel_id))
                })
                .collect();
        }

        Ok(ordered)
    }

    async fn wait_for_gateway_shutdown(&mut self, max_wait: Duration) -> Result<bool, String> {
        let start_at = tokio::time::Instant::now();
        while start_at.elapsed() < max_wait {
            self.refresh_process_state().await?;
            if !self.check_port_open().await {
                self.clear_gateway_runtime_state();
                return Ok(true);
            }
            sleep(Duration::from_millis(250)).await;
        }

        self.refresh_process_state().await?;
        if !self.check_port_open().await {
            self.clear_gateway_runtime_state();
            return Ok(true);
        }

        Ok(false)
    }

    async fn collect_gateway_stop_commands(&self) -> Result<Vec<ResolvedOpenClawCommand>, String> {
        let mut commands = Vec::new();

        if let Some(command) = resolve_openclaw_command().await? {
            commands.push(command);
        }

        let mut runtime_candidates = list_openclaw_runtime_candidates().await?;
        runtime_candidates.sort_by(compare_openclaw_runtime_candidates);
        commands.extend(
            runtime_candidates
                .iter()
                .filter_map(resolve_openclaw_command_from_runtime_candidate),
        );

        Ok(dedupe_openclaw_commands(commands))
    }

    async fn request_gateway_stop_via_command(
        &self,
        command_spec: &ResolvedOpenClawCommand,
        app: Option<&AppHandle>,
    ) {
        let binary_label = command_spec.invocation_display();
        if let Some(app) = app {
            emit_install_progress(
                app,
                &format!("尝试通过 {} 停止 Gateway。", binary_label),
                "info",
            );
        }

        let stop_args = vec![
            "gateway".to_string(),
            "stop".to_string(),
            "--url".to_string(),
            self.gateway_ws_url(),
            "--token".to_string(),
            self.gateway_auth_token.clone(),
        ];
        let mut command = command_spec.build_command_with_args(&stop_args);
        let output = timeout(
            Duration::from_secs(8),
            command
                .env(OPENCLAW_CONFIG_ENV, openclaw_lime_config_path())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output(),
        )
        .await;

        match output {
            Ok(Ok(result)) => {
                for line in command_output_lines(&result.stdout) {
                    if let Some(app) = app {
                        emit_install_progress(app, &line, classify_progress_level(&line, "info"));
                    }
                }
                for line in command_output_lines(&result.stderr) {
                    if let Some(app) = app {
                        emit_install_progress(app, &line, classify_progress_level(&line, "warn"));
                    }
                }

                if let Some(app) = app {
                    if result.status.success() {
                        emit_install_progress(app, "已发送 Gateway 停止命令。", "info");
                    } else {
                        emit_install_progress(
                            app,
                            &format!("Gateway 停止命令返回异常状态: {:?}", result.status.code()),
                            "warn",
                        );
                    }
                }
            }
            Ok(Err(error)) => {
                if let Some(app) = app {
                    emit_install_progress(
                        app,
                        &format!("执行 Gateway 停止命令失败: {error}"),
                        "warn",
                    );
                }
            }
            Err(_) => {
                if let Some(app) = app {
                    emit_install_progress(
                        app,
                        "Gateway 停止命令超时，继续尝试自动回收旧进程。",
                        "warn",
                    );
                }
            }
        }
    }

    async fn force_stop_gateway_listener_processes(
        &mut self,
        app: Option<&AppHandle>,
    ) -> Result<bool, String> {
        let listener_pids = collect_listening_port_pids(self.gateway_port).await;
        if listener_pids.is_empty() {
            return Ok(false);
        }

        let mut system = System::new_all();
        system.refresh_all();

        let target_pids = collect_openclaw_process_family_pids(&system, &listener_pids);
        if target_pids.is_empty() {
            if let Some(app) = app {
                emit_install_progress(
                    app,
                    &format!(
                        "检测到端口 {} 仍被占用，但监听进程不是 OpenClaw，未执行自动终止。",
                        self.gateway_port
                    ),
                    "warn",
                );
            }
            return Ok(false);
        }

        if let Some(app) = app {
            emit_install_progress(
                app,
                &format!(
                    "检测到旧 Gateway 仍占用端口 {}，准备回收进程：{}。",
                    self.gateway_port,
                    target_pids
                        .iter()
                        .map(|pid| pid.as_u32().to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
                "warn",
            );
        }

        terminate_sysinfo_processes(&mut system, &target_pids).await;
        Ok(true)
    }

    pub(crate) async fn refresh_process_state(&mut self) -> Result<(), String> {
        let mut process_exited = false;

        if let Some(child) = self.gateway_process.as_mut() {
            match child.try_wait() {
                Ok(Some(status)) => {
                    tracing::info!(target: "openclaw", "Gateway 进程已退出: {}", status);
                    process_exited = true;
                }
                Ok(None) => {}
                Err(error) => {
                    tracing::warn!(target: "openclaw", "检查 Gateway 进程状态失败: {}", error);
                    process_exited = true;
                }
            }
        }

        if process_exited {
            self.gateway_process = None;
            self.gateway_started_at = None;
        }

        let openclaw_command = resolve_openclaw_command().await?;
        let running = self.check_port_open().await
            || self.check_gateway_status(openclaw_command.as_ref()).await?;

        self.gateway_status = if running {
            GatewayStatus::Running
        } else if self.gateway_status == GatewayStatus::Starting {
            GatewayStatus::Error
        } else {
            GatewayStatus::Stopped
        };

        if !running {
            self.gateway_process = None;
            self.gateway_started_at = None;
        }

        Ok(())
    }

    async fn check_port_open(&self) -> bool {
        timeout(
            Duration::from_secs(2),
            TcpStream::connect(("127.0.0.1", self.gateway_port)),
        )
        .await
        .map(|result| result.is_ok())
        .unwrap_or(false)
    }

    async fn check_gateway_status(
        &self,
        command_spec: Option<&ResolvedOpenClawCommand>,
    ) -> Result<bool, String> {
        let Some(command_spec) = command_spec else {
            return Ok(false);
        };

        let status_args = vec![
            "gateway".to_string(),
            "status".to_string(),
            "--url".to_string(),
            self.gateway_ws_url(),
            "--token".to_string(),
            self.gateway_auth_token.clone(),
        ];
        let mut command = command_spec.build_command_with_args(&status_args);
        let output = command
            .env(OPENCLAW_CONFIG_ENV, openclaw_lime_config_path())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout).to_lowercase();
                let stderr = String::from_utf8_lossy(&result.stderr).to_lowercase();
                Ok(result.status.success()
                    && (stdout.contains("listening")
                        || stdout.contains("running")
                        || stderr.contains("listening")))
            }
            Err(_) => Ok(false),
        }
    }

    pub(crate) async fn read_openclaw_version(&self) -> Result<Option<String>, String> {
        let Some(command_spec) = resolve_openclaw_command().await? else {
            return Ok(None);
        };

        read_openclaw_version_from_command(&command_spec).await
    }

    pub(crate) fn gateway_ws_url(&self) -> String {
        format!("ws://127.0.0.1:{}", self.gateway_port)
    }

    pub(crate) fn restore_auth_token_from_config(&mut self) {
        if !self.gateway_auth_token.is_empty() {
            return;
        }

        match read_base_openclaw_config()
            .ok()
            .and_then(|config| extract_gateway_auth_token(&config))
        {
            Some(token) => {
                self.gateway_auth_token = token;
            }
            None => {
                tracing::warn!(
                    target: "openclaw",
                    "未能从 OpenClaw 配置恢复 gateway token，Dashboard 访问可能鉴权失败"
                );
            }
        }
    }

    async fn fetch_authenticated_gateway_health_json(&self) -> Option<Value> {
        if self.gateway_auth_token.is_empty() {
            return None;
        }

        let Some(command_spec) = resolve_openclaw_command().await.ok().flatten() else {
            return None;
        };

        let health_args = vec![
            "gateway".to_string(),
            "health".to_string(),
            "--url".to_string(),
            self.gateway_ws_url(),
            "--token".to_string(),
            self.gateway_auth_token.clone(),
            "--json".to_string(),
        ];
        let mut command = command_spec.build_command_with_args(&health_args);
        let output = command
            .env(OPENCLAW_CONFIG_ENV, openclaw_lime_config_path())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                serde_json::from_slice::<Value>(&output.stdout)
                    .map_err(|error| {
                        tracing::warn!(
                            target: "openclaw",
                            "解析 Gateway 官方健康检查结果失败: {}",
                            error
                        );
                        error
                    })
                    .ok()
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                tracing::warn!(
                    target: "openclaw",
                    "Gateway 官方健康检查失败: {}",
                    stderr.trim()
                );
                None
            }
            Err(error) => {
                tracing::warn!(target: "openclaw", "执行 Gateway 官方健康检查失败: {}", error);
                None
            }
        }
    }
}

pub(crate) fn gateway_start_args(gateway_port: u16, gateway_auth_token: &str) -> Vec<String> {
    vec![
        "gateway".to_string(),
        "--allow-unconfigured".to_string(),
        "--bind".to_string(),
        "loopback".to_string(),
        "--auth".to_string(),
        "token".to_string(),
        "--token".to_string(),
        gateway_auth_token.to_string(),
        "--port".to_string(),
        gateway_port.to_string(),
    ]
}

pub(crate) fn push_gateway_error_line(lines: &mut Vec<String>, line: &str) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return;
    }

    if lines.len() >= 32 {
        lines.remove(0);
    }
    lines.push(trimmed.to_string());
}

pub(crate) fn select_gateway_start_failure_detail<'a>(lines: &'a [String]) -> Option<&'a str> {
    lines
        .iter()
        .filter_map(|line| {
            let trimmed = line.trim();
            let score = gateway_failure_line_score(trimmed);
            (score > 0).then_some((score, trimmed))
        })
        .max_by_key(|(score, _)| *score)
        .map(|(_, line)| line)
}

pub(crate) fn gateway_failure_line_score(line: &str) -> u8 {
    if line.is_empty() {
        return 0;
    }

    let normalized = line.to_ascii_lowercase();
    if normalized.starts_with("run: openclaw doctor")
        || normalized == "config invalid"
        || normalized.starts_with("file:")
        || normalized == "problem:"
    {
        return 0;
    }

    if normalized.contains("invalid config") {
        return 100;
    }

    if normalized.contains("contextwindow") && normalized.contains("received null") {
        return 95;
    }

    if normalized.contains("address already in use")
        || normalized.contains("eaddrinuse")
        || normalized.contains("resolved to non-loopback host")
    {
        return 90;
    }

    if normalized.contains("missing config")
        || normalized.contains("gateway.mode=local")
        || normalized.contains("gateway.auth.mode")
    {
        return 85;
    }

    if normalized.starts_with("- ") {
        return 60;
    }

    20
}

pub(crate) fn format_gateway_start_failure_message(detail: Option<&str>) -> String {
    let Some(detail) = detail.map(str::trim).filter(|value| !value.is_empty()) else {
        return "Gateway 启动超时，请检查配置或端口占用。".to_string();
    };

    let normalized = detail.to_ascii_lowercase();
    if normalized.contains("invalid config") || normalized.contains("config invalid") {
        if normalized.contains("contextwindow") && normalized.contains("received null") {
            return "Gateway 启动失败：当前 OpenClaw 配置包含空的 contextWindow 字段。Lime 已修正后续配置写入，请重新启动；如仍失败，请重新同步模型配置。"
                .to_string();
        }
        return "Gateway 启动失败：OpenClaw 配置文件无效，请重新同步模型配置后再试。".to_string();
    }

    if normalized.contains("missing config") || normalized.contains("gateway.mode=local") {
        return "Gateway 启动失败：OpenClaw 本地网关配置缺失，已自动补齐默认配置，请重试。"
            .to_string();
    }

    if normalized.contains("gateway.auth.mode") {
        return "Gateway 启动失败：缺少网关认证模式，已自动切换为 token 模式，请重试。".to_string();
    }

    if normalized.contains("address already in use") || normalized.contains("eaddrinuse") {
        return "Gateway 启动失败：目标端口已被占用，请更换端口或停止占用进程。".to_string();
    }

    if normalized.contains("resolved to non-loopback host") {
        return "Gateway 启动失败：当前环境无法绑定到本地回环地址 127.0.0.1，请检查本机网络或代理配置。".to_string();
    }

    if normalized.contains("allowedorigins") || normalized.contains("host-header origin fallback") {
        return "Gateway 启动失败：当前绑定方式需要配置 Control UI 允许来源，请检查 gateway.controlUi.allowedOrigins。".to_string();
    }

    if normalized.contains("doctor --fix") {
        return "Gateway 启动失败：OpenClaw 检测到本地环境或配置异常，请先在安装页执行“重新检测”或“修复环境”后再试。"
            .to_string();
    }

    format!("Gateway 启动失败：{detail}")
}

pub(crate) fn build_channel_info(
    channel_id: &str,
    entry: &Value,
    label: Option<&Value>,
) -> ChannelInfo {
    ChannelInfo {
        id: channel_id.to_string(),
        name: entry
            .get("name")
            .and_then(Value::as_str)
            .or_else(|| label.and_then(Value::as_str))
            .unwrap_or("未命名通道")
            .to_string(),
        channel_type: entry
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        status: entry
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
    }
}
