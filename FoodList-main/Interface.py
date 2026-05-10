import streamlit as st
from scrape import scrape_website, clean_body_content, extract_products, extract_products_retailer2, extract_products_retailer4
from db_pipeline import normalize_scraped_items, upsert_products_and_prices, infer_retailer_from_url


def _scrape_with_retailer_options(retailer_label: str, url: str):
    # Retailer 1: Cargills - Enable pagination to scrape all pages
    if retailer_label == "Retailer 1":
        return scrape_website(url, wait_seconds=60, slow_scroll=True, paginate=True, max_pages=None)

    # Retailer 2: Keells - Scrape all pages (changed from max_pages=10 to max_pages=None)
    if retailer_label == "Retailer 2":
        return scrape_website(url, wait_seconds=60, slow_scroll=True, paginate=True, max_pages=None)

    # Retailer 3: Spar2u - Scrape all pages
    if retailer_label == "Retailer 3":
        return scrape_website(url, wait_seconds=60, slow_scroll=True, paginate=True, max_pages=None)

    # Retailer 4: Glomark - Single page with Show More button loading (no pagination)
    if retailer_label == "Retailer 4":
        return scrape_website(url, wait_seconds=60, slow_scroll=True, paginate=False, max_pages=1)

    return scrape_website(url)

RETAILER_URLS = {
    "Retailer 1": [
        "https://cargillsonline.com/Product/Dairy?IC=Ng==&NC=RGFpcnk=",
      
     
    ],
    "Retailer 2": [
    
        "https://www.keellssuper.com/keells-promotions",
        "https://www.keellssuper.com/showcaseint/items/keells_exclusives",
        "https://www.keellssuper.com/product?cat=5&s=1", 
        "https://www.keellssuper.com/showcaseint/items/keells_products",
        "https://www.keellssuper.com/",
        "https://www.keellssuper.com/snacks",
        "https://www.keellssuper.com/biscuits",
        "https://www.keellssuper.com/eggs",
        "https://www.keellssuper.com/bakery",
        "https://www.keellssuper.com/rice",
        "https://www.keellssuper.com/soya_meat", 
        "https://www.keellssuper.com/sugar",
        "https://www.keellssuper.com/confectionery",
        "https://www.keellssuper.com/bakery",
        "https://www.keellssuper.com/family-consumption-beverages",
        "https://www.keellssuper.com/water",
        "https://www.keellssuper.com/malt-chocolate-drinks",
        "https://www.keellssuper.com/powdered-liquid-milk",
        "https://www.keellssuper.com/tea",
        "https://www.keellssuper.com/cheese",
        "https://www.keellssuper.com/yoghurts-curd",
        "https://www.keellssuper.com/frozen-rtc-snacks",
        "https://www.keellssuper.com/pasta-noodles",
        "https://www.keellssuper.com/fresh-vegetables",
        "https://www.keellssuper.com/fresh-fruits",
        "https://www.keellssuper.com/poultry",
        "https://www.keellssuper.com/fresh-fish",
        "https://www.keellssuper.com/red-meats",
        "https://www.keellssuper.com/chilled-desserts",
        "https://www.keellssuper.com/showcaseint/items/keells_products",
         

    ],
    "Retailer 3": [
        "https://spar2u.lk/collections/meat",
        "https://spar2u.lk/collections/bakery",
        "https://spar2u.lk/collections/vegetables",
        "http://spar2u.lk/collections/fruits",
        "https://spar2u.lk/collections/grocery",
        "https://spar2u.lk/collections/powdered-milk",
        "https://spar2u.lk/collections/liquid-milk",
        "https://spar2u.lk/collections/tea",
        "https://spar2u.lk/collections/coffee",
        "https://spar2u.lk/collections/desserts",
        "https://spar2u.lk/collections/sweets-snacks",
        "https://spar2u.lk/collections/health-beauty",
        "https://spar2u.lk/collections/chilled",
        "https://spar2u.lk/collections/frozens",
        "https://spar2u.lk/collections/household",
        "https://spar2u.lk/collections/general-merchandise",
        "http://spar2u.lk/collections/spar-local",
        "https://spar2u.lk/collections/pet-care",
   
    ],
    "Retailer 4": [
        "https://glomark.lk/deal-page",
      
    ],
}


def normalize_urls(raw_urls: list[str]) -> list[str]:
    normalized = []
    seen = set()

    for entry in raw_urls or []:
        if not entry:
            continue

        chunks = str(entry).replace(";", "\n").splitlines()
        for chunk in chunks:
            parts = chunk.split(",")
            for part in parts:
                url = part.strip().strip('"').strip("'")
                if not url:
                    continue
                if not (url.startswith("http://") or url.startswith("https://")):
                    continue
                if url in seen:
                    continue
                seen.add(url)
                normalized.append(url)

    return normalized


