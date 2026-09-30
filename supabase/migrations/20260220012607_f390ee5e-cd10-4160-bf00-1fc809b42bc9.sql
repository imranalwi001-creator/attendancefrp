-- Rename "Dzikir & Shalawat" to "Dzikir Pagi"
UPDATE ramadhan_activities SET title = 'Dzikir Pagi' WHERE id = '2f494386-a81c-4df1-9683-a2e5022ff34a';

-- Add new activity "Dzikir Petang"
INSERT INTO ramadhan_activities (title, category, target_daily) VALUES ('Dzikir Petang', 'sunnah', 1);