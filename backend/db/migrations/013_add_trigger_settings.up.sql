ALTER TABLE system_settings
ADD COLUMN trigger_stage1_episodes INTEGER DEFAULT 2,
ADD COLUMN trigger_stage1_days INTEGER DEFAULT 5,
ADD COLUMN trigger_stage2_episodes INTEGER DEFAULT 3,
ADD COLUMN trigger_stage2_days INTEGER DEFAULT 10,
ADD COLUMN trigger_stage3_episodes INTEGER DEFAULT 4,
ADD COLUMN trigger_stage3_days INTEGER DEFAULT 15;

UPDATE system_settings
SET 
  trigger_stage1_episodes = 2,
  trigger_stage1_days = 5,
  trigger_stage2_episodes = 3,
  trigger_stage2_days = 10,
  trigger_stage3_episodes = 4,
  trigger_stage3_days = 15
WHERE id = 1;
