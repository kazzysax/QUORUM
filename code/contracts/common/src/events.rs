//! NEP-297 events. Every money movement and state change emits one so the
//! indexer never has to guess.

use near_sdk::serde_json::{json, Value};

pub const STANDARD: &str = "quorum";
pub const VERSION: &str = "1.0.0";

pub fn emit(event: &str, data: Value) {
    let log = json!({
        "standard": STANDARD,
        "version": VERSION,
        "event": event,
        "data": [data],
    });
    near_sdk::log!("EVENT_JSON:{}", log);
}
