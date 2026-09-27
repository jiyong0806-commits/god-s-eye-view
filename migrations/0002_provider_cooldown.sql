CREATE TABLE IF NOT EXISTS provider_cooldown (
  provider TEXT PRIMARY KEY,
  retry_at INTEGER NOT NULL
);
