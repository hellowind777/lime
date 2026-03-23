use super::*;

impl OpenClawService {
    pub async fn get_command_preview(
        &mut self,
        app: &AppHandle,
        operation: &str,
        port: Option<u16>,
    ) -> Result<CommandPreview, String> {
        match operation {
            "install" => self.build_install_command_preview(app).await,
            "uninstall" => self.build_uninstall_command_preview().await,
            "restart" => self.build_restart_command_preview(port).await,
            "start" => self.build_start_command_preview(port).await,
            "stop" => self.build_stop_command_preview(port).await,
            _ => Err(format!("不支持的 OpenClaw 操作预览: {operation}")),
        }
    }

    async fn build_install_command_preview(
        &self,
        app: &AppHandle,
    ) -> Result<CommandPreview, String> {
        let (package, npm_path, npm_prefix, cleanup_command, install_command) =
            self.resolve_install_commands(app).await?;
        let prefix_note = npm_prefix
            .map(|prefix| format!("npm: {npm_path}\nprefix: {prefix}\n"))
            .unwrap_or_else(|| format!("npm: {npm_path}\n"));
        Ok(CommandPreview {
            title: format!("安装 {package}"),
            command: format!("{prefix_note}{cleanup_command}\n{install_command}"),
        })
    }

    async fn build_uninstall_command_preview(&self) -> Result<CommandPreview, String> {
        let (npm_path, npm_prefix, command) = self.resolve_uninstall_command().await?;
        let prefix_note = npm_prefix
            .map(|prefix| format!("npm: {npm_path}\nprefix: {prefix}\n"))
            .unwrap_or_else(|| format!("npm: {npm_path}\n"));
        Ok(CommandPreview {
            title: "卸载 OpenClaw".to_string(),
            command: format!("{prefix_note}{command}"),
        })
    }

    async fn build_start_command_preview(
        &mut self,
        port: Option<u16>,
    ) -> Result<CommandPreview, String> {
        if let Some(next_port) = port {
            self.gateway_port = next_port.max(1);
        }
        self.restore_auth_token_from_config();
        if self.gateway_auth_token.is_empty() {
            self.gateway_auth_token = generate_auth_token();
        }
        let openclaw_command = resolve_openclaw_command()
            .await?
            .ok_or_else(|| "未检测到 OpenClaw 可执行文件，请先安装。".to_string())?;
        let config_path = openclaw_lime_config_path();
        let command = gateway_start_args(self.gateway_port, &self.gateway_auth_token)
            .into_iter()
            .map(|arg| shell_escape(&arg))
            .collect::<Vec<_>>()
            .join(" ");
        Ok(CommandPreview {
            title: "启动 Gateway".to_string(),
            command: format!(
                "{}OPENCLAW_CONFIG_PATH={} {} {}",
                if cfg!(target_os = "windows") {
                    "set "
                } else {
                    ""
                },
                shell_escape(config_path.to_string_lossy().as_ref()),
                openclaw_command.preview_invocation(),
                command
            ),
        })
    }

    async fn build_stop_command_preview(
        &mut self,
        port: Option<u16>,
    ) -> Result<CommandPreview, String> {
        if let Some(next_port) = port {
            self.gateway_port = next_port.max(1);
        }
        self.restore_auth_token_from_config();
        let openclaw_command = resolve_openclaw_command()
            .await?
            .ok_or_else(|| "未检测到 OpenClaw 可执行文件，请先安装。".to_string())?;
        let config_path = openclaw_lime_config_path();
        Ok(CommandPreview {
            title: "停止 Gateway".to_string(),
            command: format!(
                "OPENCLAW_CONFIG_PATH={} {} gateway stop --url {} --token {}",
                shell_escape(config_path.to_string_lossy().as_ref()),
                openclaw_command.preview_invocation(),
                self.gateway_ws_url(),
                shell_escape(&self.gateway_auth_token)
            ),
        })
    }

    async fn build_restart_command_preview(
        &mut self,
        port: Option<u16>,
    ) -> Result<CommandPreview, String> {
        let stop = self.build_stop_command_preview(port).await?;
        let start = self.build_start_command_preview(port).await?;
        Ok(CommandPreview {
            title: "重启 Gateway".to_string(),
            command: format!("{}\n{}", stop.command, start.command),
        })
    }
}
