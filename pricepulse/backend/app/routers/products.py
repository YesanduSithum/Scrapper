from datetime import datetime
import re
from difflib import SequenceMatcher
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Price, Product
from app.db.session import get_db
from app.utils.responses import message_response, success_response
from app.utils.serializers import serialize_product
from app.utils.search import search_products_by_name, process_grocery_list as search_process_grocery_list
from app.utils.cache import get_cache_manager


router = APIRouter(prefix="/products", tags=["products"])


class PriceInput(BaseModel):
    retailerId: str
    price: float


class ProductCreateRequest(BaseModel):
    name: str
    nameSinhala: str
    image: str
    categoryId: str
    prices: list[PriceInput] = []


class ProductUpdateRequest(BaseModel):
    name: str | None = None
    nameSinhala: str | None = None
    image: str | None = None
    categoryId: str | None = None


class ProcessListItemRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Product name to search for")
    quantity: int = Field(default=1, ge=1, description="Quantity of item")


class ProcessListRequest(BaseModel):
    items: list[ProcessListItemRequest] = Field(..., min_items=1, description="List of items to process")
    categoryId: Optional[str] = Field(None, description="Optional category ID to filter search")
    candidateLimit: int = Field(default=5, ge=1, le=10, description="Max candidates per item (1-10)")
    minSimilarity: float = Field(default=0.1, ge=0.0, le=1.0, description="Minimum similarity threshold (0.0-1.0)")


class ProcessedItemResponse(BaseModel):
    userInput: str
    quantity: int
    bestMatch: Optional[dict] = None
    alternatives: list[dict] = []


class ProcessListResponse(BaseModel):
    items: list[ProcessedItemResponse]
    totalItems: int
    processedAt: str


def _product_base_query():
    return select(Product).options(
        selectinload(Product.category),
        selectinload(Product.prices).selectinload(Price.retailer),
    )


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9\s]+", " ", (value or "").lower()).strip()


def _token_set(value: str) -> set[str]:
    return {token for token in _normalize_text(value).split() if token}


def _score_product_match(query: str, product: Product) -> float:
    normalized_query = _normalize_text(query)
    if not normalized_query:
        return 0.0

    names = [product.name or "", product.nameSinhala or ""]
    best_sequence_score = max(
        SequenceMatcher(None, normalized_query, _normalize_text(name)).ratio() for name in names
    )

    query_tokens = _token_set(normalized_query)
    candidate_tokens = (
        _token_set(product.name)
        | _token_set(product.nameSinhala)
        | _token_set(product.category.label if product.category else "")
    )

    if query_tokens and candidate_tokens:
        token_overlap_score = len(query_tokens & candidate_tokens) / len(query_tokens | candidate_tokens)
    else:
        token_overlap_score = 0.0

    contains_score = 0.0
    for name in names:
        normalized_name = _normalize_text(name)
        if normalized_query in normalized_name or normalized_name in normalized_query:
            contains_score = 1.0
            break

    return (best_sequence_score * 0.6) + (token_overlap_score * 0.3) + (contains_score * 0.1)


@router.get("")
def get_all_products(limit: int = Query(default=10, ge=1, le=1000), db: Session = Depends(get_db)):
    products = db.scalars(_product_base_query().order_by(Product.name.asc()).limit(limit)).all()
    return success_response([serialize_product(product) for product in products])


@router.get("/search")
def search_products(q: str = Query(default=""), db: Session = Depends(get_db)):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query is required")

    statement = _product_base_query().where(
        or_(
            Product.name.ilike(f"%{q}%"),
            Product.nameSinhala.ilike(f"%{q}%"),
        )
    )
    products = db.scalars(statement).all()
    return success_response([serialize_product(product) for product in products])


@router.get("/category/{category_id}")
def get_products_by_category(category_id: str, db: Session = Depends(get_db)):
    products = db.scalars(_product_base_query().where(Product.categoryId == category_id)).all()
    return success_response([serialize_product(product) for product in products])


