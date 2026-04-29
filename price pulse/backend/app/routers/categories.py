from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Category, Price, Product
from app.db.session import get_db
from app.utils.responses import success_response
from app.utils.serializers import serialize_category, serialize_product


router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def get_all_categories(db: Session = Depends(get_db)):
    categories = db.scalars(select(Category).options(selectinload(Category.products)).order_by(Category.name.asc())).all()

    result = []
    for category in categories:
        row = serialize_category(category)
        row["_count"] = {"products": len(category.products)}
        result.append(row)

    return success_response(result)


@router.get("/{category_id}")
def get_category_by_id(category_id: str, db: Session = Depends(get_db)):
    statement = (
        select(Category)
        .where(Category.id == category_id)
        .options(selectinload(Category.products).selectinload(Product.prices).selectinload(Price.retailer))
    )
    category = db.scalar(statement)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    data = serialize_category(category)
    data["products"] = [serialize_product(product) for product in category.products]
    return success_response(data)
