//! MCP HTTP 请求校验、鉴权、响应封装；协议方法分发见 `dispatch.rs`。

use std::io::Read;
use std::sync::{Arc, RwLock};

use serde_json::{json, Value};
use tiny_http::{Header, Method, Request, Response, StatusCode};

use super::dispatch;
use super::executor::ToolExecutor;
use super::protocol::{self, Era, JsonRpcError};

pub(super) const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;

pub(super) type HttpResponse = Response<std::io::Cursor<Vec<u8>>>;

pub(super) fn build_response(
    request: &mut Request,
    port: u16,
    token: &Arc<RwLock<Option<String>>>,
    executor: &Arc<dyn ToolExecutor>,
) -> HttpResponse {
    if request.method() != &Method::Post {
        let mut response = plain_response(405, "Method Not Allowed");
        if let Ok(header) = Header::from_bytes(&b"Allow"[..], &b"POST"[..]) {
            response = response.with_header(header);
        }
        return response;
    }
    let path = request.url().split('?').next().unwrap_or("");
    if path != "/mcp" {
        return json_rpc_response(
            404,
            JsonRpcError::new(protocol::ERR_METHOD_NOT_FOUND, "Not found").to_value(None),
        );
    }

    let headers = collect_headers(request);
    if let Some(origin) = header_value(&headers, "Origin") {
        if !origin_allowed(origin, port) {
            return plain_response(403, "Forbidden origin");
        }
    }
    if !header_value(&headers, "Host").is_some_and(|host| host_allowed(host, port)) {
        return plain_response(403, "Forbidden host");
    }
    if let Some(content_type) = header_value(&headers, "Content-Type") {
        if !content_type
            .to_ascii_lowercase()
            .starts_with("application/json")
        {
            return plain_response(415, "Unsupported Media Type");
        }
    }
    if let Some(length) = header_value(&headers, "Content-Length") {
        match length.parse::<usize>() {
            Ok(length) if length > MAX_BODY_BYTES => {
                return plain_response(413, "Payload Too Large")
            }
            Ok(_) => {}
            Err(_) => return plain_response(400, "Bad Content-Length"),
        }
    }
    if !authorized(&headers, token) {
        // 401 的 WWW-Authenticate 由 json_response 统一补齐，避免重复头。
        return plain_response(401, "Unauthorized");
    }

    let body = match read_body(request) {
        Ok(body) => body,
        Err(response) => return response,
    };
    let text = match std::str::from_utf8(&body) {
        Ok(text) => text,
        Err(_) => {
            return json_rpc_response(
                400,
                JsonRpcError::new(protocol::ERR_PARSE, "Parse error: body must be UTF-8")
                    .to_value(None),
            )
        }
    };
    let parsed = match protocol::parse_request(text) {
        Ok(parsed) => parsed,
        Err(error) => return json_rpc_response(400, error.to_value(None)),
    };

    let header_version = header_value(&headers, "MCP-Protocol-Version").map(str::to_string);
    let era = protocol::detect_era(&parsed, header_version.as_deref());
    if era == Era::Modern {
        if let Err(error) = protocol::validate_modern_request(&parsed) {
            return json_rpc_response(400, error.to_value(parsed.id.clone()));
        }
        if let Err(error) = protocol::validate_protocol_header(&parsed, header_version.as_deref()) {
            return json_rpc_response(400, error.to_value(parsed.id.clone()));
        }
        if let Some(method) = header_value(&headers, "Mcp-Method") {
            if method != parsed.method {
                return json_rpc_response(
                    400,
                    JsonRpcError::new(
                        protocol::ERR_HEADER_MISMATCH,
                        "Header mismatch: Mcp-Method does not match body method",
                    )
                    .to_value(parsed.id.clone()),
                );
            }
        }
        if let Some(name) = header_value(&headers, "Mcp-Name") {
            let body_name = parsed.params.get("name").and_then(Value::as_str);
            if body_name != Some(name) {
                return json_rpc_response(
                    400,
                    JsonRpcError::new(
                        protocol::ERR_HEADER_MISMATCH,
                        "Header mismatch: Mcp-Name does not match body name",
                    )
                    .to_value(parsed.id.clone()),
                );
            }
        }
    }

    if parsed.is_notification() {
        return empty_response(202);
    }
    let id = parsed.id.clone().unwrap_or(Value::Null);
    match dispatch::dispatch(&parsed, era, executor) {
        Ok(result) => json_rpc_response(200, protocol::result_response(id, result)),
        Err(error) => {
            let status = if error.code == protocol::ERR_METHOD_NOT_FOUND && era == Era::Legacy {
                200
            } else {
                error_status(error.code)
            };
            json_rpc_response(status, error.to_value(Some(id)))
        }
    }
}

