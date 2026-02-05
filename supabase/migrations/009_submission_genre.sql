-- Add genre to submissions (display label: main genre, main + sub-genre, or custom "Other" text)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS genre TEXT;
