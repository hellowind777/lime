use super::*;

impl OpenClawService {
    pub fn sync_provider_config(
        &mut self,
        provider: &ApiKeyProvider,
        api_key: &str,
        primary_model_id: &str,
        models: &[SyncModelEntry],
    ) -> Result<ActionResult, String> {
        if api_key.trim().is_empty() && provider.provider_type != ApiProviderType::Ollama {
            return Ok(ActionResult {
                success: false,
                message: "该 Provider 没有可用的 API Key。".to_string(),
            });
        }

        let api_type = determine_api_type(provider.provider_type)?;
        let base_url = format_provider_base_url(provider)?;
        let provider_key = format!("lime-{}", provider.id);

        let normalized_models = if models.is_empty() {
            vec![SyncModelEntry {
                id: primary_model_id.to_string(),
                name: primary_model_id.to_string(),
                context_window: None,
            }]
        } else {
            let mut items = models.to_vec();
            if !items.iter().any(|item| item.id == primary_model_id) {
                items.insert(
                    0,
                    SyncModelEntry {
                        id: primary_model_id.to_string(),
                        name: primary_model_id.to_string(),
                        context_window: None,
                    },
                );
            }
            items
        };

        self.ensure_runtime_config(
            Some((
                &provider_key,
                json!({
                    "baseUrl": base_url,
                    "apiKey": api_key,
                    "api": api_type,
                    "models": normalized_models
                        .iter()
                        .map(sync_model_entry_to_config_value)
                        .collect::<Vec<_>>()
                }),
            )),
            Some(format!("{provider_key}/{primary_model_id}")),
        )?;

        Ok(ActionResult {
            success: true,
            message: format!("已同步 Provider“{}”到 OpenClaw。", provider.name),
        })
    }
    pub(crate) fn ensure_runtime_config(
        &mut self,
        provider_entry: Option<(&str, Value)>,
        primary_model: Option<String>,
    ) -> Result<(), String> {
        let config_dir = openclaw_config_dir();
        std::fs::create_dir_all(&config_dir).map_err(|e| format!("创建配置目录失败: {e}"))?;

        let lime_config_path = openclaw_lime_config_path();
        let mut config = read_base_openclaw_config()?;
        sanitize_runtime_config(&mut config);

        if self.gateway_auth_token.is_empty() {
            self.gateway_auth_token = generate_auth_token();
        }

        apply_gateway_runtime_defaults(&mut config, self.gateway_port, &self.gateway_auth_token);

        if let Some((provider_key, provider_value)) = provider_entry {
            set_json_path(
                &mut config,
                &["models", "mode"],
                Value::String("merge".to_string()),
            );
            set_json_path(
                &mut config,
                &["models", "providers", provider_key],
                provider_value,
            );
        }

        if let Some(primary) = primary_model {
            set_json_path(
                &mut config,
                &["agents", "defaults", "model", "primary"],
                Value::String(primary),
            );
        }

        let content =
            serde_json::to_string_pretty(&config).map_err(|e| format!("序列化配置失败: {e}"))?;
        std::fs::write(lime_config_path, content).map_err(|e| format!("写入配置失败: {e}"))?;
        Ok(())
    }
}

pub(crate) fn openclaw_config_dir() -> PathBuf {
    home_dir()
        .or_else(data_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openclaw")
}

pub(crate) fn openclaw_original_config_path() -> PathBuf {
    openclaw_config_dir().join("openclaw.json")
}

pub(crate) fn openclaw_lime_config_path() -> PathBuf {
    openclaw_config_dir().join("openclaw.lime.json")
}

pub(crate) fn read_base_openclaw_config() -> Result<Value, String> {
    let lime_path = openclaw_lime_config_path();
    if lime_path.exists() {
        return read_json_file(&lime_path);
    }

    let original_path = openclaw_original_config_path();
    if original_path.exists() {
        return read_json_file(&original_path);
    }

    Ok(json!({}))
}

pub(crate) fn read_json_file(path: &Path) -> Result<Value, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("读取配置文件失败({}): {e}", path.display()))?;
    serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败({}): {e}", path.display()))
}

pub(crate) fn ensure_path_object<'a>(
    root: &'a mut Value,
    path: &[&str],
) -> &'a mut Map<String, Value> {
    let mut current = root;
    for segment in path {
        let object = ensure_value_object(current);
        current = object
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Object(Map::new()));
    }
    ensure_value_object(current)
}

pub(crate) fn set_json_path(root: &mut Value, path: &[&str], value: Value) {
    if path.is_empty() {
        *root = value;
        return;
    }

    let parent = ensure_path_object(root, &path[..path.len() - 1]);
    parent.insert(path[path.len() - 1].to_string(), value);
}

pub(crate) fn sync_model_entry_to_config_value(model: &SyncModelEntry) -> Value {
    let mut entry = Map::new();
    entry.insert("id".to_string(), Value::String(model.id.clone()));
    entry.insert("name".to_string(), Value::String(model.name.clone()));
    if let Some(context_window) = model.context_window {
        entry.insert(
            "contextWindow".to_string(),
            Value::Number(context_window.into()),
        );
    }
    Value::Object(entry)
}