@router.get("/{product_id}")
def get_product_by_id(product_id: str, db: Session = Depends(get_db)):
    product = db.scalar(_product_base_query().where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return success_response(serialize_product(product))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreateRequest, db: Session = Depends(get_db)):
    product = Product(
        name=payload.name,
        nameSinhala=payload.nameSinhala,
        image=payload.image,
        categoryId=payload.categoryId,
    )
    db.add(product)
    db.flush()

    for item in payload.prices:
        db.add(
            Price(
                productId=product.id,
                retailerId=item.retailerId,
                price=item.price,
                lastUpdated=datetime.utcnow(),
            )
        )

    db.commit()
    product = db.scalar(_product_base_query().where(Product.id == product.id))
    return success_response(serialize_product(product))


@router.put("/{product_id}")
def update_product(product_id: str, payload: ProductUpdateRequest, db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(product, field, value)

    db.commit()
    refreshed_product = db.scalar(_product_base_query().where(Product.id == product.id))
    return success_response(serialize_product(refreshed_product))


@router.post("/process-list")
def process_grocery_list(payload: ProcessListRequest, db: Session = Depends(get_db)):
    """
    Process a grocery list and find matching products.
    
    Returns best matches and alternatives for each item with similarity scores.
    Results are cached for performance optimization.
    
    Args:
        payload: ProcessListRequest with items to process
        db: Database session
    
    Returns:
        Processed items with matches and alternatives
    """
    # Validate input
    if not payload.items:
        raise HTTPException(status_code=400, detail="At least one grocery item is required")
    
    # Use search utility with category filtering
    results = search_process_grocery_list(
        items=payload.items,
        db=db,
        category_id=payload.categoryId,
        candidates_per_item=payload.candidateLimit,
        min_score=payload.minSimilarity,
    )
    
    # Format response
    processed_items = []
    for result in results:
        best_match = result.get("bestMatch")
        candidates = result.get("candidates", [])
        alternatives = candidates[1:] if len(candidates) > 1 else []

        def _to_product_candidate(candidate: dict | None):
            if not candidate:
                return None

            return {
                "similarity": candidate.get("similarity", 0),
                "product": {
                    "id": candidate.get("id"),
                    "name": candidate.get("name"),
                    "nameSinhala": candidate.get("nameSinhala"),
                    "image": candidate.get("image"),
                    "categoryId": candidate.get("categoryId"),
                    "prices": candidate.get("prices", []),
                },
            }
        
        processed_items.append(
            {
                "inputName": result["userInput"],
                "userInput": result["userInput"],
                "quantity": result["quantity"],
                "bestMatch": _to_product_candidate(best_match),
                "alternatives": [_to_product_candidate(candidate) for candidate in alternatives],
            }
        )
    
    response_data = {
        "items": processed_items,
        "totalItems": len(processed_items),
        "processedAt": datetime.utcnow().isoformat(),
    }
    
    return success_response(response_data)


@router.get("/search-alternatives/{product_id}")
def get_product_alternatives(
    product_id: str,
    limit: int = Query(default=5, ge=1, le=10),
    db: Session = Depends(get_db),
):
    """
    Get alternative/similar products to a given product.
    
    Uses the product's name to find similar products in same category.
    
    Args:
        product_id: ID of the product to find alternatives for
        limit: Maximum number of alternatives to return
        db: Database session
    
    Returns:
        List of similar products with similarity scores
    """
    product = db.scalar(_product_base_query().where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Search for similar products in the same category
    alternatives = search_products_by_name(
        query=product.name,
        db=db,
        category_id=product.categoryId,
        limit=limit + 1,  # +1 to account for the product itself
        min_score=0.1,
    )
    
    # Filter out the product itself
    similar_products = [
        {
            "id": alt["product"].id,
            "name": alt["product"].name,
            "nameSinhala": alt["product"].nameSinhala,
            "image": alt["product"].image,
            "categoryId": alt["product"].categoryId,
            "similarity": round(alt["score"], 3),
            "prices": [
                {
                    "retailerId": price.retailerId,
                    "retailer": price.retailer.name if price.retailer else None,
                    "price": price.price,
                }
                for price in alt["product"].prices
            ],
        }
        for alt in alternatives
        if alt["product"].id != product_id
    ][:limit]
    
    return success_response(similar_products)


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return message_response("Product deleted successfully")
