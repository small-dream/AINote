//! MCP 协议编解码与版本协商（纯函数，便于单测）。
//!
//! 同时支持：
//! - Modern `2026-07-28`：无 initialize，每请求 `_meta` 携带协议版本与客户端能力；
//! - Legacy `2025-11-25` / `2025-06-18` / `2025-03-26`：initialize 握手，无会话。

use serde_json::{json, Value};

pub const MODERN_VERSION: &str = "2026-07-28";
pub const LEGACY_LATEST: &str = "2025-11-25";
pub const SUPPORTED_VERSIONS: &[&str] = &[MODERN_VERSION, "2025-11-25", "2025-06-18", "2025-03-26"];

pub const META_PROTOCOL_VERSION: &str = "io.modelcontextprotocol/protocolVersion";
pub const META_CLIENT_CAPABILITIES: &str = "io.modelcontextprotocol/clientCapabilities";
pub const META_SERVER_INFO: &str = "io.modelcontextprotocol/serverInfo";

pub const ERR_PARSE: i64 = -32700;
pub const ERR_INVALID_REQUEST: i64 = -32600;
pub const ERR_METHOD_NOT_FOUND: i64 = -32601;
pub const ERR_INVALID_PARAMS: i64 = -32602;
pub const ERR_INTERNAL: i64 = -32603;
pub const ERR_HEADER_MISMATCH: i64 = -32020;
pub const ERR_UNSUPPORTED_VERSION: i64 = -32022;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Era {
    Modern,
    Legacy,
}

#[derive(Debug, Clone)]
pub struct JsonRpcRequest {
    /// `None` 表示通知（无 id）。
    pub id: Option<Value>,
    pub method: String,
    pub params: Value,
}

impl JsonRpcRequest {
    pub fn is_notification(&self) -> bool {
        self.id.is_none()
    }

    pub fn meta(&self) -> Option<&Value> {
        self.params.get("_meta")
    }
}

#[derive(Debug, Clone)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    pub data: Option<Value>,
}

impl JsonRpcError {
    pub fn new(code: i64, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
        }
    }

    pub fn with_data(mut self, data: Value) -> Self {
        self.data = Some(data);
        self
    }

    pub fn to_value(&self, id: Option<Value>) -> Value {
        let mut error = json!({
            "code": self.code,
            "message": self.message,
        });
        if let Some(data) = &self.data {
            error["data"] = data.clone();
        }
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": error,
        })
    }
}

/// 解析 JSON-RPC 请求；批量数组、缺失字段、null id 一律拒绝。
pub fn parse_request(body: &str) -> Result<JsonRpcRequest, JsonRpcError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| JsonRpcError::new(ERR_PARSE, "Parse error: invalid JSON"))?;
    if value.is_array() {
        return Err(JsonRpcError::new(
            ERR_INVALID_REQUEST,
            "Batch requests are not supported",
        ));
    }
    let object = value
        .as_object()
        .ok_or_else(|| JsonRpcError::new(ERR_INVALID_REQUEST, "Request must be a JSON object"))?;
    if object.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return Err(JsonRpcError::new(
            ERR_INVALID_REQUEST,
            "jsonrpc must be \"2.0\"",
        ));
    }
    let method = object
        .get("method")
        .and_then(Value::as_str)
        .ok_or_else(|| JsonRpcError::new(ERR_INVALID_REQUEST, "method must be a string"))?
        .to_string();
    let id = match object.get("id") {
        None => None,
        Some(Value::Null) => {
            return Err(JsonRpcError::new(
                ERR_INVALID_REQUEST,
                "id must not be null",
            ))
        }
        Some(Value::String(_) | Value::Number(_)) => object.get("id").cloned(),
        Some(_) => {
            return Err(JsonRpcError::new(
                ERR_INVALID_REQUEST,
                "id must be a string or number",
            ))
        }
    };
    let params = match object.get("params") {
        None => Value::Object(Default::default()),
        Some(value @ Value::Object(_)) => value.clone(),
        Some(_) => {
            return Err(JsonRpcError::new(
                ERR_INVALID_PARAMS,
                "params must be an object",
            ))
        }
    };
    Ok(JsonRpcRequest { id, method, params })
}

