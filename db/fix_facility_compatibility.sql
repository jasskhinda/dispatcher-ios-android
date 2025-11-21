-- =====================================================
-- FIX FACILITY_MOBILE COMPATIBILITY
-- =====================================================
-- This script:
-- 1. Removes the duplicate dispatcher trigger we created
-- 2. Ensures the notifications table has the app_type column
-- 3. Updates the unified structure to work with all apps
-- =====================================================

-- Step 1: Drop the duplicate trigger we created for dispatcher
DROP TRIGGER IF EXISTS trigger_notify_trip_status_change ON public.trips;

-- Step 2: Drop the dispatcher-specific function we created
DROP FUNCTION IF EXISTS public.notify_on_trip_status_change();

-- Step 3: Drop the dispatcher-specific helper functions
DROP FUNCTION IF EXISTS public.notify_dispatchers(TEXT, TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, TEXT, UUID, JSONB);

-- Step 4: Add app_type column to notifications table if it doesn't exist
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS app_type TEXT DEFAULT 'dispatcher';

-- Step 5: Rename 'type' column to 'notification_type' if it exists as 'type'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'notification_type'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN type TO notification_type;
  END IF;
END $$;

-- Step 6: Or add notification_type if neither exists
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT 'trip_update';

-- Step 7: Rename 'message' column to 'body' if it exists as 'message'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'message'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
    AND column_name = 'body'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN message TO body;
  END IF;
END $$;

-- Step 8: Or add body if neither exists
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';

-- Step 9: Add indexes for app_type and notification_type
CREATE INDEX IF NOT EXISTS idx_notifications_app_type ON public.notifications(app_type);
CREATE INDEX IF NOT EXISTS idx_notifications_notification_type ON public.notifications(notification_type);

-- Step 10: Update comments
COMMENT ON COLUMN public.notifications.app_type IS 'Identifies which app created the notification: dispatcher, facility, booking, driver, admin';
COMMENT ON COLUMN public.notifications.notification_type IS 'Type of notification: trip_update, approval_needed, status_change, etc.';

-- Step 11: Fix RLS policies to allow system triggers to insert notifications
-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "Dispatchers and admins can create notifications" ON public.notifications;

-- Create a new permissive INSERT policy that allows system functions to insert
CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Ensure users can still see only their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Ensure users can update only their own notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure users can delete only their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run this to verify the fix:
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'trips'
-- AND trigger_name LIKE '%notif%';
--
-- You should see only 2 triggers now:
-- 1. trigger_notify_trip_status (original unified one)
-- 2. trip_status_change_notification (facility-specific)
-- =====================================================
