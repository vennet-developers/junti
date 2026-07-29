-- Dark mode as a stored preference.
--
-- NULL keeps its meaning from the other two columns in this table: follow the
-- device. For a theme that means honouring `prefers-color-scheme`, which is what
-- every visitor got before this column existed — so no backfill is needed and
-- nobody's appearance changes on deploy.
ALTER TABLE "user_preferences" ADD COLUMN "theme" text;