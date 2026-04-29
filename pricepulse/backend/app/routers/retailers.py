from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Price, Retailer
from app.db.session import get_db
from app.utils.responses import success_response
from app.utils.serializers import serialize_product, serialize_retailer


router = APIRouter(prefix="/retailers", tags=["retailers"])


@router.get("")
def get_all_retailers(db: Session = Depends(get_db)):
    retailers = db.scalars(select(Retailer).options(selectinload(Retailer.prices)).order_by(Retailer.name.asc())).all()

    result = []
    for retailer in retailers:
        row = serialize_retailer(retailer)
        row["_count"] = {"prices": len(retailer.prices)}
        result.append(row)

    return success_response(result)


@router.get("/{retailer_id}")
def get_retailer_by_id(retailer_id: str, db: Session = Depends(get_db)):
    statement = select(Retailer).where(Retailer.id == retailer_id).options(selectinload(Retailer.prices).selectinload(Price.product))
    retailer = db.scalar(statement)
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    data = serialize_retailer(retailer)
    data["prices"] = [
        {
            "id": price.id,
            "productId": price.productId,
            "retailerId": price.retailerId,
            "price": price.price,
            "lastUpdated": price.lastUpdated,
            "createdAt": price.createdAt,
            "updatedAt": price.updatedAt,
            "product": serialize_product(price.product) if price.product else None,
        }
        for price in retailer.prices
    ]
    return success_response(data)
