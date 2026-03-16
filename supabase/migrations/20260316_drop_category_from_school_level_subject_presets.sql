-- Compatibility migration: remove category from level subject presets if an older schema already created it.
ALTER TABLE IF EXISTS school_level_subject_presets
  DROP COLUMN IF EXISTS category;
