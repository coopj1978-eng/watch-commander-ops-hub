ALTER TABLE firefighter_profiles
ADD COLUMN IF NOT EXISTS watch VARCHAR(10),
ADD COLUMN IF NOT EXISTS driver_pathway_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS driver_pathway_lgv_passed_date DATE,
ADD COLUMN IF NOT EXISTS last_conversation_date DATE,
ADD COLUMN IF NOT EXISTS last_conversation_text TEXT,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_watch ON firefighter_profiles(watch);
CREATE INDEX IF NOT EXISTS idx_profiles_driver_pathway_status ON firefighter_profiles(driver_pathway_status);
