//! iOS 系统语音识别：`SFSpeechRecognizer`（on-device 优先）+ `AVAudioEngine` 采集。
//! 对齐 `quick_unlock::apple` 的纯 Rust 路线（不在 gen/apple 里加 Swift，便于与桌面共享构建链）。
//!
//! 授权链路：语音识别授权（`requestAuthorization`，读 Info.plist 的
//! `NSSpeechRecognitionUsageDescription`）与麦克风授权（`requestRecordPermission`，
//! `NSMicrophoneUsageDescription`）都在 `start` 里弹出；`support` 探测无副作用。
//! 定稿后自动换新识别段续听，支持连续口述；引擎错误以事件上报，由服务层收尾。

use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::Duration;

use block2::RcBlock;
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::Bool;
use objc2::AnyThread;
use objc2_avf_audio::{
    AVAudioEngine, AVAudioPCMBuffer, AVAudioSession, AVAudioSessionCategoryRecord, AVAudioTime,
};
use objc2_foundation::{NSLocale, NSString};
use objc2_speech::{SFSpeechRecognizer, SFSpeechRecognizerAuthorizationStatus};

use crate::domain::error::AppError;
use crate::platform::voice::{NativeEvent, Transcriber, VoiceSupport};

#[path = "apple_session.rs"]
mod apple_session;
use apple_session::{
    mark_done, poisoned, push, spawn_request, wait_for_result, ActiveRequest, AppleSession, Shared,
};

/// 授权弹窗等待上限：用户长时间不理会时不能永久占住后台线程（同 quick_unlock 的口径）。
const AUTH_TIMEOUT: Duration = Duration::from_secs(120);
/// 采集 tap 的缓冲大小（帧）：SFSpeech 官方示例用 1024，兼顾延迟与调用频率。
const TAP_BUFFER_FRAMES: u32 = 1024;

static SESSION: Mutex<Option<AppleSession>> = Mutex::new(None);

pub(super) struct AppleTranscriber;

impl AppleTranscriber {
    pub(super) fn new() -> Self {
        Self
    }
}

impl Transcriber for AppleTranscriber {
    fn support(&self) -> VoiceSupport {
        autoreleasepool(|_| {
            let status = unsafe { SFSpeechRecognizer::authorizationStatus() };
            if status == SFSpeechRecognizerAuthorizationStatus::Denied
                || status == SFSpeechRecognizerAuthorizationStatus::Restricted
            {
                return VoiceSupport::unavailable("denied");
            }
            match default_recognizer() {
                Some(recognizer) if unsafe { recognizer.isAvailable() } => {
                    VoiceSupport::available(unsafe { recognizer.supportsOnDeviceRecognition() })
                }
                _ => VoiceSupport::unavailable("noService"),
            }
        })
    }

    fn start(
        &self,
        _session_id: &str,
        locale: Option<&str>,
        on_device: bool,
    ) -> Result<(), AppError> {
        autoreleasepool(|_| {
            if lock_session().is_some() {
                return Err(AppError::VoiceBusy("语音识别已在进行中".to_string()));
            }
            ensure_speech_authorized()?;
            ensure_mic_permission()?;
            let recognizer = recognizer_for(locale)?;
            if on_device && !unsafe { recognizer.supportsOnDeviceRecognition() } {
                return Err(AppError::VoiceUnavailable(
                    "当前语言不支持本机识别，请改用联网识别".to_string(),
                ));
            }
            configure_audio_session()?;
            let queue = Arc::new(Mutex::new(Vec::<NativeEvent>::new()));
            let active = Arc::new(AtomicBool::new(true));
            let done = Arc::new((Mutex::new(false), Condvar::new()));
            let slot: Arc<Mutex<Option<ActiveRequest>>> = Arc::new(Mutex::new(None));

            let engine = unsafe { AVAudioEngine::new() };
            unsafe {
                let input = engine.inputNode();
                let format = input.outputFormatForBus(0);
                let tap_slot = Arc::clone(&slot);
                let tap = RcBlock::new(
                    move |buffer: NonNull<AVAudioPCMBuffer>, _when: NonNull<AVAudioTime>| {
                        if let Some(current) = tap_slot.lock().unwrap_or_else(poisoned).as_ref() {
                            current.request.appendAudioPCMBuffer(buffer.as_ref());
                        }
                    },
                );
                engine.prepare();
                input.installTapOnBus_bufferSize_format_block(
                    0,
                    TAP_BUFFER_FRAMES,
                    Some(&format),
                    &*tap as *const _ as *mut _,
                );
                engine.startAndReturnError().map_err(|err| {
                    AppError::VoiceUnavailable(format!("启动音频引擎失败: {err}"))
                })?;
            }
            spawn_request(&recognizer, on_device, &slot, &queue, &active, &done);
            *lock_session() = Some(AppleSession {
                engine: Shared(engine),
                slot,
                queue,
                active,
                done,
            });
            Ok(())
        })
    }

    fn stop(&self, _session_id: &str) -> Result<(), AppError> {
        let mut guard = lock_session();
        let Some(session) = guard.as_mut() else {
            return Ok(());
        };
        session.active.store(false, Ordering::Relaxed);
        if let Some(current) = session.slot.lock().unwrap_or_else(poisoned).take() {
            unsafe { current.request.endAudio() };
        }
        unsafe {
            session.engine.inputNode().removeTapOnBus(0);
            session.engine.stop();
            session.engine.reset();
        }
        if !wait_for_result(&session.done, Duration::from_millis(1500)) {
            push(&session.queue, NativeEvent::Stopped);
            mark_done(&session.done);
        }
        deactivate_audio_session();
        Ok(())
    }

