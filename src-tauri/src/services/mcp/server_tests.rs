    use super::*;
    use crate::services::mcp::tools::ToolCall;
    use serde_json::{json, Value};
    use std::sync::{Arc, RwLock};
    use std::time::Duration;
    use super::super::http::{
        bearer_token, constant_time_eq, error_status, host_allowed, origin_allowed,
    };

    struct FakeExecutor;

    impl ToolExecutor for FakeExecutor {
        fn call(&self, name: &str, _arguments: &Value) -> Result<ToolCall, super::super::tools::ToolError> {
            Ok(ToolCall {
                text: format!("called {name}"),
                structured: json!({ "path": "a.md", "revision": "r1" }),
            })
        }
    }

    fn free_port() -> u16 {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        port
    }

    fn raw_request(port: u16, token: Option<&str>, body: &str, extra: &str) -> String {
        use std::io::{Read, Write};
        let mut stream = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let auth = token
            .map(|token| format!("Authorization: Bearer {token}\r\n"))
            .unwrap_or_default();
        let request = format!(
            "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{auth}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
            body.len()
        );
        stream.write_all(request.as_bytes()).unwrap();
        let mut response = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => response.extend_from_slice(&buffer[..read]),
                Err(_) => break,
            }
        }
        String::from_utf8_lossy(&response).into_owned()
    }

    fn response_parts(response: &str) -> (u16, &str) {
        let (head, body) = response.split_once("\r\n\r\n").unwrap_or((response, ""));
        let status = head
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .and_then(|code| code.parse().ok())
            .unwrap_or(0);
        (status, body)
    }

    #[test]
    fn http_endpoint_enforces_auth_origin_and_serves_tools() {
        let token = "ainote_mcp_testtoken1234567890";
        let port = free_port();
        let token_state = Arc::new(RwLock::new(Some(token.to_string())));
        let mut handle = start(port, token_state, Arc::new(FakeExecutor)).unwrap();

        let unauthorized = raw_request(port, None, "{}", "");
        assert_eq!(response_parts(&unauthorized).0, 401);

        let legacy = format!(
            r#"{{"jsonrpc":"2.0","id":1,"method":"initialize","params":{{"protocolVersion":"2025-11-25"}}}}"#
        );
        let response = raw_request(port, Some(token), &legacy, "");
        let (status, body) = response_parts(&response);
        assert_eq!(status, 200);
        assert!(body.contains("2025-11-25"));
        assert!(body.contains("serverInfo"));

        let modern = r#"{"jsonrpc":"2.0","id":"m1","method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}"#;
        let response = raw_request(
            port,
            Some(token),
            modern,
            "MCP-Protocol-Version: 2026-07-28\r\nMcp-Method: tools/list\r\n",
        );
        let (status, body) = response_parts(&response);
        assert_eq!(status, 200, "{body}");
        assert!(body.contains("list_notes"));
        assert!(body.contains("\"cacheScope\":\"private\""));

        let mismatch = raw_request(
            port,
            Some(token),
            modern,
            "MCP-Protocol-Version: 2025-11-25\r\n",
        );
        assert_eq!(response_parts(&mismatch).0, 400);
        assert!(mismatch.contains("-32020"));

        let bad_origin = raw_request(
            port,
            Some(token),
            modern,
            "Origin: https://evil.example\r\n",
        );
        assert_eq!(response_parts(&bad_origin).0, 403);

        let call = r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_note","arguments":{"path":"a.md"},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}"#;
        let response = raw_request(
            port,
            Some(token),
            call,
            "MCP-Protocol-Version: 2026-07-28\r\nMcp-Method: tools/call\r\nMcp-Name: read_note\r\n",
        );
        let (status, body) = response_parts(&response);
        assert_eq!(status, 200, "{body}");
        assert!(body.contains("called read_note"));
        assert!(body.contains("\"isError\":false"));

        handle.stop();
    }

    #[test]
    fn get_is_rejected_and_notifications_are_accepted() {
        let token = "ainote_mcp_testtoken1234567890";
        let port = free_port();
        let token_state = Arc::new(RwLock::new(Some(token.to_string())));
        let mut handle = start(port, token_state, Arc::new(FakeExecutor)).unwrap();

        use std::io::{Read, Write};
        let mut stream = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream
            .write_all(format!("GET /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").as_bytes())
            .unwrap();
        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);
        assert!(response.starts_with("HTTP/1.1 405"), "{response}");

        let notification = r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#;
        let response = raw_request(port, Some(token), notification, "");
        assert_eq!(response_parts(&response).0, 202);

        handle.stop();
    }

    #[test]
    fn bearer_token_is_case_insensitive_and_trimmed() {
        assert_eq!(bearer_token("Bearer abc"), Some("abc"));
        assert_eq!(bearer_token("bearer  abc "), Some("abc"));
        assert_eq!(bearer_token("Basic abc"), None);
        assert_eq!(bearer_token("Bearer "), None);
    }

    #[test]
    fn constant_time_comparison_works() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"ab"));
    }

    #[test]
    fn origin_and_host_are_loopback_only() {
        assert!(origin_allowed("http://127.0.0.1:39471", 39471));
        assert!(origin_allowed("http://localhost:39471", 39471));
        assert!(!origin_allowed("https://evil.example", 39471));
        assert!(host_allowed("127.0.0.1:39471", 39471));
        assert!(!host_allowed("evil.example:39471", 39471));
    }

    #[test]
    fn errors_map_to_expected_http_status() {
        assert_eq!(error_status(protocol::ERR_PARSE), 400);
        assert_eq!(error_status(protocol::ERR_INVALID_PARAMS), 400);
        assert_eq!(error_status(protocol::ERR_METHOD_NOT_FOUND), 404);
        assert_eq!(error_status(protocol::ERR_INTERNAL), 500);
    }
