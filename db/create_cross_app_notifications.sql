-- =====================================================
-- CREATE CROSS-APP NOTIFICATION TRIGGERS
-- =====================================================
-- This creates notifications for:
-- 1. Facility users when dispatcher books trips for their clients
-- 2. Individual clients when dispatcher books trips for them
-- 3. Dispatchers when anyone books trips (already exists)
-- =====================================================

-- Function to notify facility users when trips are created for their managed clients
CREATE OR REPLACE FUNCTION notify_facility_on_dispatcher_trip()
RETURNS TRIGGER AS $$
DECLARE
  facility_user RECORD;
  client_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
  pickup_time_formatted TEXT;
BEGIN
  -- Only proceed for INSERT operations with managed_client_id (facility clients)
  IF TG_OP = 'INSERT' AND NEW.managed_client_id IS NOT NULL AND NEW.facility_id IS NOT NULL THEN

    -- Get client name from facility_managed_clients
    BEGIN
      SELECT COALESCE(first_name || ' ' || last_name, 'Client')
      INTO client_name
      FROM facility_managed_clients
      WHERE id = NEW.managed_client_id;
    EXCEPTION WHEN OTHERS THEN
      client_name := 'Client';
    END;

    -- Format pickup time
    IF NEW.pickup_time IS NOT NULL THEN
      pickup_time_formatted := TO_CHAR(NEW.pickup_time AT TIME ZONE 'America/New_York', 'Mon DD at HH12:MI PM');
    ELSE
      pickup_time_formatted := 'TBD';
    END IF;

    notification_title := '🆕 New Trip Booked';
    notification_body := 'Trip for ' || client_name || ' scheduled for ' || pickup_time_formatted;

    -- Insert notification for all facility users at this facility
    FOR facility_user IN
      SELECT id FROM profiles
      WHERE facility_id = NEW.facility_id
      AND role IN ('facility', 'facility_admin', 'facility_scheduler')
    LOOP
      BEGIN
        -- Insert into facility_notifications table
        INSERT INTO facility_notifications (
          user_id,
          facility_id,
          title,
          body,
          data,
          read,
          created_at
        ) VALUES (
          facility_user.id,
          NEW.facility_id,
          notification_title,
          notification_body,
          jsonb_build_object(
            'tripId', NEW.id,
            'status', NEW.status,
            'pickup_address', NEW.pickup_address,
            'destination_address', NEW.destination_address,
            'client_name', client_name
          ),
          false,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create facility notification for user %: %', facility_user.id, SQLERRM;
      END;

      -- Also insert into unified notifications table with app_type='facility'
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
          facility_user.id,
          'facility',
          'trip_created',
          notification_title,
          notification_body,
          jsonb_build_object(
            'tripId', NEW.id,
            'status', NEW.status,
            'pickup_address', NEW.pickup_address,
            'destination_address', NEW.destination_address,
            'client_name', client_name
          ),
          false,
          NEW.id,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        -- Unified notifications table might not exist in all environments
        RAISE WARNING 'Failed to create unified notification for facility user %: %', facility_user.id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify individual clients when trips are created for them
CREATE OR REPLACE FUNCTION notify_client_on_trip_booking()
RETURNS TRIGGER AS $$
DECLARE
  client_email TEXT;
  notification_title TEXT;
  notification_body TEXT;
  pickup_time_formatted TEXT;
BEGIN
  -- Only proceed for INSERT operations with user_id (individual clients)
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN

    -- Check if this user is a client (not dispatcher/admin)
    BEGIN
      SELECT email INTO client_email
      FROM profiles
      WHERE id = NEW.user_id
      AND role = 'client';

      -- Only proceed if they are a client
      IF client_email IS NULL THEN
        RETURN NEW;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;

    -- Format pickup time
    IF NEW.pickup_time IS NOT NULL THEN
      pickup_time_formatted := TO_CHAR(NEW.pickup_time AT TIME ZONE 'America/New_York', 'Mon DD at HH12:MI PM');
    ELSE
      pickup_time_formatted := 'TBD';
    END IF;

    notification_title := '🚗 Trip Booked';
    notification_body := 'Your trip has been scheduled for ' || pickup_time_formatted;

    -- Insert notification for the client
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
        NEW.user_id,
        'booking',
        'trip_created',
        notification_title,
        notification_body,
        jsonb_build_object(
          'tripId', NEW.id,
          'status', NEW.status,
          'pickup_address', NEW.pickup_address,
          'destination_address', NEW.destination_address,
          'pickup_time', NEW.pickup_time
        ),
        false,
        NEW.id,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create notification for client %: %', NEW.user_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers (only if they don't exist)
DO $$
BEGIN
  -- Trigger for facility notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_notify_facility_on_dispatcher_trip'
  ) THEN
    CREATE TRIGGER trigger_notify_facility_on_dispatcher_trip
      AFTER INSERT ON trips
      FOR EACH ROW
      EXECUTE FUNCTION notify_facility_on_dispatcher_trip();
    RAISE NOTICE 'Facility notification trigger created successfully!';
  ELSE
    RAISE NOTICE 'Facility notification trigger already exists.';
  END IF;

  -- Trigger for client notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_notify_client_on_trip_booking'
  ) THEN
    CREATE TRIGGER trigger_notify_client_on_trip_booking
      AFTER INSERT ON trips
      FOR EACH ROW
      EXECUTE FUNCTION notify_client_on_trip_booking();
    RAISE NOTICE 'Client notification trigger created successfully!';
  ELSE
    RAISE NOTICE 'Client notification trigger already exists.';
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION notify_facility_on_dispatcher_trip() IS 'Creates notifications for facility users when dispatchers book trips for their managed clients';
COMMENT ON FUNCTION notify_client_on_trip_booking() IS 'Creates notifications for individual clients when trips are booked for them';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Test the triggers by:
-- 1. Dispatcher books trip for facility client -> Facility users get notification
-- 2. Dispatcher books trip for individual client -> Client gets notification
-- 3. Check both facility_notifications and notifications tables
-- =====================================================
