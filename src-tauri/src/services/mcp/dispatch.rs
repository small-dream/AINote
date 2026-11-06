//! MCP 方法分发：initialize / server.discover / tools.list / tools.call / ping。

use std::sync::Arc;

use serde_json::{json, Value};

use super::executor::ToolExecutor;
use super::protocol::{self, Era, JsonRpcError, JsonRpcRequest};
use super::tools;

const INSTRUCTIONS: &str = "AINote exposes the user's local Markdown notes. Use list_notes/search_notes to find notes, read_note before modifying, and prefer patch_note/append_note over update_note. Pass expectedRevision from the last read when writing; if you get MCP_REVISION_CONFLICT, read again and retry. Writes are rejected while the user has unsaved editor changes and never create Git commits; the user commits or syncs later. Encrypted notes can be read or written only while the vault is unlocked. Do not ask for or expose secrets.";

pub(super) fn dispatch(
    request: &JsonRpcRequest,
    era: Era,
    executor: &Arc<dyn ToolExecutor>,
) -> Result<Value, JsonRpcError> {
    match request.method.as_str() {
        "initialize" => {
            let requested = request
                .params
                .get("protocolVersion")
                .and_then(Value::as_str);
            let version = protocol::negotiate_legacy_version(requested);
            Ok(json!({
                "protocolVersion": version,
                "capabilities": protocol::capabilities(),
                "serverInfo": protocol::server_info(),
                "instructions": INSTRUCTIONS,
            }))
        }
        "server/discover" => Ok(discover_result()),
        "ping" => Ok(json!({})),
        "tools/list" => {
            let mut result = if era == Era::Modern {
                protocol::with_result_type(tools::list_result())
            } else {
                tools::list_result()
            };
            decorate_result(&mut result, era);
            Ok(result)
        }
        "tools/call" => call_tool(request, era, executor),
        _ => Err(JsonRpcError::new(
            protocol::ERR_METHOD_NOT_FOUND,
            format!("Method not found: {}", request.method),
        )),
    }
}

fn call_tool(
    request: &JsonRpcRequest,
    era: Era,
    executor: &Arc<dyn ToolExecutor>,
) -> Result<Value, JsonRpcError> {
    let name = request
        .params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            JsonRpcError::new(protocol::ERR_INVALID_PARAMS, "params.name is required")
        })?;
    if tools::find(name).is_none() {
        return Err(JsonRpcError::new(
            protocol::ERR_INVALID_PARAMS,
            format!("Unknown tool: {name}"),
        ));
    }
    let arguments = match request.params.get("arguments") {
        None | Some(Value::Null) => Value::Object(Default::default()),
        Some(value @ Value::Object(_)) => value.clone(),
        Some(_) => {
            return Err(JsonRpcError::new(
                protocol::ERR_INVALID_PARAMS,
                "params.arguments must be an object",
            ))
        }
    };
    let mut result = match executor.call(name, &arguments) {
        Ok(call) => call.to_result(),
        Err(error) => error.to_result(),
    };
    if era == Era::Modern {
        if let Some(object) = result.as_object_mut() {
            object
                .entry("resultType")
                .or_insert_with(|| Value::String("complete".into()));
        }
    }
    decorate_result(&mut result, era);
    Ok(result)
}

fn discover_result() -> Value {
    let mut result = json!({
        "resultType": "complete",
        "supportedVersions": protocol::SUPPORTED_VERSIONS,
        "capabilities": protocol::capabilities(),
        "instructions": INSTRUCTIONS,
        "ttlMs": 300_000,
        "cacheScope": "private",
    });
    result["_meta"] = server_meta();
    result
}

fn decorate_result(result: &mut Value, era: Era) {
    if era == Era::Modern {
        result["_meta"] = server_meta();
    }
}

fn server_meta() -> Value {
    json!({
        protocol::META_SERVER_INFO: protocol::server_info(),
    })
}
