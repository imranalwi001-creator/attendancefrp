-- Delete all Ramadhan data for Akmalun (Test) - d8fd08e6-51c3-46e9-8889-673c020aa0ce
DELETE FROM public.ramadhan_daily_logs WHERE santri_id = 'd8fd08e6-51c3-46e9-8889-673c020aa0ce';
DELETE FROM public.ramadhan_mood WHERE santri_id = 'd8fd08e6-51c3-46e9-8889-673c020aa0ce';