fn collect_headers(request: &Request) -> Vec<(String, String)> {
    request
        .headers()
        .iter()
        .map(|header| {
            (
                header.field.as_str().to_string(),
                header.value.as_str().to_string(),
            )
        })
        .collect()
}

fn authorized(headers: &[(String, String)], token: &Arc<RwLock<Option<String>>>) -> bool {
    let expected = token
        .read()
        .ok()
        .and_then(|guard| guard.clone())
        .unwrap_or_default();
    let provided = header_value(headers, "Authorization")
        .and_then(bearer_token)
        .unwrap_or_default();
    !expected.is_empty() && constant_time_eq(provided.as_bytes(), expected.as_bytes())
}

fn read_body(request: &mut Request) -> Result<Vec<u8>, HttpResponse> {
    let mut body = Vec::new();
    let reader = request.as_reader();
    let mut limited = Read::take(reader, (MAX_BODY_BYTES + 1) as u64);
    if limited.read_to_end(&mut body).is_err() {
        return Err(plain_response(400, "Could not read request body"));
    }
    if body.len() > MAX_BODY_BYTES {
        return Err(plain_response(413, "Payload Too Large"));
    }
    Ok(body)
}

fn header_value<'a>(headers: &'a [(String, String)], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(field, _)| field.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.as_str())
}

pub(super) fn bearer_token(value: &str) -> Option<&str> {
    let (scheme, token) = value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

pub(super) fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut diff = 0u8;
    for (a, b) in left.iter().zip(right) {
        diff |= a ^ b;
    }
    diff == 0
}

pub(super) fn origin_allowed(origin: &str, port: u16) -> bool {
    [
        format!("http://127.0.0.1:{port}"),
        format!("http://localhost:{port}"),
        format!("http://[::1]:{port}"),
    ]
    .iter()
    .any(|allowed| allowed == origin)
}

pub(super) fn host_allowed(host: &str, port: u16) -> bool {
    host == format!("127.0.0.1:{port}")
        || host == format!("localhost:{port}")
        || host == format!("[::1]:{port}")
}

pub(super) fn error_status(code: i64) -> u16 {
    match code {
        protocol::ERR_INTERNAL => 500,
        protocol::ERR_METHOD_NOT_FOUND => 404,
        protocol::ERR_PARSE
        | protocol::ERR_INVALID_REQUEST
        | protocol::ERR_INVALID_PARAMS
        | protocol::ERR_HEADER_MISMATCH
        | protocol::ERR_UNSUPPORTED_VERSION => 400,
        _ => 400,
    }
}

pub(super) fn json_rpc_response(status: u16, value: Value) -> HttpResponse {
    json_response(status, &value)
}

fn json_response(status: u16, value: &Value) -> HttpResponse {
    let mut response = Response::from_data(value.to_string().into_bytes())
        .with_status_code(StatusCode(status))
        .with_header(header("Content-Type", "application/json; charset=utf-8"))
        .with_header(header("Cache-Control", "no-store"))
        .with_header(header("X-Content-Type-Options", "nosniff"));
    if status == 401 {
        response = response.with_header(header("WWW-Authenticate", "Bearer realm=\"ainote-mcp\""));
    }
    response
}

fn plain_response(status: u16, message: &str) -> HttpResponse {
    let body = json!({ "error": message });
    json_response(status, &body)
}

fn empty_response(status: u16) -> HttpResponse {
    Response::from_data(Vec::new())
        .with_status_code(StatusCode(status))
        .with_header(header("Cache-Control", "no-store"))
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).unwrap_or_else(|_| {
        Header::from_bytes(&b"X-Header-Error"[..], &b"1"[..]).expect("static header")
    })
}
