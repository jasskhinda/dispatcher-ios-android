-- Query to see all notification-related functions and their definitions
SELECT
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%notif%'
ORDER BY routine_name;

-- Query to see the actual function code for notify_trip_status_change
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'notify_trip_status_change';

-- Query to see the actual function code for notify_on_trip_status_change
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'notify_on_trip_status_change';

-- Query to see the actual function code for notify_facility_on_trip_change
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'notify_facility_on_trip_change';