def scrape_retailer(retailer_label: str, urls: list[str]):
    urls = normalize_urls(urls)
    if not urls:
        st.warning(f"No URLs configured for {retailer_label}.")
        return

    combined_dom = []
    combined_items = []
    
    # Select appropriate extractor function based on retailer
    if retailer_label == "Retailer 2":
        extractor = extract_products_retailer2
    elif retailer_label == "Retailer 4":
        extractor = extract_products_retailer4
    else:
        extractor = extract_products

    for idx, url in enumerate(urls, start=1):
        with st.spinner(f"Scraping {retailer_label} page {idx}/{len(urls)}..."):
            try:
                result = _scrape_with_retailer_options(retailer_label, url)
                if result:
                    cleaned_content = clean_body_content(result)
                    if not cleaned_content or not cleaned_content.strip():
                        cleaned_content = (result or "").strip()[:12000]
                    combined_dom.append(f"\n\n===== {url} =====\n{cleaned_content}")

                    if retailer_label == "Retailer 2":
                        specialized_items = extract_products_retailer2(result) or []
                        generic_items = extract_products(result) or []

                        merged = []
                        seen_items = set()
                        for item in specialized_items + generic_items:
                            name = str(item.get("product_name") or "").strip().lower()
                            original = item.get("original_price")
                            discounted = item.get("discounted_price")
                            key = (name, original, discounted)
                            if not name or key in seen_items:
                                continue
                            seen_items.add(key)
                            merged.append(item)

                        html_products = merged
                    else:
                        html_products = extractor(result)
                    if html_products:
                        for item in html_products:
                            item["source_url"] = url
                            item["retailer_name"] = infer_retailer_from_url(url)
                        combined_items.extend(html_products)
                else:
                    st.error(f"Failed to scrape {url} - no content returned")
            except Exception as e:
                st.error(f"Scraping failed for {url}: {str(e)}")

    st.session_state.dom_content = "\n".join(combined_dom)
    st.session_state.extracted_items = combined_items
    st.session_state.last_retailer = retailer_label

    if combined_items:
        st.success(f"{retailer_label} scraping completed!")
    else:
        st.warning(f"{retailer_label} scraping completed, but no valid product items were found.")

st.title("Web Scraping")
st.caption("Use the retailer buttons to scrape each configured retailer separately.")

with st.expander("Configured Retailer URLs"):
    for retailer_label, urls in RETAILER_URLS.items():
        st.write(f"**{retailer_label}**")
        if urls:
            for url in urls:
                st.write(f"- {url}")
        else:
            st.write("- No URLs added yet")

if 'dom_content' not in st.session_state:
    st.session_state.dom_content = ""
if 'extracted_items' not in st.session_state:
    st.session_state.extracted_items = []
if 'last_retailer' not in st.session_state:
    st.session_state.last_retailer = ""

retailer_labels = list(RETAILER_URLS.keys())
col1, col2, col3, col4 = st.columns(4)

with col1:
    if st.button(f"Scrape {retailer_labels[0]}"):
        scrape_retailer(retailer_labels[0], RETAILER_URLS[retailer_labels[0]])

with col2:
    if st.button(f"Scrape {retailer_labels[1]}"):
        scrape_retailer(retailer_labels[1], RETAILER_URLS[retailer_labels[1]])

with col3:
    if st.button(f"Scrape {retailer_labels[2]}"):
        scrape_retailer(retailer_labels[2], RETAILER_URLS[retailer_labels[2]])

with col4:
    if st.button(f"Scrape {retailer_labels[3]}"):
        scrape_retailer(retailer_labels[3], RETAILER_URLS[retailer_labels[3]])

# Show cleaned DOM
if st.session_state.dom_content:
    with st.expander("View DOM Content"):
        st.text_area(
            "DOM Content", 
            st.session_state.dom_content, 
            height=300
        )

if st.session_state.extracted_items:
    st.subheader("Scraped Product Data")
    if st.session_state.last_retailer == "Retailer 2":
        ordered_columns = [
            "product_name",
            "discounted_price",
            "original_price",
            "source_url",
            "retailer_name",
        ]
    else:
        preferred_columns = [
            "product_name",
            "discounted_price",
            "original_price",
            "save_amount",
            "retailer_name",
            "source_url",
        ]

        ordered_columns = []
        first_item = st.session_state.extracted_items[0] if st.session_state.extracted_items else {}
        for col in preferred_columns:
            if col in first_item:
                ordered_columns.append(col)

        for col in first_item.keys():
            if col not in ordered_columns:
                ordered_columns.append(col)

    table_rows = [
        {col: item.get(col) for col in ordered_columns}
        for item in st.session_state.extracted_items
    ]

    st.dataframe(table_rows, width="stretch")

    if st.button("Save Scraped Data to Database"):
        try:
            normalized_items = normalize_scraped_items(st.session_state.extracted_items)
            result = upsert_products_and_prices(normalized_items)
            st.success(
                f"Saved to DB successfully. Processed: {result['rows_processed']}, Saved: {result['rows_saved']}"
            )
        except Exception as exc:
            st.error(f"Database save failed: {str(exc)}")
