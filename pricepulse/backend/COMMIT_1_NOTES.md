# Commit 1: Backend Search Utility + FTS Indexing

## Changes Made

### 1. Created Search Utility Module (`app/utils/search.py`)
A comprehensive search module with the following functions:

**Core Functions:**
- `normalize_text(value: str) -> str` - Normalize text by lowercase and removing special chars
- `tokenize(value: str) -> set[str]` - Split text into word tokens
- `calculate_similarity_score(query, product, category_label) -> float` - Calculate match score

**Scoring Algorithm:**
Combines three methods with weighted scores:
1. **Sequence Matching (60%)** - Measures string similarity
2. **Token Overlap (30%)** - Word-level match using Jaccard similarity
3. **Substring Match (10%)** - Bonus for exact substrings

**Search Functions:**
- `search_products_by_name()` - Basic product search with fuzzy matching
- `process_grocery_list()` - Process multiple items and return matches for each

### 2. Added PostgreSQL Full-Text Search Support

**Model Changes:**
- Added `search_vector: TSVECTOR` column to Product model
- Imported PostgreSQL TSVECTOR type for FTS

**Database Migration:**
- Created `prisma/migrations/fts_indexing.sql` with:
  - Search vector column for storing tsvector
  - Trigger function to auto-update search vector on INSERT/UPDATE
  - GIN index for fast FTS queries
  - Additional index on categoryId for filtering performance

**Prisma Schema Update:**
- Added `searchVector` field to Product model

## Performance Characteristics

- **In-Memory Scoring:** O(n) where n = number of products in database
- **Current Target:** ~20-50ms per search (on 10K+ products)
- **Optimization Ready:** FTS index enables fast pre-filtering in Commit 2

## How to Run

### Apply Database Migration:
```bash
# Using psql directly:
psql -U [user] -d [database] -f prisma/migrations/fts_indexing.sql

# Or through Prisma (after updating schema):
npx prisma migrate dev
```

### Test Search Functionality:
```python
from app.utils.search import search_products_by_name, process_grocery_list
from app.db.session import SessionLocal

db = SessionLocal()

# Single item search
results = search_products_by_name("milk", db, limit=5)

# Process grocery list
items = [
    {"name": "fresh milk", "quantity": 2},
    {"name": "bread", "quantity": 1},
]
processed = process_grocery_list(items, db, candidates_per_item=5)
```

## Next Steps

**Commit 2** will:
- Create `/products/process-list` API endpoint
- Integrate this search utility with FastAPI
- Add category-based filtering
- Implement Redis caching (optional)
