-- Debug query to see the current notification trigger setup

-- 1. Check which triggers are active on trips table
SELECT
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'trips'
AND trigger_name LIKE '%notif%'
ORDER BY trigger_name;

-- 2. Check the function definition for the main trigger
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'notify_trip_status_change';

-- 3. Check recent notifications in the table
SELECT
  id,
  user_id,
  app_type,
  notification_type,
  title,
  body,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if any notifications exist for dispatchers
SELECT
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN app_type = 'dispatcher' THEN 1 END) as dispatcher_notifications,
  COUNT(CASE WHEN app_type = 'facility' THEN 1 END) as facility_notifications,
  COUNT(CASE WHEN read = false THEN 1 END) as unread_notifications
FROM notifications;

-- 5. Check profiles table for dispatcher users
SELECT
  id,
  email,
  role
FROM profiles
WHERE role IN ('dispatcher', 'admin')
LIMIT 5;
