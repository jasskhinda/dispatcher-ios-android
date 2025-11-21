-- =====================================================
-- CREATE DISPATCHER NOTIFICATION TRIGGER
-- =====================================================
-- This creates a trigger that notifies ALL dispatchers
-- when trips are created or status changes
-- =====================================================

-- Function to notify all dispatchers about trip changes
CREATE OR REPLACE FUNCTION notify_dispatchers_on_trip_change()
RETURNS TRIGGER AS $$
DECLARE
  dispatcher_user RECORD;
  client_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
  pickup_time_formatted TEXT;
  status_text TEXT;
BEGIN
  -- Only proceed if this is a meaningful change
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Get client name
  IF NEW.user_id IS NOT NULL THEN
    SELECT COALESCE(first_name || ' ' || last_name, email, 'Client')
    INTO client_name
    FROM profiles
    WHERE id = NEW.user_id;
  ELSIF NEW.managed_client_id IS NOT NULL THEN
    SELECT COALESCE(first_name || ' ' || last_name, 'Client')
    INTO client_name
    FROM managed_clients
    WHERE id = NEW.managed_client_id;
  ELSE
    client_name := 'Unknown Client';
  END IF;

  -- Format pickup time
  IF NEW.pickup_time IS NOT NULL THEN
    pickup_time_formatted := TO_CHAR(NEW.pickup_time AT TIME ZONE 'America/New_York', 'Mon DD at HH12:MI PM');
  ELSE
    pickup_time_formatted := 'TBD';
  END IF;

  -- Determine notification message based on operation and status
  IF TG_OP = 'INSERT' THEN
    notification_title := '🆕 New Trip Created';
    notification_body := 'New trip for ' || client_name || ' scheduled for ' || pickup_time_formatted;
  ELSE
    -- Format status text for updates
    status_text := CASE NEW.status
      WHEN 'pending' THEN 'Pending'
      WHEN 'approved' THEN 'Approved'
      WHEN 'assigned' THEN 'Assigned to Driver'
      WHEN 'in_progress' THEN 'In Progress'
      WHEN 'completed' THEN 'Completed'
      WHEN 'cancelled' THEN 'Cancelled'
      ELSE NEW.status
    END;

    notification_title := '🔄 Trip Status Updated';
    notification_body := 'Trip for ' || client_name || ' changed to ' || status_text;
  END IF;

  -- Insert notification for all dispatchers and admins
  FOR dispatcher_user IN
    SELECT id FROM profiles
    WHERE role IN ('dispatcher', 'admin')
  LOOP
    INSERT INTO notifications (
      user_id,
      app_type,
      notification_type,
      title,
      body,
      data,
      read,
      related_trip_id,
      created_at
    ) VALUES (
      dispatcher_user.id,
      'dispatcher',
      CASE
        WHEN TG_OP = 'INSERT' THEN 'trip_created'
        ELSE 'trip_status_changed'
      END,
      notification_title,
      notification_body,
      jsonb_build_object(
        'trip_id', NEW.id,
        'old_status', COALESCE(OLD.status, 'new'),
        'new_status', NEW.status,
        'pickup_address', NEW.pickup_address,
        'destination_address', NEW.destination_address,
        'client_name', client_name
      ),
      false,
      NEW.id,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_dispatchers_on_trip_change ON trips;

-- Create trigger for trip changes
CREATE TRIGGER trigger_notify_dispatchers_on_trip_change
  AFTER INSERT OR UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION notify_dispatchers_on_trip_change();

-- Add comment
COMMENT ON FUNCTION notify_dispatchers_on_trip_change() IS 'Automatically creates notifications for all dispatchers when trips are created or status changes';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- To verify the trigger was created, run:
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'trips'
-- AND trigger_name = 'trigger_notify_dispatchers_on_trip_change';
-- =====================================================
