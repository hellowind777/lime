use super::require_app_handle;
use crate::dev_bridge::DevBridgeState;
use serde_json::Value as JsonValue;
use tauri::Manager;

type DynError = Box<dyn std::error::Error>;

pub(super) async fn try_handle(
    state: &DevBridgeState,
    cmd: &str,
    _args: Option<&JsonValue>,
) -> Result<Option<JsonValue>, DynError> {
    if cmd != "get_plugins_with_ui" {
        return Ok(None);
    }

    let app_handle = require_app_handle(state)?;
    let result = match cmd {
        "get_plugins_with_ui" => {
            let installer_state =
                app_handle.state::<crate::commands::plugin_install_cmd::PluginInstallerState>();
            let plugin_manager_state =
                app_handle.state::<crate::commands::plugin_cmd::PluginManagerState>();

            serde_json::to_value(
                crate::commands::plugin_cmd::get_plugins_with_ui(
                    installer_state,
                    plugin_manager_state,
                )
                .await?,
            )?
        }
        _ => unreachable!("已通过前置判断过滤插件命令"),
    };

    Ok(Some(result))
}
