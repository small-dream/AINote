//! Voice session orchestration: one active session, session-scoped native events, and explicit
//! finish/cancel semantics. A cancelled session may still produce a native final callback, but it
//! is never forwarded to the webview.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::domain::error::AppError;
use crate::domain::voice::{VoiceStreamEvent, VoiceStreamEventKind, VoiceSupportDto};
use crate::platform::voice::{transcriber, NativeEvent, Transcriber};

const POLL_INTERVAL: Duration = Duration::from_millis(150);
const FINAL_GRACE: Duration = Duration::from_millis(300);

pub type VoiceSink = Arc<dyn Fn(VoiceStreamEvent) + Send + Sync>;

struct Session {
    id: String,
    stopping: Arc<AtomicBool>,
    discard_final: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

struct SessionRegistry {
    current: Mutex<Option<Session>>,
}

impl SessionRegistry {
    fn new() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }

    fn lock(&self) -> MutexGuard<'_, Option<Session>> {
        self.current
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn clear(&self, session_id: &str) {
        let mut guard = self.lock();
        if guard
            .as_ref()
            .is_some_and(|session| session.id == session_id)
        {
            *guard = None;
        }
    }

    fn begin_stop(&self, session_id: &str, discard_final: bool) -> Option<Option<JoinHandle<()>>> {
        let mut guard = self.lock();
        let session = guard.as_mut()?;
        if session.id != session_id {
            return None;
        }
        session.stopping.store(true, Ordering::Release);
        if discard_final {
            session.discard_final.store(true, Ordering::Release);
        }
        Some(session.worker.take())
    }
}

pub struct VoiceService {
    transcriber: Arc<dyn Transcriber>,
    registry: Arc<SessionRegistry>,
}

impl VoiceService {
    fn new(transcriber: Arc<dyn Transcriber>) -> Self {
        Self {
            transcriber,
            registry: Arc::new(SessionRegistry::new()),
        }
    }

    fn support(&self) -> VoiceSupportDto {
        let support = self.transcriber.support();
        VoiceSupportDto {
            supported: support.supported,
            on_device: support.on_device,
            reason: support.reason.map(str::to_string),
        }
    }

    fn start(
        &self,
        session_id: String,
        locale: Option<String>,
        on_device: bool,
        sink: VoiceSink,
    ) -> Result<(), AppError> {
        if session_id.trim().is_empty() {
            return Err(AppError::VoiceUnavailable("invalidSession".into()));
        }
        {
            let mut guard = self.registry.lock();
            if guard.is_some() {
                return Err(AppError::VoiceBusy("voiceBusy".into()));
            }
            *guard = Some(Session {
                id: session_id.clone(),
                stopping: Arc::new(AtomicBool::new(false)),
                discard_final: Arc::new(AtomicBool::new(false)),
                worker: None,
            });
        }

        if let Err(err) = self
            .transcriber
            .start(&session_id, locale.as_deref(), on_device)
        {
            self.registry.clear(&session_id);
            return Err(err);
        }

        let mut guard = self.registry.lock();
        let Some(session) = guard.as_mut() else {
            drop(guard);
            let _ = self.transcriber.stop(&session_id);
            return Err(AppError::VoiceCancelled("cancelled".into()));
        };
        if session.id != session_id || session.stopping.load(Ordering::Acquire) {
            drop(guard);
            let _ = self.transcriber.stop(&session_id);
            self.registry.clear(&session_id);
            return Err(AppError::VoiceCancelled("cancelled".into()));
        }
        let worker = spawn_worker(
            session_id.clone(),
            Arc::clone(&session.stopping),
            Arc::clone(&session.discard_final),
            Arc::clone(&self.transcriber),
            Arc::clone(&self.registry),
            sink,
        );
        match worker {
            Ok(worker) => {
                session.worker = Some(worker);
                Ok(())
            }
            Err(err) => {
                let _ = guard.take();
                drop(guard);
                let _ = self.transcriber.stop(&session_id);
                Err(AppError::VoiceUnavailable(format!("workerStart: {err}")))
            }
        }
    }

