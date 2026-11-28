//! Android 系统语音识别（`SpeechRecognizer`，on-device 优先）。
//! 原生实现见 `src-tauri/gen/android/app/src/main/java/dev/ainote/app/VoiceInput.kt`
//! （识别、权限弹窗、事件队列都在 Kotlin 侧，本文件只做 JNI 编解码与协议映射）。
//! 事件经 `poll` 轮询取回：服务层每 150ms 拉一次，避免在任意 Kotlin 线程上做 JNI 反向回调。

use jni::objects::{JString, JValue};

use crate::domain::error::AppError;
use crate::platform::android_jni::{app_class, with_application_context};
use crate::platform::voice::{
    parse_events, parse_start, parse_support, NativeEvent, Transcriber, VoiceSupport,
};

const VOICE_CLASS: &str = "dev/ainote/app/VoiceInput";
const PROBE_SIG: &str = "(Landroid/content/Context;)Ljava/lang/String;";
const START_SIG: &str =
    "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Z)Ljava/lang/String;";
const STOP_SIG: &str = "(Landroid/content/Context;Ljava/lang/String;)Ljava/lang/String;";
const POLL_SIG: &str = "(Landroid/content/Context;)Ljava/lang/String;";

pub(super) struct AndroidTranscriber;

impl AndroidTranscriber {
    pub(super) fn new() -> Self {
        Self
    }
}

impl Transcriber for AndroidTranscriber {
    fn support(&self) -> VoiceSupport {
        match call("probe", PROBE_SIG, "探测语音识别能力", CallArgs::None) {
            Ok(raw) => parse_support(&raw),
            Err(err) => {
                log::warn!(target: "ainote::voice", "语音识别能力探测失败，按不支持处理: {err}");
                VoiceSupport::unavailable("probeFailed")
            }
        }
    }

    fn start(
        &self,
        session_id: &str,
        locale: Option<&str>,
        on_device: bool,
    ) -> Result<(), AppError> {
        // None 交给 Kotlin 侧跟随系统语言。
        let raw = call(
            "start",
            START_SIG,
            "启动语音识别",
            CallArgs::Start(session_id, locale.unwrap_or(""), on_device),
        )?;
        match parse_start(&raw) {
            // `pending:permission` 也算启动成功：权限结果与后续事件都经 poll 上报。
            Ok(_) => Ok(()),
            Err(reason) => Err(AppError::VoiceUnavailable(format!(
                "启动语音识别失败: {reason}"
            ))),
        }
    }

    fn stop(&self, session_id: &str) -> Result<(), AppError> {
        call(
            "stop",
            STOP_SIG,
            "停止语音识别",
            CallArgs::Session(session_id),
        )
        .map(|_| ())
    }

    fn poll(&self, session_id: &str) -> Vec<NativeEvent> {
        match call("poll", POLL_SIG, "读取识别事件", CallArgs::None) {
            Ok(raw) => parse_events(&raw, session_id),
            Err(err) => {
                log::warn!(target: "ainote::voice", "读取识别事件失败: {err}");
                Vec::new()
            }
        }
    }
}

enum CallArgs<'a> {
    None,
    Session(&'a str),
    Start(&'a str, &'a str, bool),
}

fn call(
    method: &str,
    signature: &str,
    action: &str,
    call_args: CallArgs<'_>,
) -> Result<String, AppError> {
    let voice_error =
        move |message: String| AppError::VoiceUnavailable(format!("{action}: {message}"));
    with_application_context(action, &voice_error, |env, context| {
        let class = app_class(env, context, VOICE_CLASS, action, &voice_error)?;
        let mut args: Vec<JValue> = vec![JValue::Object(context)];
        // JString 借用必须活到 call_static_method 之后，先存进 Vec 保持存活（同 quick_unlock 的做法）。
        let mut owned_strings: Vec<JString> = Vec::new();
        match call_args {
            CallArgs::None => {}
            CallArgs::Session(session_id) => {
                owned_strings.push(
                    env.new_string(session_id)
                        .map_err(|err| voice_error(err.to_string()))?,
                );
                args.push(JValue::Object(&owned_strings[0]));
            }
            CallArgs::Start(session_id, locale, on_device) => {
                owned_strings.push(
                    env.new_string(session_id)
                        .map_err(|err| voice_error(err.to_string()))?,
                );
                owned_strings.push(
                    env.new_string(locale)
                        .map_err(|err| voice_error(err.to_string()))?,
                );
                args.push(JValue::Object(&owned_strings[0]));
                args.push(JValue::Object(&owned_strings[1]));
                args.push(JValue::Bool(on_device.into()));
            }
        }
        let value = env
            .call_static_method(&class, method, signature, &args)
            .map_err(|err| voice_error(err.to_string()))?;
        let text = JString::from(value.l().map_err(|err| voice_error(err.to_string()))?);
        env.get_string(&text)
            .map(|value| value.into())
            .map_err(|err| voice_error(err.to_string()))
    })
}
