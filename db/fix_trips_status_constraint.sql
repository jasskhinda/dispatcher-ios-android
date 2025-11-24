-- Fix the trips_status_check constraint to allow 'assigned' status
-- This constraint is currently preventing drivers from accepting trips
-- Error: "new row for relation "trips" violates check constraint "trips_status_check""

-- Drop the existing constraint
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;

-- Add the updated constraint with all valid statuses
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN (
    'pending',         -- Initial trip request
    'approved',        -- Trip approved, ready for driver assignment
    'upcoming',        -- Trip scheduled for future
    'assigned',        -- Driver has accepted the trip
    'in_progress',     -- Trip is currently active
    'completed',       -- Trip finished successfully
    'cancelled',       -- Trip cancelled
    'rejected'         -- Trip rejected
  ));

-- Verify the constraint was updated successfully
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'trips_status_check';
