//! Tool Calling 2.0 运行时配置
//!
//! 通过内存态开关提供跨 crate 的统一读取入口，并保留环境变量兜底覆盖。

use crate::config::{Config, ToolCallingConfig};
use crate::env_compat;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::sync::atomic::{AtomicBool, Ordering};

const ENV_TOOLCALL_V2_ENABLED: &[&str] =
    &["LIME_TOOLCALL_V2_ENABLED", "PROXYCAST_TOOLCALL_V2_ENABLED"];
const ENV_TOOLCALL_V2_DYNAMIC_FILTERING: &[&str] = &[
    "LIME_TOOLCALL_V2_DYNAMIC_FILTERING",
    "PROXYCAST_TOOLCALL_V2_DYNAMIC_FILTERING",
];
const ENV_TOOLCALL_V2_NATIVE_INPUT_EXAMPLES: &[&str] = &[
    "LIME_TOOLCALL_V2_NATIVE_INPUT_EXAMPLES",
    "PROXYCAST_TOOLCALL_V2_NATIVE_INPUT_EXAMPLES",
];

static TOOLCALL_RUNTIME_INITIALIZED: AtomicBool = AtomicBool::new(false);
static TOOLCALL_V2_ENABLED: AtomicBool = AtomicBool::new(true);
static TOOLCALL_DYNAMIC_FILTERING_ENABLED: AtomicBool = AtomicBool::new(true);
static TOOLCALL_NATIVE_INPUT_EXAMPLES_ENABLED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ToolSurfaceMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deferred_loading: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub always_visible: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_callers: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub input_examples: Vec<Value>,
}

/// 将配置应用到进程内运行时开关。
pub fn apply_tool_calling_runtime_config(config: &Config) {
    apply_tool_calling_runtime_config_with_flags(&config.tool_calling);
}

/// 将 Tool Calling 配置应用到进程内运行时开关。
pub fn apply_tool_calling_runtime_config_with_flags(flags: &ToolCallingConfig) {
    TOOLCALL_V2_ENABLED.store(flags.enabled, Ordering::Release);
    TOOLCALL_DYNAMIC_FILTERING_ENABLED.store(flags.dynamic_filtering, Ordering::Release);
    TOOLCALL_NATIVE_INPUT_EXAMPLES_ENABLED.store(flags.native_input_examples, Ordering::Release);
    TOOLCALL_RUNTIME_INITIALIZED.store(true, Ordering::Release);
}

/// Tool Calling 2.0 总开关。
pub fn tool_calling_v2_enabled() -> bool {
    if let Some(value) = env_compat::bool_var(ENV_TOOLCALL_V2_ENABLED) {
        return value;
    }
    if TOOLCALL_RUNTIME_INITIALIZED.load(Ordering::Acquire) {
        return TOOLCALL_V2_ENABLED.load(Ordering::Acquire);
    }
    true
}

/// Tool Calling 动态过滤开关。
pub fn tool_calling_dynamic_filtering_enabled() -> bool {
    if let Some(value) = env_compat::bool_var(ENV_TOOLCALL_V2_DYNAMIC_FILTERING) {
        return value;
    }
    if TOOLCALL_RUNTIME_INITIALIZED.load(Ordering::Acquire) {
        return TOOLCALL_DYNAMIC_FILTERING_ENABLED.load(Ordering::Acquire);
    }
    true
}

/// Tool Calling 原生 input examples 透传开关。
pub fn tool_calling_native_input_examples_enabled() -> bool {
    if let Some(value) = env_compat::bool_var(ENV_TOOLCALL_V2_NATIVE_INPUT_EXAMPLES) {
        return value;
    }
    if TOOLCALL_RUNTIME_INITIALIZED.load(Ordering::Acquire) {
        return TOOLCALL_NATIVE_INPUT_EXAMPLES_ENABLED.load(Ordering::Acquire);
    }
    false
}

