-- =====================================================
-- FIX DISPATCHER NOTIFICATION TRIGGER
-- =====================================================
-- This fixes the managed_clients reference issue
-- =====================================================

CREATE OR REPLACE FUNCTION notify_dispatchers_on_trip_change()
RETURNS TRIGGER AS $$
DECLARE
  dispatcher_user RECORD;
  client_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
  pickup_time_formatted TEXT;
  status_text TEXT;
  managed_clients_exists BOOLEAN;
  facility_managed_clients_exists BOOLEAN;
BEGIN
  -- Only proceed if this is a meaningful change
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Check which managed client tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'managed_clients'
  ) INTO managed_clients_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'facility_managed_clients'
  ) INTO facility_managed_clients_exists;

  -- Get client name with safe table checks
  client_name := 'Client'; -- Default

  -- Try to get from user profile first
  IF NEW.user_id IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(first_name || ' ' || last_name, email, 'Client')
      INTO client_name
      FROM profiles
      WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
      client_name := 'Client';
    END;
  -- Try managed_client_id from facility_managed_clients
  ELSIF NEW.managed_client_id IS NOT NULL AND facility_managed_clients_exists THEN
    BEGIN
      EXECUTE format('SELECT COALESCE(first_name || '' '' || last_name, ''Client'') FROM facility_managed_clients WHERE id = $1')
      INTO client_name
      USING NEW.managed_client_id;
    EXCEPTION WHEN OTHERS THEN
      client_name := 'Client';
    END;
  -- Try managed_client_id from managed_clients (if table exists)
  ELSIF NEW.managed_client_id IS NOT NULL AND managed_clients_exists THEN
    BEGIN
      EXECUTE format('SELECT COALESCE(first_name || '' '' || last_name, ''Client'') FROM managed_clients WHERE id = $1')
      INTO client_name
      USING NEW.managed_client_id;
    EXCEPTION WHEN OTHERS THEN
      client_name := 'Client';
    END;
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
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the entire transaction
      RAISE WARNING 'Failed to create notification for dispatcher %: %', dispatcher_user.id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_dispatchers_on_trip_change() IS 'Creates notifications for dispatchers when trips are created or status changes. Handles different managed client table variations safely.';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- The function has been updated to safely handle:
-- 1. Missing managed_clients table
-- 2. Missing facility_managed_clients table
-- 3. Any other table structure variations
--
-- Test by creating a trip from facility_app
-- =====================================================
