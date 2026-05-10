from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_user
from app.db.models import Category, Price, Product, Purchase, PurchaseItem, Retailer, User
from app.db.session import get_db
from app.utils.responses import success_response
from app.utils.serializers import serialize_purchase


router = APIRouter(prefix="/purchases", tags=["purchases"])


class PurchaseItemInput(BaseModel):
    productId: str
    name: str
    nameSinhala: str | None = None
    image: str
    category: str
    quantity: int = Field(gt=0)
    unitPrice: float = Field(gt=0)


class CreatePurchaseRequest(BaseModel):
    retailerName: str
    items: list[PurchaseItemInput] = Field(min_length=1)


@router.post("/record")
def record_purchase(
    payload: CreatePurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    retailer = db.scalar(select(Retailer).where(Retailer.name.ilike(payload.retailerName.strip())))
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    category_cache: dict[str, Category] = {}

    def get_or_create_category(category_name: str) -> Category:
        key = category_name.strip().lower()
        if key in category_cache:
            return category_cache[key]

        category = db.scalar(select(Category).where(Category.name.ilike(category_name.strip())))
        if not category:
            category = Category(
                id=str(uuid.uuid4()),
                name=category_name.strip(),
                label=category_name.strip(),
            )
            db.add(category)
            db.flush()

        category_cache[key] = category
        return category

    def get_or_create_product(item: PurchaseItemInput) -> Product:
        product = db.scalar(select(Product).where(Product.id == item.productId))
        category = get_or_create_category(item.category)

        if not product:
            product = Product(
                id=item.productId,
                name=item.name,
                nameSinhala=item.nameSinhala or item.name,
                image=item.image,
                categoryId=category.id,
            )
            db.add(product)
            db.flush()
        else:
            product.name = item.name
            product.nameSinhala = item.nameSinhala or item.name
            product.image = item.image
            product.categoryId = category.id

        return product

    def upsert_price(product_id: str, unit_price: float) -> None:
        price = db.scalar(
            select(Price).where(Price.productId == product_id, Price.retailerId == retailer.id)
        )
        if not price:
            db.add(
                Price(
                    productId=product_id,
                    retailerId=retailer.id,
                    price=unit_price,
                    lastUpdated=datetime.utcnow(),
                )
            )
        else:
            price.price = unit_price
            price.lastUpdated = datetime.utcnow()

    for item in payload.items:
        get_or_create_product(item)
        upsert_price(item.productId, float(item.unitPrice))

    purchase = Purchase(
        userId=current_user.id,
        retailerId=retailer.id,
        total=0,
        purchasedAt=datetime.utcnow(),
    )
    db.add(purchase)
    db.flush()

    total = 0.0
    for item in payload.items:
        unit_price = float(item.unitPrice)
        line_total = round(unit_price * item.quantity, 2)
        total += line_total
        db.add(
            PurchaseItem(
                purchaseId=purchase.id,
                productId=item.productId,
                quantity=item.quantity,
                unitPrice=unit_price,
                lineTotal=line_total,
            )
        )

    purchase.total = total
    db.commit()

    saved_purchase = db.scalar(
        select(Purchase)
        .where(Purchase.id == purchase.id)
        .options(
            selectinload(Purchase.retailer),
            selectinload(Purchase.items)
            .selectinload(PurchaseItem.product)
            .selectinload(Product.category),
        )
    )

    return success_response(serialize_purchase(saved_purchase))


@router.get("/summary")
def get_purchase_summary(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    if month:
        try:
            start = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Month must be in YYYY-MM format") from exc
    else:
        start = datetime(now.year, now.month, 1)

    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)

    purchases = db.scalars(
        select(Purchase)
        .where(Purchase.userId == current_user.id, Purchase.purchasedAt >= start, Purchase.purchasedAt < end)
        .options(
            selectinload(Purchase.retailer),
            selectinload(Purchase.items)
            .selectinload(PurchaseItem.product)
            .selectinload(Product.category),
        )
        .order_by(Purchase.purchasedAt.desc())
    ).all()

    category_totals: dict[str, float] = {}
    retailer_totals: dict[str, float] = {}
    spent = 0.0
    item_count = 0

    for purchase in purchases:
        retailer_name = purchase.retailer.name if purchase.retailer else "Unknown"
        retailer_totals[retailer_name] = retailer_totals.get(retailer_name, 0.0) + float(purchase.total)
        spent += float(purchase.total)

        for item in purchase.items:
            category = "Other"
            if item.product and item.product.category:
                category = item.product.category.label or item.product.category.name
            category_totals[category] = category_totals.get(category, 0.0) + float(item.lineTotal)
            item_count += int(item.quantity)

    by_category = [
        {"name": name, "value": round(value, 2)}
        for name, value in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    ]
    by_retailer = [
        {"name": name, "value": round(value, 2)}
        for name, value in sorted(retailer_totals.items(), key=lambda x: x[1], reverse=True)
    ]

    return success_response(
        {
            "month": start.strftime("%Y-%m"),
            "spent": round(spent, 2),
            "purchaseCount": len(purchases),
            "itemCount": item_count,
            "byCategory": by_category,
            "byRetailer": by_retailer,
        }
    )


@router.get("/history")
def get_purchase_history(
    months: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get spending history for the last N months"""
    now = datetime.utcnow()
    current_date = datetime(now.year, now.month, 1)

    history = []

    for i in range(months):
        if i > 0:
            if current_date.month == 1:
                current_date = datetime(current_date.year - 1, 12, 1)
            else:
                current_date = datetime(current_date.year, current_date.month - 1, 1)

        start = current_date
        if start.month == 12:
            end = datetime(start.year + 1, 1, 1)
        else:
            end = datetime(start.year, start.month + 1, 1)

        purchases = db.scalars(
            select(Purchase)
            .where(Purchase.userId == current_user.id, Purchase.purchasedAt >= start, Purchase.purchasedAt < end)
            .options(
                selectinload(Purchase.items)
            )
        ).all()

        month_str = start.strftime("%Y-%m")
        total_spent = round(sum(float(p.total) for p in purchases), 2)

        history.append(
            {
                "month": month_str,
                "spent": total_spent,
                "purchaseCount": len(purchases),
            }
        )

    return success_response(sorted(history, key=lambda x: x["month"]))
