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

-- Step 4: Ensure orders are linked to a restaurant
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;
UPDATE orders SET restaurant_id = (SELECT id FROM restaurants ORDER BY id ASC LIMIT 1)
WHERE restaurant_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_restaurant_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;
ALTER TABLE orders ALTER COLUMN restaurant_id SET NOT NULL;

-- Step 5: Verify all restaurants
SELECT id, code, name, address FROM restaurants ORDER BY created_at DESC;
SELECT id, restaurant_id, status FROM orders ORDER BY id DESC LIMIT 20;