pub(crate) fn sanitize_runtime_config(config: &mut Value) {
    let Some(providers) = config
        .get_mut("models")
        .and_then(|models| models.get_mut("providers"))
        .and_then(Value::as_object_mut)
    else {
        return;
    };

    for provider in providers.values_mut() {
        let Some(models) = provider.get_mut("models").and_then(Value::as_array_mut) else {
            continue;
        };

        for model in models {
            let Some(entry) = model.as_object_mut() else {
                continue;
            };

            if matches!(entry.get("contextWindow"), Some(Value::Null)) {
                entry.remove("contextWindow");
            }
        }
    }
}

pub(crate) fn apply_gateway_runtime_defaults(
    config: &mut Value,
    gateway_port: u16,
    gateway_auth_token: &str,
) {
    ensure_path_object(config, &["gateway"]);
    set_json_path(
        config,
        &["gateway", "mode"],
        Value::String("local".to_string()),
    );
    set_json_path(
        config,
        &["gateway", "bind"],
        Value::String("loopback".to_string()),
    );
    set_json_path(
        config,
        &["gateway", "port"],
        Value::Number(gateway_port.into()),
    );
    set_json_path(
        config,
        &["gateway", "auth", "mode"],
        Value::String("token".to_string()),
    );
    set_json_path(
        config,
        &["gateway", "auth", "token"],
        Value::String(gateway_auth_token.to_string()),
    );
    set_json_path(
        config,
        &["gateway", "remote", "token"],
        Value::String(gateway_auth_token.to_string()),
    );
}

pub(crate) fn ensure_value_object(value: &mut Value) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = Value::Object(Map::new());
    }
    value.as_object_mut().expect("value should be object")
}

pub(crate) fn extract_gateway_auth_token(config: &Value) -> Option<String> {
    config
        .get("gateway")
        .and_then(|gateway| {
            gateway
                .get("auth")
                .and_then(|auth| auth.get("token"))
                .or_else(|| gateway.get("remote").and_then(|remote| remote.get("token")))
        })
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(ToString::to_string)
}

pub(crate) fn determine_api_type(provider_type: ApiProviderType) -> Result<&'static str, String> {
    match provider_type {
        ApiProviderType::Anthropic | ApiProviderType::AnthropicCompatible => {
            Ok("anthropic-messages")
        }
        ApiProviderType::OpenaiResponse => Ok("openai-responses"),
        ApiProviderType::Openai
        | ApiProviderType::Codex
        | ApiProviderType::Gemini
        | ApiProviderType::Ollama
        | ApiProviderType::Fal
        | ApiProviderType::NewApi
        | ApiProviderType::Gateway => Ok("openai-completions"),
        ApiProviderType::AzureOpenai | ApiProviderType::Vertexai | ApiProviderType::AwsBedrock => {
            Err("当前暂不支持将该 Provider 同步到 OpenClaw。".to_string())
        }
    }
}

pub(crate) fn format_provider_base_url(provider: &ApiKeyProvider) -> Result<String, String> {
    let api_host = trim_trailing_slash(&provider.api_host);

    match provider.provider_type {
        ApiProviderType::Anthropic | ApiProviderType::AnthropicCompatible => Ok(api_host),
        ApiProviderType::Gemini => {
            if api_host.contains("generativelanguage.googleapis.com") {
                if api_host.ends_with("/v1beta/openai") {
                    Ok(api_host)
                } else {
                    Ok(format!("{api_host}/v1beta/openai"))
                }
            } else if has_api_version(&api_host) {
                Ok(api_host)
            } else {
                Ok(format!("{api_host}/v1"))
            }
        }
        ApiProviderType::Gateway => {
            if api_host.ends_with("/v1/ai") {
                Ok(api_host.trim_end_matches("/ai").to_string())
            } else if has_api_version(&api_host) {
                Ok(api_host)
            } else {
                Ok(format!("{api_host}/v1"))
            }
        }
        ApiProviderType::Openai
        | ApiProviderType::OpenaiResponse
        | ApiProviderType::Codex
        | ApiProviderType::Ollama
        | ApiProviderType::Fal
        | ApiProviderType::NewApi => {
            if has_api_version(&api_host) {
                Ok(api_host)
            } else {
                Ok(format!("{api_host}/v1"))
            }
        }
        ApiProviderType::AzureOpenai | ApiProviderType::Vertexai | ApiProviderType::AwsBedrock => {
            Err("当前暂不支持将该 Provider 同步到 OpenClaw。".to_string())
        }
    }
}

pub(crate) fn trim_trailing_slash(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

pub(crate) fn has_api_version(url: &str) -> bool {
    static VERSION_RE: OnceLock<Regex> = OnceLock::new();
    VERSION_RE
        .get_or_init(|| Regex::new(r"/v\d+(?:[./]|$)").expect("regex should compile"))
        .is_match(url)
}
