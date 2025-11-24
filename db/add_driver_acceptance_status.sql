-- Add driver_acceptance_status column for driver workflow
-- This keeps the main 'status' column unchanged for facility_app and booking_app
-- Only dispatcher_mobile and driver_mobile use this column

-- Drop existing constraint if it exists (in case column was added without proper constraint)
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_driver_acceptance_status_check;

-- Add the driver_acceptance_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'trips'
    AND column_name = 'driver_acceptance_status'
  ) THEN
    ALTER TABLE trips
    ADD COLUMN driver_acceptance_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Add the constraint with the correct name
ALTER TABLE trips
ADD CONSTRAINT trips_driver_acceptance_status_check
CHECK (driver_acceptance_status IN ('pending', 'assigned_waiting', 'accepted', 'started', 'completed'));

COMMENT ON COLUMN trips.driver_acceptance_status IS 'Separate status for driver workflow - does not affect main trip status';

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_trips_driver_acceptance_status ON trips(driver_acceptance_status);

-- Update existing trips with assigned_driver_id to have 'assigned_waiting' status
UPDATE trips
SET driver_acceptance_status = 'assigned_waiting'
WHERE assigned_driver_id IS NOT NULL
  AND driver_id IS NULL
  AND driver_acceptance_status = 'pending';

-- Update existing trips where driver has accepted (driver_id is set) to 'accepted'
UPDATE trips
SET driver_acceptance_status = 'accepted'
WHERE driver_id IS NOT NULL
  AND driver_acceptance_status IN ('pending', 'assigned_waiting');
