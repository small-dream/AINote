//! Android 启动期 panic 可观测性：在 `.so` 加载时安装 panic hook，把 panic 文案直接写进 logcat。
//!
//! 背景：tao 把 Rust 的 stdout / stderr 重定向到 logcat（tag `RustStdoutStderr`）的动作发生在
//! `onFirstActivityCreate`；启动阶段 `Rust::onCreate` 里发生的 panic 早于它，此时 stderr 仍指向
//! `/dev/null`，logcat 里只剩 debuggerd 的 tombstone（`Java_..._Rust_onCreate` +
//! `panic_cannot_unwind`），看不到 panic 文案——v0.60.0 的「一打开就闪退」正是这样被埋掉的。
//!
//! 做法：
//! - `.init_array` 构造器（`System.loadLibrary` 时执行）安装 hook，早于任何 JNI 调用；
//! - panic 文案按行切块后经 `__android_log_write` 写入 logcat（tag `ainote::panic`）；
//! - 同时调用 bionic 的 `android_set_abort_message`，让 tombstone 的 `Abort message` 也带上首行摘要；
//! - 原 hook 仍然保留，避免改变 stderr / `RUST_BACKTRACE` 的既有行为。
//!
//! 除 `emit` / `set_abort_message` 外都是纯逻辑，因此在桌面端也参与编译与单测。

use std::panic::PanicHookInfo;
use std::sync::atomic::{AtomicBool, Ordering};

/// logcat 单条消息有长度上限（约 4 KB），按行累积到该阈值就切一条。
const CHUNK_BYTES: usize = 3000;
/// tombstone 的 `Abort message` 只保留首行摘要。
const ABORT_MESSAGE_LIMIT: usize = 480;
/// backtrace 帧数上限：启动期 panic 取前 64 行足够定位，避免刷屏。
const MAX_BACKTRACE_LINES: usize = 64;

/// 安装 hook（幂等）：库加载时由 `.init_array` 调用，`run()` 入口再兜底调用一次。
pub(crate) fn install() {
    static INSTALLED: AtomicBool = AtomicBool::new(false);
    if INSTALLED.swap(true, Ordering::SeqCst) {
        return;
    }
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log_panic(info);
        previous(info);
    }));
}

fn log_panic(info: &PanicHookInfo<'_>) {
    // hook 自身 panic（例如格式化时 OOM）时不再递归，直接交给原 hook 处理。
    static IN_HOOK: AtomicBool = AtomicBool::new(false);
    if IN_HOOK.swap(true, Ordering::SeqCst) {
        return;
    }
    let text = format_panic(info);
    for chunk in chunk_lines(&text, CHUNK_BYTES) {
        emit(&chunk);
    }
    set_abort_message(&text);
    IN_HOOK.store(false, Ordering::SeqCst);
}

/// 完整 panic 文案：位置、线程、消息与背压栈。纯函数，便于单测覆盖切块逻辑。
fn format_panic(info: &PanicHookInfo<'_>) -> String {
    let location = info.location().map_or_else(
        || "<unknown>".to_string(),
        |location| {
            format!(
                "{}:{}:{}",
                location.file(),
                location.line(),
                location.column()
            )
        },
    );
    let thread = std::thread::current();
    let thread_name = thread.name().unwrap_or("<unnamed>");
    let mut text = format!(
        "panicked at {location}\nthread '{thread_name}': {}\nbacktrace:\n",
        panic_message(info)
    );
    let backtrace = std::backtrace::Backtrace::force_capture().to_string();
    for line in backtrace.lines().take(MAX_BACKTRACE_LINES) {
        text.push_str(line);
        text.push('\n');
    }
    text
}

fn panic_message(info: &PanicHookInfo<'_>) -> String {
    let payload = info.payload();
    if let Some(message) = payload.downcast_ref::<&'static str>() {
        return (*message).to_string();
    }
    if let Some(message) = payload.downcast_ref::<String>() {
        return message.clone();
    }
    "<non-string panic payload>".to_string()
}

