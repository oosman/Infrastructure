-- Extend transcripts table for v2 chrome extension capture
ALTER TABLE transcripts ADD COLUMN conversation_id TEXT;
ALTER TABLE transcripts ADD COLUMN turn_number INTEGER;
ALTER TABLE transcripts ADD COLUMN is_branch INTEGER DEFAULT 0;
ALTER TABLE transcripts ADD COLUMN parent_message_uuid TEXT;
ALTER TABLE transcripts ADD COLUMN history_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_transcripts_conv ON transcripts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_conv_turn ON transcripts(conversation_id, turn_number);
