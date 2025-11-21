-- Clean up existing notifications table and related objects
-- Run this FIRST before running create_notifications_table.sql

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_notify_trip_status_change ON public.trips;

-- Drop functions
DROP FUNCTION IF EXISTS public.notify_on_trip_status_change();
DROP FUNCTION IF EXISTS public.cleanup_old_notifications();
DROP FUNCTION IF EXISTS public.notify_dispatchers(TEXT, TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, TEXT, UUID, JSONB);

-- Drop table (this will also drop all policies and indexes)
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Confirmation message
DO $$
BEGIN
  RAISE NOTICE 'Notifications table and related objects have been cleaned up successfully';
END $$;
