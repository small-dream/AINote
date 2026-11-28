use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use block2::RcBlock;
use objc2::rc::Retained;
use objc2_avf_audio::AVAudioEngine;
use objc2_foundation::NSError;
use objc2_speech::{
    SFSpeechAudioBufferRecognitionRequest, SFSpeechRecognitionResult, SFSpeechRecognitionTask,
    SFSpeechRecognizer,
};

use crate::platform::voice::NativeEvent;

/// Marks framework objects as transferable between the lock-protected session owner and framework
/// callbacks. Every access is serialized by the session/slot mutexes.
pub(super) struct Shared<T>(pub(super) Retained<T>);
unsafe impl<T> Send for Shared<T> {}
unsafe impl<T> Sync for Shared<T> {}
impl<T> std::ops::Deref for Shared<T> {
    type Target = Retained<T>;
    fn deref(&self) -> &Retained<T> {
        &self.0
    }
}

pub(super) struct ActiveRequest {
    pub(super) request: Shared<SFSpeechAudioBufferRecognitionRequest>,
    #[allow(dead_code)]
    pub(super) task: Shared<SFSpeechRecognitionTask>,
}

pub(super) struct AppleSession {
    pub(super) engine: Shared<AVAudioEngine>,
    pub(super) slot: Arc<Mutex<Option<ActiveRequest>>>,
    pub(super) queue: Arc<Mutex<Vec<NativeEvent>>>,
    pub(super) active: Arc<AtomicBool>,
    pub(super) done: Arc<(Mutex<bool>, Condvar)>,
}

/// Start one recognition segment and keep it alive until its final callback replaces it.
pub(super) fn spawn_request(
    recognizer: &Retained<SFSpeechRecognizer>,
    on_device: bool,
    slot: &Arc<Mutex<Option<ActiveRequest>>>,
    queue: &Arc<Mutex<Vec<NativeEvent>>>,
    active: &Arc<AtomicBool>,
    done: &Arc<(Mutex<bool>, Condvar)>,
) {
    unsafe {
        let request = SFSpeechAudioBufferRecognitionRequest::new();
        request.setShouldReportPartialResults(true);
        request.setRequiresOnDeviceRecognition(on_device);
        let block_recognizer = recognizer.clone();
        let block_slot = Arc::clone(slot);
        let block_queue = Arc::clone(queue);
        let block_active = Arc::clone(active);
        let block_done = Arc::clone(done);
        let on_result = RcBlock::new(
            move |result: *mut SFSpeechRecognitionResult, error: *mut NSError| {
                handle_result(
                    result,
                    error,
                    &block_recognizer,
                    on_device,
                    &block_slot,
                    &block_queue,
                    &block_active,
                    &block_done,
                );
            },
        );
        let task = recognizer.recognitionTaskWithRequest_resultHandler(&request, &on_result);
        *slot.lock().unwrap_or_else(poisoned) = Some(ActiveRequest {
            request: Shared(request),
            task: Shared(task),
        });
    }
}

fn handle_result(
    result: *mut SFSpeechRecognitionResult,
    error: *mut NSError,
    recognizer: &Retained<SFSpeechRecognizer>,
    on_device: bool,
    slot: &Arc<Mutex<Option<ActiveRequest>>>,
    queue: &Arc<Mutex<Vec<NativeEvent>>>,
    active: &Arc<AtomicBool>,
    done: &Arc<(Mutex<bool>, Condvar)>,
) {
    unsafe {
        if !error.is_null() {
            let code = (*error).code().to_string();
            let message = (*error).localizedDescription().to_string();
            if active.load(Ordering::Relaxed) {
                push(queue, NativeEvent::Failure { code, message });
            }
            active.store(false, Ordering::Relaxed);
            if let Some(current) = slot.lock().unwrap_or_else(poisoned).take() {
                current.request.endAudio();
            }
            push(queue, NativeEvent::Stopped);
            mark_done(done);
            return;
        }
        if result.is_null() {
            return;
        }
        let text = (*result).bestTranscription().formattedString().to_string();
        if text.is_empty() {
            return;
        }
        if (*result).isFinal() {
            push(queue, NativeEvent::Final(text));
            if active.load(Ordering::Relaxed) {
                spawn_request(recognizer, on_device, slot, queue, active, done);
            } else {
                push(queue, NativeEvent::Stopped);
                mark_done(done);
            }
        } else {
            push(queue, NativeEvent::Partial(text));
        }
    }
}

pub(super) fn mark_done(done: &Arc<(Mutex<bool>, Condvar)>) {
    let (lock, condvar) = &**done;
    *lock.lock().unwrap_or_else(poisoned) = true;
    condvar.notify_all();
}

pub(super) fn wait_for_result(done: &Arc<(Mutex<bool>, Condvar)>, timeout: Duration) -> bool {
    let (lock, condvar) = &**done;
    let deadline = Instant::now() + timeout;
    let mut finished = lock.lock().unwrap_or_else(poisoned);
    while !*finished {
        let now = Instant::now();
        if now >= deadline {
            break;
        }
        finished = condvar
            .wait_timeout(finished, deadline - now)
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .0;
    }
    *finished
}

pub(super) fn push(queue: &Arc<Mutex<Vec<NativeEvent>>>, event: NativeEvent) {
    queue.lock().unwrap_or_else(poisoned).push(event);
}

pub(super) fn poisoned<'a, T>(poisoned: PoisonError<MutexGuard<'a, T>>) -> MutexGuard<'a, T> {
    poisoned.into_inner()
}
