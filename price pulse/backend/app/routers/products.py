from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Price, Product
from app.db.session import get_db
from app.utils.responses import message_response, success_response
from app.utils.serializers import serialize_product


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


def _product_base_query():
    return select(Product).options(
        selectinload(Product.category),
        selectinload(Product.prices).selectinload(Price.retailer),
    )


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


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return message_response("Product deleted successfully")
