//! MCP 工具参数解析与边界校验。

use serde_json::Value;

use super::ToolError;

const MAX_STRING_CHARS: usize = 512;

pub fn object(args: &Value) -> Result<&serde_json::Map<String, Value>, ToolError> {
    args.as_object().ok_or_else(|| {
        ToolError::new(
            "MCP_INVALID_ARGUMENT",
            "arguments must be a JSON object",
        )
    })
}

pub fn required_str<'a>(
    args: &'a serde_json::Map<String, Value>,
    key: &str,
) -> Result<&'a str, ToolError> {
    let value = args.get(key).and_then(Value::as_str).ok_or_else(|| {
        ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} is required and must be a string"),
        )
    })?;
    if value.is_empty() {
        return Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} must not be empty"),
        ));
    }
    if value.chars().count() > MAX_STRING_CHARS {
        return Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} exceeds {MAX_STRING_CHARS} characters"),
        ));
    }
    Ok(value)
}

pub fn optional_str<'a>(
    args: &'a serde_json::Map<String, Value>,
    key: &str,
) -> Result<Option<&'a str>, ToolError> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(value)) => {
            if value.chars().count() > MAX_STRING_CHARS {
                return Err(ToolError::new(
                    "MCP_INVALID_ARGUMENT",
                    format!("{key} exceeds {MAX_STRING_CHARS} characters"),
                ));
            }
            Ok(Some(value))
        }
        Some(_) => Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} must be a string"),
        )),
    }
}

pub fn optional_u64(
    args: &serde_json::Map<String, Value>,
    key: &str,
    default: u64,
    min: u64,
    max: u64,
) -> Result<u64, ToolError> {
    let value = match args.get(key) {
        None | Some(Value::Null) => default,
        Some(Value::Number(number)) => number.as_u64().ok_or_else(|| {
            ToolError::new(
                "MCP_INVALID_ARGUMENT",
                format!("{key} must be a non-negative integer"),
            )
        })?,
        Some(_) => {
            return Err(ToolError::new(
                "MCP_INVALID_ARGUMENT",
                format!("{key} must be a non-negative integer"),
            ))
        }
    };
    if value < min || value > max {
        return Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} must be between {min} and {max}"),
        ));
    }
    Ok(value)
}

pub fn optional_bool(
    args: &serde_json::Map<String, Value>,
    key: &str,
    default: bool,
) -> Result<bool, ToolError> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(default),
        Some(Value::Bool(value)) => Ok(*value),
        Some(_) => Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} must be a boolean"),
        )),
    }
}

pub fn required_text(
    args: &serde_json::Map<String, Value>,
    key: &str,
    max_bytes: usize,
) -> Result<String, ToolError> {
    let value = args.get(key).and_then(Value::as_str).ok_or_else(|| {
        ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} is required and must be a string"),
        )
    })?;
    if value.len() > max_bytes {
        return Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} exceeds {max_bytes} bytes"),
        ));
    }
    Ok(value.to_string())
}

pub fn optional_text(
    args: &serde_json::Map<String, Value>,
    key: &str,
    max_bytes: usize,
) -> Result<Option<String>, ToolError> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(value)) => {
            if value.len() > max_bytes {
                return Err(ToolError::new(
                    "MCP_INVALID_ARGUMENT",
                    format!("{key} exceeds {max_bytes} bytes"),
                ));
            }
            Ok(Some(value.clone()))
        }
        Some(_) => Err(ToolError::new(
            "MCP_INVALID_ARGUMENT",
            format!("{key} must be a string"),
        )),
    }
}
