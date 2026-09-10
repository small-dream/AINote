use serde::Serialize;

/// 完整性问题严重度：info 仅提示，warning 建议修复，error 必须处理。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
}

/// 单项完整性问题。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityIssue {
    pub code: String,
    pub severity: IssueSeverity,
    pub message: String,
    pub fix_hint: String,
}

/// 仓库完整性报告；`ok` 为 true 表示没有 error 级问题。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub ok: bool,
    pub issues: Vec<IntegrityIssue>,
}

/// 错误码 → 严重度（纯函数，统一口径）。
pub fn severity_for(code: &str) -> IssueSeverity {
    match code {
        "REPO_3101" | "REPO_3102" | "REPO_3103" | "REPO_3106" | "REPO_3107" => IssueSeverity::Error,
        "REPO_3104" => IssueSeverity::Warning,
        "REPO_3105" => IssueSeverity::Info,
        _ => IssueSeverity::Warning,
    }
}

/// 按错误码自动带上严重度构造问题。
pub fn issue(code: &str, message: impl Into<String>, fix_hint: impl Into<String>) -> IntegrityIssue {
    IntegrityIssue {
        code: code.to_string(),
        severity: severity_for(code),
        message: message.into(),
        fix_hint: fix_hint.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_codes_to_severity() {
        assert_eq!(severity_for("REPO_3101"), IssueSeverity::Error);
        assert_eq!(severity_for("REPO_3102"), IssueSeverity::Error);
        assert_eq!(severity_for("REPO_3103"), IssueSeverity::Error);
        assert_eq!(severity_for("REPO_3106"), IssueSeverity::Error);
        assert_eq!(severity_for("REPO_3107"), IssueSeverity::Error);
        assert_eq!(severity_for("REPO_3104"), IssueSeverity::Warning);
        assert_eq!(severity_for("REPO_3105"), IssueSeverity::Info);
    }

    #[test]
    fn unknown_code_defaults_to_warning() {
        assert_eq!(severity_for("REPO_3199"), IssueSeverity::Warning);
        assert_eq!(severity_for(""), IssueSeverity::Warning);
    }

    #[test]
    fn issue_carries_code_severity_and_hint() {
        let item = issue("REPO_3104", "missing origin", "re-add origin");
        assert_eq!(item.code, "REPO_3104");
        assert_eq!(item.severity, IssueSeverity::Warning);
        assert_eq!(item.message, "missing origin");
        assert_eq!(item.fix_hint, "re-add origin");
    }
}
