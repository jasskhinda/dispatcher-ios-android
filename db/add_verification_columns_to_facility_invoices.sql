-- Add verification tracking columns to facility_invoices table
-- This allows dispatchers to track who verified check payments and when

ALTER TABLE facility_invoices
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on verified_by
CREATE INDEX IF NOT EXISTS idx_facility_invoices_verified_by ON facility_invoices(verified_by);

-- Add comment for documentation
COMMENT ON COLUMN facility_invoices.verified_by IS 'ID of the dispatcher who verified the payment';
COMMENT ON COLUMN facility_invoices.verified_at IS 'Timestamp when the payment was verified';
