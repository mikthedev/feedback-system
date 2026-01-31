-- Add Twitch profile image URL to users (for avatar display)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
