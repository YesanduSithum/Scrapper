from app.db.models import Category, Price, Product, Purchase, PurchaseItem, Retailer, User


def serialize_user(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
    }


def serialize_user_with_created_at(user: User):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "createdAt": user.createdAt,
    }


def serialize_retailer(retailer: Retailer):
    return {
        "id": retailer.id,
        "name": retailer.name,
        "mapQuery": retailer.mapQuery,
    }


def serialize_price(price: Price):
    return {
        "id": price.id,
        "productId": price.productId,
        "retailerId": price.retailerId,
        "price": price.price,
        "lastUpdated": price.lastUpdated,
        "createdAt": price.createdAt,
        "updatedAt": price.updatedAt,
        "retailer": serialize_retailer(price.retailer) if price.retailer else None,
    }


def serialize_category(category: Category):
    return {
        "id": category.id,
        "name": category.name,
        "label": category.label,
    }


def serialize_product(product: Product):
    return {
        "id": product.id,
        "name": product.name,
        "nameSinhala": product.nameSinhala,
        "image": product.image,
        "categoryId": product.categoryId,
        "createdAt": product.createdAt,
        "updatedAt": product.updatedAt,
        "category": serialize_category(product.category) if product.category else None,
        "prices": [serialize_price(price) for price in product.prices],
    }


def serialize_purchase_item(item: PurchaseItem):
    return {
        "id": item.id,
        "purchaseId": item.purchaseId,
        "productId": item.productId,
        "quantity": item.quantity,
        "unitPrice": item.unitPrice,
        "lineTotal": item.lineTotal,
        "createdAt": item.createdAt,
        "updatedAt": item.updatedAt,
        "product": serialize_product(item.product) if item.product else None,
    }


def serialize_purchase(purchase: Purchase):
    return {
        "id": purchase.id,
        "userId": purchase.userId,
        "retailerId": purchase.retailerId,
        "total": purchase.total,
        "purchasedAt": purchase.purchasedAt,
        "createdAt": purchase.createdAt,
        "updatedAt": purchase.updatedAt,
        "retailer": serialize_retailer(purchase.retailer) if purchase.retailer else None,
        "items": [serialize_purchase_item(item) for item in purchase.items],
    }
