//! 客户端配置路径解析（纯逻辑 + 当前环境探测）。
//!
//! 路径规则集中在这里，便于单测跨平台分支，也避免 adapter 里散落 `HOME` / `APPDATA` 判断。

use std::path::PathBuf;

#[cfg(test)]
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ConfigEnv {
    pub home: PathBuf,
    /// Windows `%APPDATA%`；macOS `~/Library/Application Support`；Linux `$XDG_CONFIG_HOME` 或 `~/.config`。
    pub app_support: PathBuf,
}

impl ConfigEnv {
    pub fn current() -> Self {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .unwrap_or_default();
        let app_support = if cfg!(windows) {
            std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join("AppData").join("Roaming"))
        } else if cfg!(target_os = "macos") {
            home.join("Library").join("Application Support")
        } else {
            std::env::var_os("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".config"))
        };
        Self { home, app_support }
    }

    #[cfg(test)]
    pub fn for_test(home: &Path, app_support: &Path) -> Self {
        Self {
            home: home.to_path_buf(),
            app_support: app_support.to_path_buf(),
        }
    }

    fn vscode_user(&self) -> PathBuf {
        self.app_support.join("Code").join("User")
    }

    fn cursor_user(&self) -> PathBuf {
        self.app_support.join("Cursor").join("User")
    }
}

pub fn claude_code(env: &ConfigEnv) -> Vec<PathBuf> {
    vec![env.home.join(".claude.json")]
}

pub fn claude_desktop(env: &ConfigEnv) -> Vec<PathBuf> {
    vec![env
        .app_support
        .join("Claude")
        .join("claude_desktop_config.json")]
}

pub fn cursor(env: &ConfigEnv) -> Vec<PathBuf> {
    vec![env.home.join(".cursor").join("mcp.json")]
}

pub fn vscode(env: &ConfigEnv) -> Vec<PathBuf> {
    vec![env.vscode_user().join("mcp.json")]
}

pub fn windsurf(env: &ConfigEnv) -> Vec<PathBuf> {
    vec![
        env.home
            .join(".codeium")
            .join("windsurf")
            .join("mcp_config.json"),
        env.home.join(".codeium").join("mcp_config.json"),
    ]
}

pub fn cline(env: &ConfigEnv) -> Vec<PathBuf> {
    vec![
        env.home
            .join(".cline")
            .join("data")
            .join("settings")
            .join("cline_mcp_settings.json"),
        env.vscode_user()
            .join("globalStorage")
            .join("saoudrizwan.claude-dev")
            .join("settings")
            .join("cline_mcp_settings.json"),
        env.cursor_user()
            .join("globalStorage")
            .join("saoudrizwan.claude-dev")
            .join("settings")
            .join("cline_mcp_settings.json"),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env() -> ConfigEnv {
        ConfigEnv::for_test(Path::new("/home/u"), Path::new("/home/u/.config"))
    }

    #[test]
    fn paths_are_relative_to_home_or_app_support() {
        assert_eq!(claude_code(&env())[0], Path::new("/home/u/.claude.json"));
        assert_eq!(
            claude_desktop(&env())[0],
            Path::new("/home/u/.config/Claude/claude_desktop_config.json")
        );
        assert_eq!(
            cursor(&env())[0],
            Path::new("/home/u/.cursor/mcp.json")
        );
        assert_eq!(
            vscode(&env())[0],
            Path::new("/home/u/.config/Code/User/mcp.json")
        );
        assert_eq!(
            windsurf(&env())[0],
            Path::new("/home/u/.codeium/windsurf/mcp_config.json")
        );
        assert_eq!(cline(&env()).len(), 3);
    }
}
