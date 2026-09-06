//! SSE 流式结果解析：区分正文与推理字段，避免推理过程混入笔记。

#[derive(Debug, Default, PartialEq, Eq)]
pub struct SseDelta {
    pub content: Option<String>,
    pub reasoning: Option<String>,
}

#[derive(Debug, Default)]
pub struct StreamAssembler {
    text: String,
    reasoning: String,
    has_content: bool,
}

impl StreamAssembler {
    pub fn push(&mut self, delta: SseDelta, on_delta: &mut dyn FnMut(&str)) {
        if let Some(text) = delta.content.filter(|text| !text.is_empty()) {
            self.has_content = true;
            self.text.push_str(&text);
            on_delta(&text);
            return;
        }
        if let Some(text) = delta.reasoning.filter(|text| !text.is_empty()) {
            self.reasoning.push_str(&text);
        }
    }

    pub fn finish(mut self, on_delta: &mut dyn FnMut(&str)) -> String {
        if !self.has_content && !self.reasoning.is_empty() {
            self.text = std::mem::take(&mut self.reasoning);
            on_delta(&self.text);
        }
        self.text
    }
}

/// 解析一行 SSE；正文与推理分别返回，供调用方按正文优先级合并。
pub fn parse_sse_delta(line: &str) -> Option<SseDelta> {
    let data = line.trim().strip_prefix("data:")?.trim();
    if data == "[DONE]" {
        return None;
    }
    let json: serde_json::Value = serde_json::from_str(data).ok()?;
    let delta = json.get("choices")?.as_array()?.first()?.get("delta")?;
    Some(SseDelta {
        content: string_field(delta, "content"),
        reasoning: delta
            .get("reasoning_content")
            .or_else(|| delta.get("reasoning"))
            .and_then(|value| value.as_str())
            .map(str::to_owned),
    })
}

fn string_field(delta: &serde_json::Value, key: &str) -> Option<String> {
    delta
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn collect_lines(lines: &[&str]) -> (String, String) {
        let mut assembler = StreamAssembler::default();
        let mut collected = String::new();
        for line in lines {
            if let Some(delta) = parse_sse_delta(line) {
                assembler.push(delta, &mut |delta| collected.push_str(delta));
            }
        }
        let full = assembler.finish(&mut |delta| collected.push_str(delta));
        (full, collected)
    }

    #[test]
    fn ignores_reasoning_when_content_arrives() {
        let (text, collected) = collect_lines(&[
            "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"思考\"}}]}",
            "data: {\"choices\":[{\"delta\":{\"content\":\"正文\"}}]}",
        ]);
        assert_eq!(text, "正文");
        assert_eq!(collected, "正文");
    }

    #[test]
    fn uses_reasoning_only_when_content_is_absent() {
        let (text, collected) = collect_lines(&[
            "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"审查\"}}]}",
            "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"报告\"}}]}",
        ]);
        assert_eq!(text, "审查报告");
        assert_eq!(collected, "审查报告");
    }

    #[test]
    fn parses_content_and_reasoning_separately() {
        let delta = parse_sse_delta(
            "data: {\"choices\":[{\"delta\":{\"content\":\"正文\",\"reasoning\":\"思考\"}}]}",
        )
        .unwrap();
        assert_eq!(delta.content.as_deref(), Some("正文"));
        assert_eq!(delta.reasoning.as_deref(), Some("思考"));
    }

    #[test]
    fn ignores_non_data_lines() {
        assert!(parse_sse_delta("event: message").is_none());
        assert!(parse_sse_delta("data: not-json").is_none());
    }
}
