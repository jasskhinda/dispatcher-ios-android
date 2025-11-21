-- Query 1: Get ALL tables with 'notification' or 'notif' in the name
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%notification%' OR table_name LIKE '%notif%')
ORDER BY table_name;

-- Query 2: For each notification table found, get its complete schema
-- Run this for 'notifications' table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Query 3: Check if there's a push_tokens or similar table
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%push%' OR table_name LIKE '%token%')
ORDER BY table_name;