/// 判断请求使用哪一代协议。
pub fn detect_era(request: &JsonRpcRequest, header_version: Option<&str>) -> Era {
    if request.method == "initialize" {
        return Era::Legacy;
    }
    if request.method == "server/discover" {
        return Era::Modern;
    }
    if request
        .meta()
        .and_then(|meta| meta.get(META_PROTOCOL_VERSION))
        .and_then(Value::as_str)
        == Some(MODERN_VERSION)
    {
        return Era::Modern;
    }
    if header_version == Some(MODERN_VERSION) {
        return Era::Modern;
    }
    Era::Legacy
}

/// Modern 请求必须携带协议版本与客户端能力；版本不支持返回 -32022。
pub fn validate_modern_request(request: &JsonRpcRequest) -> Result<(), JsonRpcError> {
    let meta = request.meta().and_then(Value::as_object).ok_or_else(|| {
        JsonRpcError::new(ERR_INVALID_PARAMS, "params._meta is required")
    })?;
    let requested = meta
        .get(META_PROTOCOL_VERSION)
        .and_then(Value::as_str)
        .ok_or_else(|| {
            JsonRpcError::new(
                ERR_INVALID_PARAMS,
                format!("_meta.{META_PROTOCOL_VERSION} is required"),
            )
        })?;
    if !SUPPORTED_VERSIONS.contains(&requested) {
        return Err(JsonRpcError::new(
            ERR_UNSUPPORTED_VERSION,
            "Unsupported protocol version",
        )
        .with_data(json!({
            "supported": SUPPORTED_VERSIONS,
            "requested": requested,
        })));
    }
    if !meta.contains_key(META_CLIENT_CAPABILITIES) {
        return Err(JsonRpcError::new(
            ERR_INVALID_PARAMS,
            format!("_meta.{META_CLIENT_CAPABILITIES} is required"),
        ));
    }
    Ok(())
}

/// `MCP-Protocol-Version` 与 body `_meta` 不一致时返回 HeaderMismatch。
pub fn validate_protocol_header(
    request: &JsonRpcRequest,
    header_version: Option<&str>,
) -> Result<(), JsonRpcError> {
    let Some(header) = header_version else {
        return Ok(());
    };
    let body = request
        .meta()
        .and_then(|meta| meta.get(META_PROTOCOL_VERSION))
        .and_then(Value::as_str);
    if let Some(body) = body {
        if body != header {
            return Err(JsonRpcError::new(
                ERR_HEADER_MISMATCH,
                format!(
                    "Header mismatch: MCP-Protocol-Version header value '{header}' does not match body value '{body}'"
                ),
            ));
        }
    }
    Ok(())
}

/// Legacy initialize 选择返回版本：优先客户端请求且受支持的版本，否则返回最高 Legacy。
pub fn negotiate_legacy_version(requested: Option<&str>) -> &'static str {
    match requested {
        Some(version) if SUPPORTED_VERSIONS.contains(&version) && version != MODERN_VERSION => {
            SUPPORTED_VERSIONS
                .iter()
                .copied()
                .find(|candidate| *candidate == version)
                .unwrap_or(LEGACY_LATEST)
        }
        _ => LEGACY_LATEST,
    }
}

pub fn server_info() -> Value {
    json!({
        "name": "ainote",
        "version": env!("CARGO_PKG_VERSION"),
    })
}

pub fn capabilities() -> Value {
    json!({
        "tools": {
            "listChanged": false
        }
    })
}

pub fn result_response(id: Value, result: Value) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result,
    })
}

pub fn with_result_type(mut result: Value) -> Value {
    if let Some(object) = result.as_object_mut() {
        object
            .entry("resultType")
            .or_insert_with(|| Value::String("complete".into()));
    }
    result
}

#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;
