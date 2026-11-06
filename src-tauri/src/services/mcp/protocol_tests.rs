use super::*;

fn request(body: &str) -> JsonRpcRequest {
    parse_request(body).unwrap()
}

#[test]
fn parses_request_and_notification() {
    let req = request(r#"{"jsonrpc":"2.0","id":"a","method":"tools/list","params":{}}"#);
    assert_eq!(req.id, Some(json!("a")));
    assert!(!req.is_notification());
    let note = request(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#);
    assert!(note.is_notification());
}

#[test]
fn rejects_batch_null_id_and_bad_params() {
    assert_eq!(
        parse_request("[]").unwrap_err().code,
        ERR_INVALID_REQUEST
    );
    assert_eq!(
        parse_request(r#"{"jsonrpc":"2.0","id":null,"method":"x"}"#)
            .unwrap_err()
            .code,
        ERR_INVALID_REQUEST
    );
    assert_eq!(
        parse_request(r#"{"jsonrpc":"2.0","id":1,"method":"x","params":[]}"#)
            .unwrap_err()
            .code,
        ERR_INVALID_PARAMS
    );
}

#[test]
fn detects_modern_and_legacy() {
    let legacy = request(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#);
    assert_eq!(detect_era(&legacy, None), Era::Legacy);
    let modern = request(
        r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}"#,
    );
    assert_eq!(detect_era(&modern, None), Era::Modern);
    assert_eq!(detect_era(&modern, Some(MODERN_VERSION)), Era::Modern);
}

#[test]
fn validates_modern_meta_and_header() {
    let missing = request(r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}"#);
    assert_eq!(
        validate_modern_request(&missing).unwrap_err().code,
        ERR_INVALID_PARAMS
    );
    let unsupported = request(
        r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"1900-01-01","io.modelcontextprotocol/clientCapabilities":{}}}}"#,
    );
    let err = validate_modern_request(&unsupported).unwrap_err();
    assert_eq!(err.code, ERR_UNSUPPORTED_VERSION);
    assert_eq!(err.data.unwrap()["requested"], "1900-01-01");

    let mismatched = request(
        r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}"#,
    );
    assert_eq!(
        validate_protocol_header(&mismatched, Some("2025-11-25"))
            .unwrap_err()
            .code,
        ERR_HEADER_MISMATCH
    );
}

#[test]
fn negotiates_legacy_version() {
    assert_eq!(negotiate_legacy_version(Some("2025-06-18")), "2025-06-18");
    assert_eq!(negotiate_legacy_version(Some("1900-01-01")), LEGACY_LATEST);
    assert_eq!(negotiate_legacy_version(None), LEGACY_LATEST);
}

#[test]
fn adds_result_type_once() {
    assert_eq!(
        with_result_type(json!({"tools": []}))["resultType"],
        "complete"
    );
    assert_eq!(
        with_result_type(json!({"resultType":"complete"}))["resultType"],
        "complete"
    );
}
