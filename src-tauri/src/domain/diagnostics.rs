use serde::Serialize;

/// 诊断包导出结果（返回给前端用于提示保存位置）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsExportDto {
    pub path: String,
    pub bytes: u64,
    pub files: Vec<String>,
}

/// 诊断包 `manifest.json`：只含版本与平台信息，不含路径与凭证。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsManifest {
    pub schema_version: u32,
    pub app_version: String,
    pub platform: String,
    pub arch: String,
    pub generated_at: String,
    pub files: Vec<String>,
}

/// 诊断包 `summary.json`：计数与状态摘要，不含笔记内容、路径或凭证。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSummary {
    pub repo_count: usize,
    pub has_active_repo: bool,
    pub has_token: bool,
    pub sync: DiagnosticsSyncSummary,
    pub repo_size_bytes: Option<u64>,
    pub error_counts: Vec<DiagnosticsErrorCount>,
    pub log_lines: usize,
}

#[derive(Debug, Serialize, Default, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSyncSummary {
    pub ahead: u32,
    pub behind: u32,
    pub has_uncommitted: bool,
    pub conflicted: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsErrorCount {
    pub code: String,
    pub count: usize,
}

/// 配置摘要：只有计数与布尔值，不含仓库路径或远端 URL。
#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsConfigSummary {
    pub repo_count: usize,
    pub has_active_repo: bool,
    pub has_token: bool,
}
