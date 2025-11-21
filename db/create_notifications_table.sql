-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'trip_created', 'trip_updated', 'trip_assigned', 'trip_status_changed', 'trip_cancelled', 'message', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  related_trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  data JSONB, -- Additional data for the notification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_related_trip_id ON public.notifications(related_trip_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Only dispatchers and admins can create notifications
CREATE POLICY "Dispatchers and admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('dispatcher', 'admin')
  )
);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_related_trip_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    related_trip_id,
    data
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_trip_id,
    p_data
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Function to notify all dispatchers
CREATE OR REPLACE FUNCTION public.notify_dispatchers(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_related_trip_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_dispatcher RECORD;
BEGIN
  FOR v_dispatcher IN
    SELECT id FROM public.profiles
    WHERE role IN ('dispatcher', 'admin')
  LOOP
    PERFORM public.create_notification(
      v_dispatcher.id,
      p_type,
      p_title,
      p_message,
      p_related_trip_id,
      p_data
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Trigger to create notifications when trip status changes
CREATE OR REPLACE FUNCTION public.notify_on_trip_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_name TEXT;
  v_status_text TEXT;
BEGIN
  -- Only notify if status changed
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Get client name
  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(first_name || ' ' || last_name, email)
    INTO v_client_name
    FROM public.profiles
    WHERE id = NEW.user_id;
  ELSIF NEW.managed_client_id IS NOT NULL THEN
    SELECT COALESCE(first_name || ' ' || last_name, 'Client')
    INTO v_client_name
    FROM public.managed_clients
    WHERE id = NEW.managed_client_id;
  ELSE
    v_client_name := 'Unknown Client';
  END IF;

  -- Format status text
  v_status_text := CASE NEW.status
    WHEN 'pending' THEN 'Pending'
    WHEN 'assigned' THEN 'Assigned to Driver'
    WHEN 'in_progress' THEN 'In Progress'
    WHEN 'completed' THEN 'Completed'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE NEW.status
  END;

  -- Notify all dispatchers about the status change
  PERFORM public.notify_dispatchers(
    'trip_status_changed',
    'Trip Status Updated',
    'Trip for ' || v_client_name || ' changed to ' || v_status_text,
    NEW.id,
    jsonb_build_object(
      'old_status', COALESCE(OLD.status, 'new'),
      'new_status', NEW.status,
      'pickup_address', NEW.pickup_address,
      'destination_address', NEW.destination_address
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for trip status changes
DROP TRIGGER IF EXISTS trigger_notify_trip_status_change ON public.trips;
CREATE TRIGGER trigger_notify_trip_status_change
AFTER INSERT OR UPDATE OF status ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_trip_status_change();

-- Function to auto-delete old read notifications (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE read = true
  AND read_at < now() - INTERVAL '30 days';
END;
$$;

COMMENT ON TABLE public.notifications IS 'Stores in-app notifications for users';
COMMENT ON FUNCTION public.create_notification IS 'Creates a new notification for a specific user';
COMMENT ON FUNCTION public.notify_dispatchers IS 'Sends a notification to all dispatchers and admins';
COMMENT ON FUNCTION public.notify_on_trip_status_change IS 'Automatically creates notifications when trip status changes';
COMMENT ON FUNCTION public.cleanup_old_notifications IS 'Removes read notifications older than 30 days';
