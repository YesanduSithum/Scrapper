import pathlib
import sys
from types import SimpleNamespace


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from app.utils.search import calculate_similarity_score, normalize_text, search_products_by_name


def test_normalize_text_removes_extra_spaces_and_symbols():
    # Arrange
    text = "  Rs. Fresh-Milk!!  "

    # Act
    result = normalize_text(text)

    # Assert
    assert result == "rs  fresh milk"


def test_calculate_similarity_score_rewards_close_product_name_match():
    # Arrange
    product = SimpleNamespace(name="Fresh Milk 1L", nameSinhala="Fresh Milk 1L")

    # Act
    score = calculate_similarity_score("fresh milk", product, category_label="dairy")

    # Assert
    assert score > 0.5


def test_search_products_by_name_returns_sorted_mocked_matches():
    # Arrange
    product_1 = SimpleNamespace(
        name="Fresh Milk 1L",
        nameSinhala="Fresh Milk 1L",
        category=SimpleNamespace(label="Dairy"),
        prices=[SimpleNamespace(price=180.0, retailer=SimpleNamespace(name="Cargills"))],
        categoryId="cat-1",
        id="prod-1",
        image="milk.jpg",
        retailerId="ret-1",
    )
    product_2 = SimpleNamespace(
        name="Butter",
        nameSinhala="Butter",
        category=SimpleNamespace(label="Dairy"),
        prices=[SimpleNamespace(price=350.0, retailer=SimpleNamespace(name="Keells"))],
        categoryId="cat-1",
        id="prod-2",
        image="butter.jpg",
        retailerId="ret-2",
    )

    class MockSession:
        def scalars(self, _statement):
            return SimpleNamespace(all=lambda: [product_1, product_2])

    db = MockSession()

    # Act
    results = search_products_by_name("fresh milk", db=db, limit=2, min_score=0.0)

    # Assert
    assert len(results) == 2
    assert results[0]["product"].name == "Fresh Milk 1L"
    assert results[0]["score"] >= results[1]["score"]
