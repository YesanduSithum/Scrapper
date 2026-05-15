import pathlib
import sys
from unittest.mock import MagicMock, patch


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from db_pipeline import _infer_category, _to_float, infer_retailer_from_url, normalize_scraped_items


def test_to_float_parses_messy_currency_strings():
    # Arrange
    raw_price = "  Rs. 1,250.50  "

    # Act
    result = _to_float(raw_price)

    # Assert
    assert result == 1250.50


def test_normalize_scraped_items_trims_names_and_applies_discount_price():
    # Arrange
    raw_items = [
        {
            "product_name": "  Green Cabbage  ",
            "original_price": "Rs. 350",
            "discounted_price": "Rs. 299.99",
            "source_url": "https://www.keellssuper.com/fresh-vegetables/cabbage",
            "image": "https://example.com/cabbage.jpg",
        }
    ]

    # Act
    normalized = normalize_scraped_items(raw_items)

    # Assert
    assert len(normalized) == 1
    item = normalized[0]
    assert item["product_name"] == "Green Cabbage"
    assert item["category_name"] == "fresh vegetables"
    assert item["retailer_name"] == "keellssuper"
    assert item["original_price"] == 350.0
    assert item["discounted_price"] == 299.99
    assert item["price"] == 299.99


def test_normalize_scraped_items_ignores_invalid_discount_and_keeps_original_price():
    # Arrange
    raw_items = [
        {
            "product_name": "Milk 1L",
            "original_price": "Rs. 180",
            "discounted_price": "Rs. 220",
            "retailer_name": "  Cargills  ",
            "category": "Dairy",
            "source_url": "https://example.com/products/milk",
        }
    ]

    # Act
    normalized = normalize_scraped_items(raw_items)

    # Assert
    assert len(normalized) == 1
    item = normalized[0]
    assert item["retailer_name"] == "cargills"
    assert item["category_name"] == "dairy"
    assert item["original_price"] == 180.0
    assert item["discounted_price"] is None
    assert item["price"] == 180.0


def test_infer_retailer_from_url_extracts_clean_domain_name():
    # Arrange
    url = "https://www.keellssuper.com/fresh-vegetables"

    # Act
    result = infer_retailer_from_url(url)

    # Assert
    assert result == "keellssuper"


def test_upsert_products_and_prices_uses_mocked_database_connection():
    # Arrange
    items = [
        {
            "category_id": "cat-1",
            "category_name": "dairy",
            "category_label": "Dairy",
            "retailer_id": "ret-1",
            "retailer_name": "cargills",
            "retailer_map_query": "cargills",
            "product_id": "prod-1",
            "product_name": "Milk 1L",
            "product_name_sinhala": "Milk 1L",
            "product_image": "https://example.com/milk.jpg",
            "price_id": "price-1",
            "price": 180.0,
            "original_price": 200.0,
            "discounted_price": 180.0,
            "source_url": "https://example.com/milk",
        }
    ]
    mocked_cursor = MagicMock()
    mocked_connection = MagicMock()
    mocked_connection.__enter__.return_value = mocked_connection
    mocked_connection.__exit__.return_value = None
    mocked_connection.cursor.return_value.__enter__.return_value = mocked_cursor

    # Act
    with patch("db_pipeline.psycopg2.connect", return_value=mocked_connection):
        result = __import__("db_pipeline").upsert_products_and_prices(items, database_url="postgresql://fake/db")

    # Assert
    assert result == {"rows_processed": 1, "rows_saved": 1}
    assert mocked_cursor.execute.call_count == 4
    mocked_connection.commit.assert_not_called()


def test_infer_category_uses_first_path_segment_when_category_missing():
    # Arrange
    item = {"source_url": "https://example.com/fresh-fruits/banana-offer"}

    # Act
    result = _infer_category(item)

    # Assert
    assert result == "fresh fruits"


def test_normalize_scraped_items_skips_rows_without_valid_name_or_price():
    # Arrange
    raw_items = [
        {"product_name": "   ", "original_price": "Rs. 120"},
        {"product_name": "Tomato", "original_price": None, "discounted_price": None},
    ]

    # Act
    normalized = normalize_scraped_items(raw_items)

    # Assert
    assert normalized == []
