import pathlib
import sys
from unittest.mock import MagicMock


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from scrape import _click_next_page, _is_valid_product_name


def test_is_valid_product_name_rejects_non_product_text():
    # Arrange
    invalid_name = "Add to Cart"

    # Act
    result = _is_valid_product_name(invalid_name)

    # Assert
    assert result is False


def test_is_valid_product_name_accepts_messy_but_real_product_name():
    # Arrange
    valid_name = "  Fresh Tomato 500g "

    # Act
    result = _is_valid_product_name(valid_name)

    # Assert
    assert result is True


def test_click_next_page_uses_keells_specific_page_button():
    # Arrange
    active_button = MagicMock()
    active_button.get_attribute.side_effect = lambda attr: "page-number-button active" if attr == "class" else None
    active_button.text = "1"
    active_button.is_displayed.return_value = True

    next_button = MagicMock()
    next_button.get_attribute.side_effect = lambda attr: "page-number-button" if attr == "class" else None
    next_button.text = "2"
    next_button.is_displayed.return_value = True

    driver = MagicMock()
    driver.current_url = "https://www.keellssuper.com/fresh-vegetables"
    driver.find_elements.side_effect = [
        [active_button, next_button],
        [],
    ]

    # Act
    result = _click_next_page(driver, retailer_hint="keells")

    # Assert
    assert result is True
    assert next_button.click.called or driver.execute_script.called