fn metadata_extension(schema: &Value) -> &Value {
    schema
        .get("x-lime")
        .or_else(|| schema.get("x_lime"))
        .unwrap_or(schema)
}

fn metadata_read_bool(schema: &Value, key: &str, camel_key: &str) -> Option<bool> {
    metadata_extension(schema)
        .get(key)
        .or_else(|| metadata_extension(schema).get(camel_key))
        .and_then(|value| value.as_bool())
}

fn metadata_read_string_vec(schema: &Value, key: &str, camel_key: &str) -> Option<Vec<String>> {
    let values = metadata_extension(schema)
        .get(key)
        .or_else(|| metadata_extension(schema).get(camel_key))
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(|item| item.trim().to_ascii_lowercase())
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    (!values.is_empty()).then_some(values)
}

pub fn normalize_tool_caller(caller: Option<&str>) -> Option<String> {
    caller
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
}

pub fn extract_tool_surface_metadata(tool_name: &str, schema: &Value) -> ToolSurfaceMetadata {
    ToolSurfaceMetadata {
        deferred_loading: metadata_read_bool(schema, "deferred_loading", "deferredLoading"),
        always_visible: metadata_read_bool(schema, "always_visible", "alwaysVisible"),
        allowed_callers: metadata_read_string_vec(schema, "allowed_callers", "allowedCallers"),
        tags: metadata_read_string_vec(schema, "tags", "tags"),
        input_examples: resolve_tool_input_examples(tool_name, schema),
    }
}

pub fn tool_visible_in_context(metadata: &ToolSurfaceMetadata, include_deferred: bool) -> bool {
    if include_deferred {
        return true;
    }

    let deferred_loading = metadata.deferred_loading.unwrap_or(false);
    let always_visible = metadata.always_visible.unwrap_or(false);
    !deferred_loading || always_visible
}

pub fn tool_matches_caller(metadata: &ToolSurfaceMetadata, caller: Option<&str>) -> bool {
    let Some(allowed_callers) = metadata.allowed_callers.as_ref() else {
        return true;
    };
    let Some(caller) = normalize_tool_caller(caller) else {
        return true;
    };

    allowed_callers.iter().any(|item| item == &caller)
}

pub fn score_tool_match(name: &str, description: &str, tags: &[String], query: &str) -> i32 {
    let query = query.trim().to_ascii_lowercase();
    if query.is_empty() {
        return 1;
    }

    let name_lc = name.to_ascii_lowercase();
    let description_lc = description.to_ascii_lowercase();
    let mut score = 0;

    if name_lc == query {
        score += 120;
    } else if name_lc.starts_with(&query) {
        score += 90;
    } else if name_lc.contains(&query) {
        score += 70;
    }

    if description_lc.contains(&query) {
        score += 40;
    }

    for tag in tags {
        if tag == &query {
            score += 35;
        } else if tag.contains(&query) {
            score += 20;
        }
    }

    score
}

