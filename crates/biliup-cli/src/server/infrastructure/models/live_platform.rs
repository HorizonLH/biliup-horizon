use ormlite::{Insert, Model};
use serde::{Deserialize, Serialize};

pub const ROOM_ID_PLACEHOLDER: &str = "{room_id}";

#[derive(Model, Debug, Clone, Serialize, Deserialize)]
#[ormlite(table = "liveplatforms")]
pub struct LivePlatform {
    #[ormlite(primary_key)]
    pub id: i64,
    pub name: String,
    pub url_template: String,
    pub audio_only: bool,
    pub cover_path: Option<String>,
}

#[derive(Model, Insert, Debug, Clone, Serialize, Deserialize)]
#[ormlite(table = "liveplatforms", returns = "LivePlatform")]
pub struct InsertLivePlatform {
    pub id: Option<i64>,
    pub name: String,
    pub url_template: String,
    pub audio_only: bool,
    pub cover_path: Option<String>,
}

impl LivePlatform {
    pub fn room_url(&self, room_id: &str) -> String {
        self.url_template.replace(ROOM_ID_PLACEHOLDER, room_id)
    }
}

#[cfg(test)]
mod tests {
    use super::LivePlatform;

    #[test]
    fn room_url_replaces_the_configured_placeholder() {
        let platform = LivePlatform {
            id: 1,
            name: "Example".into(),
            url_template: "https://example.com/live/{room_id}".into(),
            audio_only: false,
            cover_path: None,
        };

        assert_eq!(
            platform.room_url("room-42"),
            "https://example.com/live/room-42"
        );
    }
}
