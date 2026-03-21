import os
import re
import uuid
from urllib.parse import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor


DEFAULT_CATEGORY = "uncategorized"
DEFAULT_IMAGE = ""


def _stable_id(prefix: str, value: str) -> str:
    key = f"{prefix}:{value.strip().lower()}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))


def _to_float(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    match = re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match[0].replace(",", ""))
    except ValueError:
        return None


def infer_retailer_from_url(url: str) -> str:
    try:
        hostname = (urlparse(url).hostname or "").lower()
    except Exception:
        hostname = ""

    if not hostname:
        return "unknown-shop"

    hostname = hostname.replace("www.", "")
    domain_part = hostname.split(".")[0].strip()
    if not domain_part:
        return "unknown-shop"

    return domain_part.replace("-", " ").replace("_", " ").strip() or "unknown-shop"


def _infer_category(item: dict) -> str:
    category = (item.get("category") or "").strip().lower()
    if category:
        return category

    source_url = item.get("source_url") or ""
    try:
        path = urlparse(source_url).path.strip("/")
    except Exception:
        path = ""

    if path:
        first_segment = path.split("/")[0].replace("-", " ").replace("_", " ").strip().lower()
        if first_segment:
            return first_segment

    return DEFAULT_CATEGORY


def normalize_scraped_items(raw_items: list[dict]) -> list[dict]:
    normalized = []

    for item in raw_items:
        name = str(item.get("product_name") or "").strip()
        if not name:
            continue

        original_price = _to_float(item.get("original_price"))
        discounted_price = _to_float(item.get("discounted_price"))

        if discounted_price is not None and original_price is None:
            original_price = discounted_price
            discounted_price = None

        if original_price is not None and discounted_price is not None and discounted_price >= original_price:
            discounted_price = None

        effective_price = discounted_price if discounted_price is not None else original_price
        if effective_price is None:
            continue

        category_name = _infer_category(item)
        retailer_name = str(item.get("retailer_name") or infer_retailer_from_url(item.get("source_url") or "")).strip().lower()
        if not retailer_name:
            retailer_name = "unknown-shop"

        image = str(item.get("image") or DEFAULT_IMAGE)
        name_sinhala = str(item.get("nameSinhala") or name)

        category_id = _stable_id("category", category_name)
        retailer_id = _stable_id("retailer", retailer_name)
        product_id = _stable_id("product", f"{category_name}|{name}")
        price_id = _stable_id("price", f"{product_id}|{retailer_id}")

        normalized.append(
            {
                "category_id": category_id,
                "category_name": category_name,
                "category_label": category_name.title(),
                "retailer_id": retailer_id,
                "retailer_name": retailer_name,
                "retailer_map_query": retailer_name,
                "product_id": product_id,
                "product_name": name,
                "product_name_sinhala": name_sinhala,
                "product_image": image,
                "price_id": price_id,
                "price": float(round(effective_price, 2)),
                "original_price": original_price,
                "discounted_price": discounted_price,
                "source_url": item.get("source_url"),
            }
        )

    return normalized


def upsert_products_and_prices(items: list[dict], database_url: str | None = None) -> dict:
    if not items:
        return {"rows_processed": 0, "rows_saved": 0}

    db_url = database_url or os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")

    with psycopg2.connect(db_url) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for row in items:
                cur.execute(
                    """
                    INSERT INTO categories (id, name, label)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (name)
                    DO UPDATE SET label = EXCLUDED.label
                    """,
                    (row["category_id"], row["category_name"], row["category_label"]),
                )

                cur.execute(
                    """
                    INSERT INTO retailers (id, name, mapQuery)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (name)
                    DO UPDATE SET mapQuery = EXCLUDED.mapQuery
                    """,
                    (row["retailer_id"], row["retailer_name"], row["retailer_map_query"]),
                )

                cur.execute(
                    """
                    INSERT INTO products (id, name, nameSinhala, image, categoryId, updatedAt)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        nameSinhala = EXCLUDED.nameSinhala,
                        image = EXCLUDED.image,
                        categoryId = EXCLUDED.categoryId,
                        updatedAt = NOW()
                    """,
                    (
                        row["product_id"],
                        row["product_name"],
                        row["product_name_sinhala"],
                        row["product_image"],
                        row["category_id"],
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO prices (id, productId, retailerId, price, lastUpdated, updatedAt)
                    VALUES (%s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (productId, retailerId)
                    DO UPDATE SET
                        price = EXCLUDED.price,
                        lastUpdated = NOW(),
                        updatedAt = NOW()
                    """,
                    (
                        row["price_id"],
                        row["product_id"],
                        row["retailer_id"],
                        row["price"],
                    ),
                )

    return {"rows_processed": len(items), "rows_saved": len(items)}