    fn stop(&self, session_id: &str, discard_final: bool) -> Result<(), AppError> {
        let Some(worker) = self.registry.begin_stop(session_id, discard_final) else {
            return Ok(());
        };
        if let Err(err) = self.transcriber.stop(session_id) {
            log::warn!(target: "ainote::voice", "stop native recognizer failed: {err}");
        }
        if let Some(worker) = worker {
            let _ = worker.join();
        }
        self.registry.clear(session_id);
        Ok(())
    }
}

static SERVICE: OnceLock<Arc<VoiceService>> = OnceLock::new();

pub fn service() -> Arc<VoiceService> {
    Arc::clone(SERVICE.get_or_init(|| Arc::new(VoiceService::new(transcriber()))))
}

pub fn support() -> Result<VoiceSupportDto, AppError> {
    Ok(service().support())
}

pub fn start(
    session_id: String,
    locale: Option<String>,
    on_device: bool,
    sink: VoiceSink,
) -> Result<(), AppError> {
    service().start(session_id, locale, on_device, sink)
}

pub fn finish(session_id: &str) -> Result<(), AppError> {
    service().stop(session_id, false)
}

pub fn cancel(session_id: &str) -> Result<(), AppError> {
    service().stop(session_id, true)
}

fn spawn_worker(
    session_id: String,
    stopping: Arc<AtomicBool>,
    discard_final: Arc<AtomicBool>,
    transcriber: Arc<dyn Transcriber>,
    registry: Arc<SessionRegistry>,
    sink: VoiceSink,
) -> std::io::Result<JoinHandle<()>> {
    thread::Builder::new()
        .name("voice-input".into())
        .spawn(move || {
            run_session(
                session_id,
                stopping,
                discard_final,
                transcriber,
                registry,
                sink,
            )
        })
}

fn run_session(
    session_id: String,
    stopping: Arc<AtomicBool>,
    discard_final: Arc<AtomicBool>,
    transcriber: Arc<dyn Transcriber>,
    registry: Arc<SessionRegistry>,
    sink: VoiceSink,
) {
    loop {
        let ended = forward_events(&session_id, &discard_final, &transcriber, &sink);
        if ended {
            if !stopping.load(Ordering::Acquire) {
                let _ = transcriber.stop(&session_id);
                registry.clear(&session_id);
            }
            return;
        }
        if stopping.load(Ordering::Acquire) {
            thread::sleep(FINAL_GRACE);
            let ended = forward_events(&session_id, &discard_final, &transcriber, &sink);
            if !ended {
                send(&sink, &session_id, VoiceStreamEventKind::Stopped);
            }
            return;
        }
        thread::sleep(POLL_INTERVAL);
    }
}

fn forward_events(
    session_id: &str,
    discard_final: &AtomicBool,
    transcriber: &Arc<dyn Transcriber>,
    sink: &VoiceSink,
) -> bool {
    let mut ended = false;
    for event in transcriber.poll(session_id) {
        match event {
            NativeEvent::Partial(text) => {
                send(sink, session_id, VoiceStreamEventKind::Partial { text });
            }
            NativeEvent::Final(text) if !discard_final.load(Ordering::Acquire) => {
                send(sink, session_id, VoiceStreamEventKind::Final { text });
            }
            NativeEvent::Final(_) => {}
            NativeEvent::Permission(granted) => {
                send(
                    sink,
                    session_id,
                    VoiceStreamEventKind::Permission { granted },
                );
            }
            NativeEvent::Failure { code, message } => {
                send(
                    sink,
                    session_id,
                    VoiceStreamEventKind::Failed { code, message },
                );
                send(sink, session_id, VoiceStreamEventKind::Stopped);
                ended = true;
            }
            NativeEvent::Stopped => {
                send(sink, session_id, VoiceStreamEventKind::Stopped);
                ended = true;
            }
        }
    }
    ended
}

fn send(sink: &VoiceSink, session_id: &str, event: VoiceStreamEventKind) {
    sink(VoiceStreamEvent {
        session_id: session_id.to_string(),
        event,
    });
}

#[cfg(test)]
#[path = "voice_service_tests.rs"]
mod tests;
