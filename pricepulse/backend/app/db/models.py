import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column("email", String, unique=True, nullable=False)
    password: Mapped[str] = mapped_column("password", String, nullable=False)
    name: Mapped[str | None] = mapped_column("name", String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    purchases: Mapped[list["Purchase"]] = relationship("Purchase", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column("name", String, unique=True, nullable=False)
    label: Mapped[str] = mapped_column("label", String, nullable=False)

    products: Mapped[list["Product"]] = relationship("Product", back_populates="category")


class Retailer(Base):
    __tablename__ = "retailers"

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column("name", String, unique=True, nullable=False)
    mapQuery: Mapped[str] = mapped_column("mapQuery", String, nullable=False)

    prices: Mapped[list["Price"]] = relationship("Price", back_populates="retailer")
    purchases: Mapped[list["Purchase"]] = relationship("Purchase", back_populates="retailer")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column("name", String, nullable=False)
    nameSinhala: Mapped[str] = mapped_column("namesinhala", String, nullable=False)
    image: Mapped[str] = mapped_column("image", String, nullable=False)
    categoryId: Mapped[str] = mapped_column("categoryid", String, ForeignKey("categories.id"), nullable=False)
    createdAt: Mapped[datetime] = mapped_column("createdat", DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedat", DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    category: Mapped[Category] = relationship("Category", back_populates="products")
    prices: Mapped[list["Price"]] = relationship("Price", back_populates="product", cascade="all, delete-orphan")
    purchaseItems: Mapped[list["PurchaseItem"]] = relationship("PurchaseItem", back_populates="product")


class Price(Base):
    __tablename__ = "prices"
    __table_args__ = (UniqueConstraint("productid", "retailerid", name="prices_productid_retailerid_key"),)

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    productId: Mapped[str] = mapped_column("productid", String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    retailerId: Mapped[str] = mapped_column("retailerid", String, ForeignKey("retailers.id"), nullable=False)
    price: Mapped[float] = mapped_column("price", Float, nullable=False)
    lastUpdated: Mapped[datetime] = mapped_column("lastupdated", DateTime(timezone=False), server_default=func.now())
    createdAt: Mapped[datetime] = mapped_column("createdat", DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedat", DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    product: Mapped[Product] = relationship("Product", back_populates="prices")
    retailer: Mapped[Retailer] = relationship("Retailer", back_populates="prices")


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId: Mapped[str] = mapped_column("userId", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    retailerId: Mapped[str] = mapped_column("retailerId", String, ForeignKey("retailers.id"), nullable=False)
    total: Mapped[float] = mapped_column("total", Float, nullable=False)
    purchasedAt: Mapped[datetime] = mapped_column("purchasedAt", DateTime(timezone=False), server_default=func.now())
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped[User] = relationship("User", back_populates="purchases")
    retailer: Mapped[Retailer] = relationship("Retailer", back_populates="purchases")
    items: Mapped[list["PurchaseItem"]] = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[str] = mapped_column("id", String, primary_key=True, default=lambda: str(uuid.uuid4()))
    purchaseId: Mapped[str] = mapped_column("purchaseId", String, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    productId: Mapped[str] = mapped_column("productId", String, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column("quantity", Integer, nullable=False)
    unitPrice: Mapped[float] = mapped_column("unitPrice", Float, nullable=False)
    lineTotal: Mapped[float] = mapped_column("lineTotal", Float, nullable=False)
    createdAt: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=False), server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", DateTime(timezone=False), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    purchase: Mapped[Purchase] = relationship("Purchase", back_populates="items")
    product: Mapped[Product] = relationship("Product", back_populates="purchaseItems")
