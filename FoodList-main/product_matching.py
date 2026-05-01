"""Product matching helpers.

This module keeps keyword/fuzzy matching separate from scraping so the scraper
only extracts products, while this module handles DB comparison.
"""

from __future__ import annotations

import importlib.util
from typing import Optional


def _load_backend_search_module():
    """Load the backend search module by path.

    The backend folder in this workspace is not packaged, so we import by file
    location to avoid coupling this scraper-side helper to package layout.
    """
    import os

    search_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "pricepulse", "backend", "app", "utils", "search.py"))
    if not os.path.exists(search_path):
        search_path = os.path.normpath(os.path.join(os.getcwd(), "pricepulse", "backend", "app", "utils", "search.py"))

    spec = importlib.util.spec_from_file_location("pricepulse_search", search_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load search module from {search_path}")

    search_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(search_module)
    return search_module


def match_products_against_db(
    products: list[dict],
    db_session,
    category_id: Optional[str] = None,
    candidates_per_item: int = 5,
    min_score: float = 0.1,
) -> list[dict]:
    """Match extracted products against the database product catalog."""
    items = [
        {"name": product.get("product_name"), "quantity": 1}
        for product in products
        if product.get("product_name")
    ]

    if not items:
        return []

    search_module = _load_backend_search_module()
    process_grocery_list = getattr(search_module, "process_grocery_list")

    return process_grocery_list(
        items,
        db_session,
        category_id=category_id,
        candidates_per_item=candidates_per_item,
        min_score=min_score,
    )