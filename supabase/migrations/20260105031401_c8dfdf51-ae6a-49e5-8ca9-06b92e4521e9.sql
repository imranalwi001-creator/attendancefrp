-- Migrasi jadwal legacy (block_id = null) ke Blok 1 untuk semester genap
UPDATE jadwal 
SET block_id = 'c9e41978-c368-4963-9c79-b9f1a16445da'
WHERE block_id IS NULL 
AND semester = 'genap';