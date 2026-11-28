use std::sync::{Arc, Mutex};

use super::*;
use crate::platform::voice::VoiceSupport;

struct MockTranscriber {
    events: Mutex<Vec<NativeEvent>>,
    stop_events: Mutex<Vec<NativeEvent>>,
    stops: Mutex<Vec<String>>,
}

impl MockTranscriber {
    fn new(stop_events: Vec<NativeEvent>) -> Self {
        Self {
            events: Mutex::new(Vec::new()),
            stop_events: Mutex::new(stop_events),
            stops: Mutex::new(Vec::new()),
        }
    }
}

impl Transcriber for MockTranscriber {
    fn support(&self) -> VoiceSupport {
        VoiceSupport::available(true)
    }

    fn start(
        &self,
        _session_id: &str,
        _locale: Option<&str>,
        _on_device: bool,
    ) -> Result<(), AppError> {
        Ok(())
    }

    fn stop(&self, session_id: &str) -> Result<(), AppError> {
        self.stops.lock().unwrap().push(session_id.to_string());
        self.events
            .lock()
            .unwrap()
            .append(&mut self.stop_events.lock().unwrap());
        Ok(())
    }

    fn poll(&self, _session_id: &str) -> Vec<NativeEvent> {
        std::mem::take(&mut *self.events.lock().unwrap())
    }
}

fn recording_sink() -> (VoiceSink, Arc<Mutex<Vec<VoiceStreamEvent>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let target = Arc::clone(&events);
    let sink: VoiceSink = Arc::new(move |event| target.lock().unwrap().push(event));
    (sink, events)
}

#[test]
fn cancel_discards_native_final_but_still_stops() {
    let transcriber = Arc::new(MockTranscriber::new(vec![
        NativeEvent::Final("late final".into()),
        NativeEvent::Stopped,
    ]));
    let service = VoiceService::new(transcriber.clone());
    let (sink, events) = recording_sink();
    service.start("s1".into(), None, true, sink).unwrap();

    service.stop("s1", true).unwrap();

    let events = events.lock().unwrap();
    assert!(!events
        .iter()
        .any(|event| matches!(event.event, VoiceStreamEventKind::Final { .. })));
    assert!(events
        .iter()
        .any(|event| matches!(event.event, VoiceStreamEventKind::Stopped)));
    assert_eq!(transcriber.stops.lock().unwrap().as_slice(), ["s1"]);
}

#[test]
fn finish_forwards_native_final() {
    let transcriber = Arc::new(MockTranscriber::new(vec![
        NativeEvent::Final("final text".into()),
        NativeEvent::Stopped,
    ]));
    let service = VoiceService::new(transcriber);
    let (sink, events) = recording_sink();
    service.start("s1".into(), None, true, sink).unwrap();

    service.stop("s1", false).unwrap();

    let finals: Vec<_> = events
        .lock()
        .unwrap()
        .iter()
        .filter_map(|event| match &event.event {
            VoiceStreamEventKind::Final { text } => Some(text.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(finals, ["final text"]);
}

#[test]
fn stale_session_id_cannot_stop_current_session() {
    let transcriber = Arc::new(MockTranscriber::new(vec![NativeEvent::Stopped]));
    let service = VoiceService::new(transcriber.clone());
    let (sink, _) = recording_sink();
    service.start("s1".into(), None, true, sink).unwrap();

    service.stop("other", false).unwrap();
    assert!(transcriber.stops.lock().unwrap().is_empty());

    service.stop("s1", true).unwrap();
}
