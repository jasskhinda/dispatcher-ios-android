-- Query 1: Get all notification-related tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%notification%'
ORDER BY table_name;

-- Query 2: Get the schema of the notifications table (if it exists)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Query 3: Get the schema of facility_notifications table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'facility_notifications'
ORDER BY ordinal_position;

-- Query 4: Check for indexes on notifications tables
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE '%notification%'
ORDER BY tablename, indexname;

-- Query 5: Check for triggers on trips table
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'trips'
AND trigger_name LIKE '%notif%'
ORDER BY trigger_name;
