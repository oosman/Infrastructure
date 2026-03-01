CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  action TEXT,
  params_hash TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_calls_created ON tool_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool ON tool_calls(tool_name);