fn schema_read_examples(schema: &Value) -> Vec<Value> {
    let extension = schema
        .get("x-lime")
        .or_else(|| schema.get("x_lime"))
        .unwrap_or(schema);

    extension
        .get("input_examples")
        .or_else(|| extension.get("inputExamples"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter(|v| !v.is_null()).cloned().collect())
        .unwrap_or_default()
}

fn pick_example_value(field_name: &str, schema: &Value, depth: usize) -> Value {
    if let Some(enum_values) = schema.get("enum").and_then(|v| v.as_array()) {
        if let Some(first) = enum_values.first() {
            return first.clone();
        }
    }

    if let Some(one_of) = schema
        .get("oneOf")
        .or_else(|| schema.get("anyOf"))
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
    {
        return pick_example_value(field_name, one_of, depth + 1);
    }

    let field_name_lc = field_name.to_ascii_lowercase();
    let field_type = schema
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("string");

    match field_type {
        "boolean" => Value::Bool(true),
        "integer" => {
            if field_name_lc.contains("count")
                || field_name_lc.contains("limit")
                || field_name_lc.contains("top")
            {
                Value::Number(3.into())
            } else {
                Value::Number(1.into())
            }
        }
        "number" => Value::Number(serde_json::Number::from_f64(0.5).unwrap_or_else(|| 0.into())),
        "array" => {
            if depth >= 2 {
                return Value::Array(Vec::new());
            }
            let item_schema = schema.get("items").unwrap_or(&Value::Null);
            Value::Array(vec![pick_example_value(field_name, item_schema, depth + 1)])
        }
        "object" => {
            if depth >= 2 {
                return Value::Object(Map::new());
            }
            synthesize_example_from_schema(schema, depth + 1)
                .unwrap_or_else(|| Value::Object(Map::new()))
        }
        _ => {
            if field_name_lc.contains("url") || field_name_lc.contains("link") {
                Value::String("https://example.com".to_string())
            } else if field_name_lc.contains("query") || field_name_lc.contains("keyword") {
                Value::String("latest ai agent tool calling updates".to_string())
            } else if field_name_lc.contains("prompt")
                || field_name_lc.contains("instruction")
                || field_name_lc.contains("question")
            {
                Value::String("请提炼三条关键信息并给出结论".to_string())
            } else if field_name_lc.contains("id") {
                Value::String("example-id".to_string())
            } else if field_name_lc.contains("path") {
                Value::String("/tmp/example".to_string())
            } else {
                Value::String("example".to_string())
            }
        }
    }
}

fn synthesize_example_from_schema(schema: &Value, depth: usize) -> Option<Value> {
    let properties = schema.get("properties").and_then(|v| v.as_object())?;
    if properties.is_empty() {
        return None;
    }

    let required = schema
        .get("required")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|v| v.to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut keys = required.clone();
    let mut optional_keys = properties.keys().cloned().collect::<Vec<_>>();
    optional_keys.sort();
    for key in optional_keys {
        if !keys.contains(&key) {
            keys.push(key);
        }
    }

    let max_fields = if depth == 0 { 6 } else { 4 };
    let mut out = Map::new();
    for key in keys.into_iter().take(max_fields) {
        if let Some(field_schema) = properties.get(&key) {
            out.insert(key.clone(), pick_example_value(&key, field_schema, depth));
        }
    }

    Some(Value::Object(out))
}

/// 解析工具 schema 内配置的 input_examples。
pub fn configured_tool_input_examples(schema: &Value) -> Vec<Value> {
    schema_read_examples(schema)
}

/// 获取工具可用的 input_examples（优先配置，内置工具缺省时按 schema 生成）。
pub fn resolve_tool_input_examples(tool_name: &str, schema: &Value) -> Vec<Value> {
    let configured = schema_read_examples(schema);
    if !configured.is_empty() {
        return configured;
    }

    let normalized = tool_name.trim().to_ascii_lowercase();
    let built_in = matches!(
        normalized.as_str(),
        "websearch" | "webfetch" | "tool_search"
    );
    if !built_in {
        return Vec::new();
    }

    synthesize_example_from_schema(schema, 0)
        .map(|v| vec![v])
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    fn clear_tool_calling_envs() {
        std::env::remove_var(ENV_TOOLCALL_V2_ENABLED[0]);
        std::env::remove_var(ENV_TOOLCALL_V2_DYNAMIC_FILTERING[0]);
        std::env::remove_var(ENV_TOOLCALL_V2_NATIVE_INPUT_EXAMPLES[0]);
    }

    #[test]
    fn test_runtime_flags_apply_and_read() {
        let _guard = env_lock();
        clear_tool_calling_envs();
        apply_tool_calling_runtime_config_with_flags(&ToolCallingConfig {
            enabled: false,
            dynamic_filtering: false,
            native_input_examples: true,
        });

        assert!(!tool_calling_v2_enabled());
        assert!(!tool_calling_dynamic_filtering_enabled());
        assert!(tool_calling_native_input_examples_enabled());
    }

    #[test]
    fn test_env_overrides_runtime_flags() {
        let _guard = env_lock();
        clear_tool_calling_envs();

        apply_tool_calling_runtime_config_with_flags(&ToolCallingConfig {
            enabled: false,
            dynamic_filtering: false,
            native_input_examples: false,
        });

        std::env::set_var(ENV_TOOLCALL_V2_ENABLED[0], "true");
        std::env::set_var(ENV_TOOLCALL_V2_DYNAMIC_FILTERING[0], "1");
        std::env::set_var(ENV_TOOLCALL_V2_NATIVE_INPUT_EXAMPLES[0], "on");

        assert!(tool_calling_v2_enabled());
        assert!(tool_calling_dynamic_filtering_enabled());
        assert!(tool_calling_native_input_examples_enabled());

        clear_tool_calling_envs();
    }

    #[test]
    fn test_resolve_tool_input_examples_prefers_configured_examples() {
        let schema = serde_json::json!({
            "type": "object",
            "x-lime": {
                "input_examples": [{"query": "rust async"}]
            }
        });
        let examples = resolve_tool_input_examples("WebSearch", &schema);
        assert_eq!(examples, vec![serde_json::json!({"query":"rust async"})]);
    }

    #[test]
    fn test_resolve_tool_input_examples_generates_builtin_examples_from_schema() {
        let schema = serde_json::json!({
            "type": "object",
            "properties": {
                "query": {"type":"string"},
                "limit": {"type":"integer"}
            },
            "required": ["query"]
        });
        let examples = resolve_tool_input_examples("WebSearch", &schema);
        assert_eq!(examples.len(), 1);
        let example = examples[0].as_object().cloned().unwrap_or_default();
        assert!(example.contains_key("query"));
    }

    #[test]
    fn test_resolve_tool_input_examples_ignores_non_builtin_without_config() {
        let schema = serde_json::json!({
            "type": "object",
            "properties": {
                "query": {"type":"string"}
            }
        });
        let examples = resolve_tool_input_examples("docs_search", &schema);
        assert!(examples.is_empty());
    }

    #[test]
    fn test_extract_tool_surface_metadata_reads_extension_fields() {
        let schema = serde_json::json!({
            "x-lime": {
                "deferred_loading": true,
                "always_visible": false,
                "allowed_callers": ["assistant", "code_execution"],
                "input_examples": [{"query":"rust"}],
                "tags": ["docs", "search"]
            }
        });

        let metadata = extract_tool_surface_metadata("docs_search", &schema);
        assert_eq!(metadata.deferred_loading, Some(true));
        assert_eq!(metadata.always_visible, Some(false));
        assert_eq!(
            metadata.allowed_callers,
            Some(vec!["assistant".to_string(), "code_execution".to_string()])
        );
        assert_eq!(
            metadata.tags,
            Some(vec!["docs".to_string(), "search".to_string()])
        );
        assert_eq!(
            metadata.input_examples,
            vec![serde_json::json!({"query":"rust"})]
        );
    }

    #[test]
    fn test_tool_visibility_and_caller_match_follow_metadata() {
        let metadata = ToolSurfaceMetadata {
            deferred_loading: Some(true),
            always_visible: Some(false),
            allowed_callers: Some(vec!["assistant".to_string()]),
            tags: None,
            input_examples: Vec::new(),
        };

        assert!(!tool_visible_in_context(&metadata, false));
        assert!(tool_visible_in_context(&metadata, true));
        assert!(tool_matches_caller(&metadata, Some("assistant")));
        assert!(!tool_matches_caller(&metadata, Some("code_execution")));
    }

    #[test]
    fn test_score_tool_match_prefers_exact_name() {
        let exact = score_tool_match(
            "tool_search",
            "Search tool surfaces",
            &["search".to_string()],
            "tool_search",
        );
        let partial = score_tool_match(
            "tool_lookup",
            "Search tool surfaces",
            &["search".to_string()],
            "tool_search",
        );
        assert!(exact > partial);
    }
}
