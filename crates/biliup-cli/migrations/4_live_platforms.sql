CREATE TABLE IF NOT EXISTS liveplatforms
(
    id INTEGER NOT NULL
        CONSTRAINT pk_liveplatforms PRIMARY KEY,
    name VARCHAR NOT NULL
        CONSTRAINT uq_liveplatforms_name UNIQUE,
    url_template VARCHAR NOT NULL,
    audio_only INTEGER NOT NULL DEFAULT 0,
    cover_path VARCHAR
);

ALTER TABLE livestreamers ADD COLUMN platform_id INTEGER
    REFERENCES liveplatforms(id) ON DELETE RESTRICT;
ALTER TABLE livestreamers ADD COLUMN room_id VARCHAR;
ALTER TABLE livestreamers ADD COLUMN is_only_self INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS ix_livestreamers_platform_id
    ON livestreamers(platform_id);
