-- Fix Domain Routing: Update/Create Gandikota Restaurant
-- Run this SQL on your PostgreSQL database via Render console or your database client

-- Step 1: Rename 'default' restaurant to 'gandikotadosa'
UPDATE restaurants 
SET code = 'gandikotadosa', 
    name = 'Gandikota',
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'default';

-- Step 2: Verify the update worked
SELECT id, code, name, address, cuisines FROM restaurants WHERE code = 'gandikotadosa';

-- Step 3: If you still see multiple restaurants and want to clean up
-- (Optional - only if you have duplicate 'default' entries)
DELETE FROM restaurants WHERE code = 'default' AND id NOT IN (
  SELECT MIN(id) FROM restaurants WHERE code = 'default' GROUP BY code
);

-- Step 4: Verify all restaurants
SELECT id, code, name, address FROM restaurants ORDER BY created_at DESC;
