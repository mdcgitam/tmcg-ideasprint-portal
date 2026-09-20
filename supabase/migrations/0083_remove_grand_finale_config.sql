-- 0083_remove_grand_finale_config.sql
-- University Level (Grand Finale) is no longer admin-configurable — it's
-- fixed in site-config.ts now, the same way Campus Level always was
-- (there's no live qualification logic that actually needs it editable, so
-- it doesn't need its own database round-trip or Configuration UI). Removes
-- the rows 0082 seeded and whatever the Configuration form may have since
-- saved on top of them.

delete from public.configuration
where key in ('grand_finale.date', 'grand_finale.start', 'grand_finale.end', 'grand_finale.venue');
