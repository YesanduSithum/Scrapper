from datetime import datetime
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Price, Product
from app.db.session import get_db
from app.utils.responses import message_response, success_response
from app.utils.serializers import serialize_product
from app.utils.search import search_products_by_name, process_grocery_list as search_process_grocery_list


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
    name: str
    quantity: int = 1


class ProcessListRequest(BaseModel):
    items: list[ProcessListItemRequest]
    candidateLimit: int = 5


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
def get_all_products(db: Session = Depends(get_db)):
    products = db.scalars(_product_base_query().order_by(Product.name.asc())).all()
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
    candidate_limit = max(1, min(payload.candidateLimit, 10))
    query_items = [item for item in payload.items if item.name.strip()]

    if not query_items:
        raise HTTPException(status_code=400, detail="At least one grocery item is required")

    products = db.scalars(_product_base_query()).all()

    matches = []
    for query_item in query_items:
        ranked = sorted(
            (
                {
                    "product": product,
                    "score": _score_product_match(query_item.name, product),
                }
                for product in products
            ),
            key=lambda entry: entry["score"],
            reverse=True,
        )[:candidate_limit]

        best_match = ranked[0] if ranked else None
        alternatives = ranked[1:] if len(ranked) > 1 else []

        matches.append(
            {
                "inputName": query_item.name,
                "quantity": max(1, query_item.quantity),
                "bestMatch": {
                    "similarity": round(best_match["score"], 4),
                    "product": serialize_product(best_match["product"]),
                }
                if best_match
                else None,
                "alternatives": [
                    {
                        "similarity": round(item["score"], 4),
                        "product": serialize_product(item["product"]),
                    }
                    for item in alternatives
                ],
            }
        )

    return success_response(matches)


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return message_response("Product deleted successfully")