/// 按行切块：不在行中间断开，避免 logcat 把半行截断后更难读；
/// 单行自身超过 `limit` 时独占一条（由 logcat 截断，但行首信息仍完整）。
fn chunk_lines(text: &str, limit: usize) -> Vec<String> {
    let limit = limit.max(1);
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();
    for line in text.lines() {
        if !current.is_empty() && current.len() + line.len() + 1 > limit {
            chunks.push(std::mem::take(&mut current));
        }
        current.push_str(line);
        current.push('\n');
        if current.len() >= limit {
            chunks.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

#[cfg(target_os = "android")]
fn emit(text: &str) {
    use std::ffi::CString;
    use std::os::raw::{c_char, c_int};

    const ANDROID_LOG_ERROR: c_int = 6;
    const TAG: &str = "ainote::panic";

    #[link(name = "log")]
    unsafe extern "C" {
        fn __android_log_write(prio: c_int, tag: *const c_char, text: *const c_char) -> c_int;
    }

    let Ok(tag) = CString::new(TAG) else {
        return;
    };
    // 内嵌 NUL 会让 CString::new 失败；替换掉而不是丢弃这条日志。
    let Ok(message) = CString::new(text.trim_end_matches('\n').replace('\0', "\\0")) else {
        return;
    };
    // SAFETY: 两个 C 字符串在调用期间保持有效，liblog 只读取它们。
    unsafe {
        __android_log_write(ANDROID_LOG_ERROR, tag.as_ptr(), message.as_ptr());
    }
}

#[cfg(not(target_os = "android"))]
fn emit(_text: &str) {}

#[cfg(target_os = "android")]
fn set_abort_message(text: &str) {
    use std::ffi::CString;
    use std::os::raw::c_char;

    unsafe extern "C" {
        /// bionic（API 21+）：写入 tombstone 的 `Abort message`。
        fn android_set_abort_message(message: *const c_char);
    }

    let first_line = text.lines().next().unwrap_or("panic");
    let short: String = first_line
        .chars()
        .take(ABORT_MESSAGE_LIMIT)
        .collect::<String>()
        .replace('\0', " ");
    let Ok(message) = CString::new(short) else {
        return;
    };
    // SAFETY: bionic 会复制该字符串，指针在调用期间有效。
    unsafe { android_set_abort_message(message.as_ptr()) }
}

#[cfg(not(target_os = "android"))]
fn set_abort_message(_text: &str) {}

#[cfg(target_os = "android")]
#[used]
#[unsafe(link_section = ".init_array")]
static INSTALL_AT_LOAD: extern "C" fn() = install_at_load;

/// 构造器入口：`System.loadLibrary` 期间执行，早于 `Rust::onCreate`。
#[cfg(target_os = "android")]
extern "C" fn install_at_load() {
    install();
}

#[cfg(test)]
mod tests {
    use super::chunk_lines;

    #[test]
    fn keeps_short_text_in_one_chunk() {
        let chunks = chunk_lines("a\nb\nc\n", 100);
        assert_eq!(chunks, vec!["a\nb\nc\n".to_string()]);
    }

    #[test]
    fn empty_text_yields_no_chunk() {
        assert!(chunk_lines("", 100).is_empty());
    }

    #[test]
    fn splits_on_line_boundaries_without_losing_lines() {
        let text = "one\ntwo\nthree\nfour\n";
        let chunks = chunk_lines(text, 10);
        assert!(chunks.len() > 1, "应切成多条：{chunks:?}");
        for chunk in &chunks {
            assert!(chunk.len() <= 10 || chunk.lines().count() == 1, "{chunk:?}");
        }
        assert_eq!(chunks.concat(), text, "切块不能丢内容或改顺序");
    }

    #[test]
    fn oversized_single_line_gets_its_own_chunk() {
        let long = "x".repeat(50);
        let chunks = chunk_lines(&format!("head\n{long}\ntail\n"), 10);
        assert_eq!(chunks.len(), 3);
        assert!(chunks[1].starts_with("xxxx"));
    }
}
