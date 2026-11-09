use std::path::Path;

/// 仓库相对路径统一用 `/` 分隔。
///
/// `Path::strip_prefix` 在 Windows 上返回带 `\` 的路径，与前端路径工具（`splitPath` /
/// `getDirectoryPath`）和 Markdown 链接的约定不一致：同一个文件会出现 `docs/a.md` 与
/// `docs\a.md` 两种 id。所有对外（前端、Markdown、清单文件）的仓库相对路径都必须经过这里。
pub fn to_slash(path: &Path) -> String {
    let mut out = String::new();
    for component in path.components() {
        if !out.is_empty() {
            out.push('/');
        }
        out.push_str(&component.as_os_str().to_string_lossy());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_flat_paths_unchanged() {
        assert_eq!(to_slash(Path::new("a.md")), "a.md");
        assert_eq!(to_slash(Path::new("docs/a.md")), "docs/a.md");
        assert_eq!(to_slash(Path::new("")), "");
    }

    #[test]
    fn normalizes_nested_components() {
        // Windows 的 join 会插入 `\`；作为字符串传入的 `/` 也必须保持 `/`。
        assert_eq!(to_slash(&Path::new("docs").join("a.md")), "docs/a.md");
        assert_eq!(to_slash(&Path::new("a/b").join("c.md")), "a/b/c.md");
    }

    #[test]
    fn keeps_unicode_and_spaces() {
        assert_eq!(to_slash(&Path::new("assets").join("图 1.png")), "assets/图 1.png");
    }
}
