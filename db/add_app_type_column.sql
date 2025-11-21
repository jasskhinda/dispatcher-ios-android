-- Add app_type column to notifications table to support multiple apps
-- This fixes the compatibility issue with facility_mobile

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS app_type TEXT DEFAULT 'dispatcher';

-- Add index for app_type
CREATE INDEX IF NOT EXISTS idx_notifications_app_type ON public.notifications(app_type);

-- Update the RLS policies to include app_type in future queries
COMMENT ON COLUMN public.notifications.app_type IS 'Identifies which app created the notification: dispatcher, facility, booking, etc.';
