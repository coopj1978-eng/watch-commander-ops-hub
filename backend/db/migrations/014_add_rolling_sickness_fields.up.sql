ALTER TABLE firefighter_profiles
ADD COLUMN rolling_sick_episodes INTEGER DEFAULT 0,
ADD COLUMN rolling_sick_days INTEGER DEFAULT 0,
ADD COLUMN trigger_stage TEXT DEFAULT 'None' CHECK (trigger_stage IN ('None', 'Stage1', 'Stage2', 'Stage3'));

CREATE INDEX idx_firefighter_profiles_trigger_stage ON firefighter_profiles(trigger_stage);
