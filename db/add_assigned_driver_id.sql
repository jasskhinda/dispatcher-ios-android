-- Add assigned_driver_id column to trips table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'trips'
    AND column_name = 'assigned_driver_id'
  ) THEN
    ALTER TABLE trips
    ADD COLUMN assigned_driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

    COMMENT ON COLUMN trips.assigned_driver_id IS 'Driver assigned by dispatcher for live tracking';
  END IF;
END $$;

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_trips_assigned_driver_id ON trips(assigned_driver_id);

-- Update RLS policies to include assigned_driver_id
-- Drivers can see trips assigned to them
DROP POLICY IF EXISTS "Drivers can view trips assigned to them" ON trips;
CREATE POLICY "Drivers can view trips assigned to them"
  ON trips
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'driver'
      AND (
        trips.driver_id = auth.uid()
        OR trips.assigned_driver_id = auth.uid()
      )
    )
  );

-- Drivers can update trips assigned to them (for accepting/starting/completing)
DROP POLICY IF EXISTS "Drivers can update their assigned trips" ON trips;
CREATE POLICY "Drivers can update their assigned trips"
  ON trips
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'driver'
      AND (
        trips.driver_id = auth.uid()
        OR trips.assigned_driver_id = auth.uid()
      )
    )
  );