    fn poll(&self, _session_id: &str) -> Vec<NativeEvent> {
        let mut guard = lock_session();
        let Some(session) = guard.as_ref() else {
            return Vec::new();
        };
        let events = std::mem::take(&mut *session.queue.lock().unwrap_or_else(poisoned));
        let ended = events
            .iter()
            .any(|event| matches!(event, NativeEvent::Stopped));
        if ended {
            let session = guard.take().expect("voice session checked above");
            session.active.store(false, Ordering::Relaxed);
            if let Some(current) = session.slot.lock().unwrap_or_else(poisoned).take() {
                unsafe { current.request.endAudio() };
            }
            unsafe {
                session.engine.inputNode().removeTapOnBus(0);
                session.engine.stop();
                session.engine.reset();
            }
            deactivate_audio_session();
            drop(session);
        }
        events
    }
}

fn configure_audio_session() -> Result<(), AppError> {
    unsafe {
        let session = AVAudioSession::sharedInstance();
        // AVAudioSessionCategoryRecord 由系统提供，静态永不缺失；unwrap 只是形式上的 Option。
        let category = AVAudioSessionCategoryRecord.unwrap();
        session
            .setCategory_error(category)
            .map_err(|err| AppError::VoiceUnavailable(format!("录音会话配置失败: {err}")))?;
        session
            .setActive_error(true)
            .map_err(|err| AppError::VoiceUnavailable(format!("录音会话激活失败: {err}")))?;
    }
    Ok(())
}

fn deactivate_audio_session() {
    unsafe {
        let _ = AVAudioSession::sharedInstance().setActive_error(false);
    }
}

/// 组装识别器：指定语言用 `initWithLocaleIdentifier`，None 跟随系统。
fn recognizer_for(locale: Option<&str>) -> Result<Retained<SFSpeechRecognizer>, AppError> {
    let recognizer = match locale {
        Some(id) => {
            let identifier = NSString::from_str(id);
            unsafe {
                let locale = NSLocale::initWithLocaleIdentifier(NSLocale::alloc(), &identifier);
                SFSpeechRecognizer::initWithLocale(SFSpeechRecognizer::alloc(), &locale)
            }
        }
        None => unsafe { SFSpeechRecognizer::init(SFSpeechRecognizer::alloc()) },
    };
    match recognizer {
        Some(recognizer) if unsafe { recognizer.isAvailable() } => Ok(recognizer),
        _ => Err(AppError::VoiceUnavailable(
            "当前设备或语言不支持语音识别".to_string(),
        )),
    }
}

fn default_recognizer() -> Option<Retained<SFSpeechRecognizer>> {
    unsafe { SFSpeechRecognizer::init(SFSpeechRecognizer::alloc()) }
}

fn ensure_speech_authorized() -> Result<(), AppError> {
    let status = unsafe { SFSpeechRecognizer::authorizationStatus() };
    match status {
        SFSpeechRecognizerAuthorizationStatus::Authorized => Ok(()),
        SFSpeechRecognizerAuthorizationStatus::Denied
        | SFSpeechRecognizerAuthorizationStatus::Restricted => Err(AppError::VoiceUnavailable(
            "语音识别授权被拒绝，请到系统设置 → AINote → 语音识别开启".to_string(),
        )),
        SFSpeechRecognizerAuthorizationStatus::NotDetermined => {
            let (sender, receiver) = mpsc::channel();
            let reply = RcBlock::new(move |granted: SFSpeechRecognizerAuthorizationStatus| {
                let _ = sender.send(granted);
            });
            unsafe { SFSpeechRecognizer::requestAuthorization(&reply) };
            match receiver.recv_timeout(AUTH_TIMEOUT) {
                Ok(SFSpeechRecognizerAuthorizationStatus::Authorized) => Ok(()),
                Ok(_) => Err(AppError::VoiceUnavailable(
                    "语音识别授权被拒绝，请到系统设置 → AINote → 语音识别开启".to_string(),
                )),
                Err(_) => Err(AppError::VoiceUnavailable(
                    "语音识别授权等待超时，请重试".to_string(),
                )),
            }
        }
        _ => Err(AppError::VoiceUnavailable(
            "语音识别授权状态未知".to_string(),
        )),
    }
}

fn ensure_mic_permission() -> Result<(), AppError> {
    let (sender, receiver) = mpsc::channel();
    let reply = RcBlock::new(move |granted: Bool| {
        let _ = sender.send(granted.as_bool());
    });
    #[allow(deprecated)]
    unsafe {
        AVAudioSession::sharedInstance().requestRecordPermission(&reply);
    }
    match receiver.recv_timeout(AUTH_TIMEOUT) {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::VoiceMicDenied(
            "麦克风权限被拒绝，请到系统设置 → AINote → 麦克风开启".to_string(),
        )),
        Err(_) => Err(AppError::VoiceMicDenied(
            "麦克风授权等待超时，请重试".to_string(),
        )),
    }
}

fn lock_session() -> MutexGuard<'static, Option<AppleSession>> {
    match SESSION.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}
