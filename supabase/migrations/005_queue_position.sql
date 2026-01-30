-- Store queue order only when user clicks "Use my XP". Queue fetch uses this;
-- no automatic XP-based reordering on fetch.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS queue_position INTEGER;
