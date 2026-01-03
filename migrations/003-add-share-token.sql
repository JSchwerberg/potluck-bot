-- Add share_token column for access control on event links
ALTER TABLE events ADD COLUMN share_token VARCHAR(12);

-- Generate tokens for existing events
UPDATE events SET share_token = substr(md5(random()::text), 1, 12);

-- Make it non-nullable going forward
ALTER TABLE events ALTER COLUMN share_token SET NOT NULL;
