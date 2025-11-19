-- Reset invoice for testing payment verification
-- Replace 'YOUR_INVOICE_ID' with the actual invoice ID

-- To find your invoice ID, you can query:
-- SELECT id, invoice_number FROM facility_invoices WHERE invoice_number = 'CCT-202511-VE9DNQETJ';

-- Then run this to reset:
UPDATE facility_invoices
SET
  payment_status = 'UNPAID',
  payment_notes = NULL,
  verified_by = NULL,
  verified_at = NULL
WHERE invoice_number = 'CCT-202511-VE9DNQETJ';

-- Verify the reset
SELECT id, invoice_number, payment_status, verified_by, verified_at
FROM facility_invoices
WHERE invoice_number = 'CCT-202511-VE9DNQETJ';
