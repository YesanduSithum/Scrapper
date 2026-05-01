-- Migration: Add Full-Text Search support to products table
-- This adds a tsvector column and trigger to automatically update it

-- Step 1: Add search_vector column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Step 2: Populate search_vector for existing products
UPDATE products SET search_vector = 
    to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(namesinhala, ''));

-- Step 3: Create a trigger function to update search_vector on product changes
CREATE OR REPLACE FUNCTION product_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.namesinhala, ''));
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to call function on INSERT or UPDATE
DROP TRIGGER IF EXISTS product_search_vector_trigger ON products;
CREATE TRIGGER product_search_vector_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION product_search_vector_update();

-- Step 5: Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_product_search_vector ON products USING GIN(search_vector);

-- Step 6: Create index on categoryId for faster filtering
CREATE INDEX IF NOT EXISTS idx_product_categoryid ON products(categoryid);
