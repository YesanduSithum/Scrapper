"""
Search utility module for matching app-user grocery list items against database products.

This module is used when a user types a grocery list item in the app and clicks
Process. It ranks DB products by how closely they match the user's text,
including typo tolerance and token similarity.
"""

import re
from difflib import SequenceMatcher
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from app.db.models import Product, Category, Price


def normalize_text(value: str) -> str:
    """
    Normalize text by converting to lowercase and removing special characters.
    
    Args:
        value: Text to normalize
    
    Returns:
        Normalized text string
    """
    return re.sub(r"[^a-z0-9\s]+", " ", (value or "").lower()).strip()


def tokenize(value: str) -> set[str]:
    """
    Split normalized text into tokens (words).
    
    Args:
        value: Text to tokenize
    
    Returns:
        Set of word tokens
    """
    return {token for token in normalize_text(value).split() if token}


def _token_similarity(query_tokens: set[str], candidate_tokens: set[str]) -> float:
    """Compare tokens with typo tolerance.

    This helps with inputs like `kotmle frsh milk` matching
    `kotmale fresh milk 1 l bottle`.
    """
    if not query_tokens or not candidate_tokens:
        return 0.0

    exact_overlap = len(query_tokens & candidate_tokens) / len(query_tokens | candidate_tokens)

    fuzzy_hits = []
    candidate_list = list(candidate_tokens)
    for query_token in query_tokens:
        best_ratio = 0.0
        for candidate_token in candidate_list:
            ratio = SequenceMatcher(None, query_token, candidate_token).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
        fuzzy_hits.append(best_ratio)

    fuzzy_token_score = sum(fuzzy_hits) / len(fuzzy_hits) if fuzzy_hits else 0.0

    return (exact_overlap * 0.45) + (fuzzy_token_score * 0.55)


def _phrase_similarity(query: str, candidate: str) -> float:
    """Compare the full normalized strings."""
    if not query or not candidate:
        return 0.0

    ratio = SequenceMatcher(None, query, candidate).ratio()

    if query in candidate or candidate in query:
        ratio = max(ratio, 1.0)

    return ratio


def calculate_similarity_score(query: str, product: Product, category_label: Optional[str] = None) -> float:
    """
    Calculate similarity score between query and product.
    
    Combines three scoring methods:
    1. Sequence matching (60% weight) - checks if query appears in product name
    2. Token overlap (30% weight) - checks word-level match
    3. Substring match (10% weight) - exact substring matching
    
    Args:
        query: Search query from user
        product: Product object to score
        category_label: Category label for additional context
    
    Returns:
        Similarity score between 0.0 and 1.0
    """
    normalized_query = normalize_text(query)
    if not normalized_query:
        return 0.0

    product_names = [product.name or "", product.nameSinhala or ""]
    sequence_scores = [_phrase_similarity(normalized_query, normalize_text(name)) for name in product_names]
    best_sequence_score = max(sequence_scores) if sequence_scores else 0.0

    query_tokens = tokenize(normalized_query)
    candidate_tokens = tokenize(product.name) | tokenize(product.nameSinhala)
    if category_label:
        candidate_tokens |= tokenize(category_label)

    token_score = _token_similarity(query_tokens, candidate_tokens)

    substring_score = 0.0
    for name in product_names:
        normalized_name = normalize_text(name)
        if normalized_query in normalized_name or normalized_name in normalized_query:
            substring_score = 1.0
            break

    # Weighted combination tuned for noisy grocery-list input.
    final_score = (
        (best_sequence_score * 0.45)
        + (token_score * 0.45)
        + (substring_score * 0.10)
    )
    
    return final_score


def search_products_by_name(
    query: str,
    db: Session,
    category_id: Optional[str] = None,
    limit: int = 10,
    min_score: float = 0.0,
) -> list[dict]:
    """
    Search for products matching query with fuzzy matching and optional category filtering.
    
    Args:
        query: Search query
        db: Database session
        category_id: Optional category ID to filter by
        limit: Maximum number of results to return
        min_score: Minimum similarity score threshold
    
    Returns:
        List of dicts with product data and similarity scores, sorted by score descending
    """
    if not query or not query.strip():
        return []

    stmt = select(Product).options(
        Product.category,
        Product.prices,
    )
    
    # Filter by category if provided
    if category_id:
        stmt = stmt.where(Product.categoryId == category_id)
    
    products = db.scalars(stmt).all()
    
    scored_products = []
    for product in products:
        category_label = product.category.label if product.category else ""
        score = calculate_similarity_score(query, product, category_label)
        
        if score >= min_score:
            scored_products.append({
                "product": product,
                "score": score,
            })
    
    scored_products.sort(key=lambda x: x["score"], reverse=True)
    return scored_products[:limit]


def process_grocery_list(
    items: list[dict],  # [{"name": "milk", "quantity": 1}, ...]
    db: Session,
    category_id: Optional[str] = None,
    candidates_per_item: int = 5,
    min_score: float = 0.1,
) -> list[dict]:
    """
    Process a grocery list and find matching products for each item.
    
    Args:
        items: List of dicts with item names and quantities
        db: Database session
        category_id: Optional category ID to filter by
        candidates_per_item: Number of candidates to return per item
        min_score: Minimum similarity score threshold
    
    Returns:
        Processed list with matched products for each item
    """
    results = []
    
    for item in items:
        item_name = item.get("name", "").strip()
        quantity = item.get("quantity", 1)
        
        if not item_name:
            continue
        
        # Search for matching products
        matches = search_products_by_name(
            query=item_name,
            db=db,
            category_id=category_id,
            limit=candidates_per_item,
            min_score=min_score,
        )
        
        # Format results
        candidates = [
            {
                "id": match["product"].id,
                "name": match["product"].name,
                "nameSinhala": match["product"].nameSinhala,
                "image": match["product"].image,
                "categoryId": match["product"].categoryId,
                "similarity": round(match["score"], 3),
                "prices": [
                    {
                        "retailerId": price.retailerId,
                        "retailer": price.retailer.name if price.retailer else None,
                        "price": price.price,
                    }
                    for price in match["product"].prices
                ],
            }
            for match in matches
        ]
        
        results.append({
            "userInput": item_name,
            "quantity": quantity,
            "candidates": candidates,
            "bestMatch": candidates[0] if candidates else None,
        })
    
    return results
