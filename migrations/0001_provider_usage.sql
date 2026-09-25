CREATE TABLE IF NOT EXISTS provider_usage (
  service TEXT NOT NULL,
  day TEXT NOT NULL,
  scope TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service, day, scope)
);
