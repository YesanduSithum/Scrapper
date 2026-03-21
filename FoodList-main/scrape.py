import selenium.webdriver as webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoSuchWindowException
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import re
import json
import base64

INVALID_NAME_PHRASES = {
    "add to cart",
    "view cart",
    "buy now",
    "out of stock",
    "in stock",
    "quick view",
    "wishlist",
    "compare",
    "sale",
    "offer",
    "shop now",
    "learn more",
}


def _is_valid_product_name(name):
    if not name:
        return False

    text = " ".join(str(name).split()).strip()
    if len(text) < 3 or len(text) > 140:
        return False

    lowered = text.lower()
    if lowered in INVALID_NAME_PHRASES:
        return False

    if re.fullmatch(r"[\d\s,.$€£₹%-]+", text):
        return False

    if not re.search(r"[A-Za-z]", text):
        return False

    return True


def _click_next_page(driver):
    next_selectors = [
        "a[rel='next']",
        "button[rel='next']",
        "a[aria-label*='Next']",
        "button[aria-label*='Next']",
        "a[aria-label*='next']",
        "button[aria-label*='next']",
        "a[title*='Next']",
        "button[title*='Next']",
        "a[class*='next']",
        "button[class*='next']",
        "[data-testid*='next']",
        ".pagination .next a",
        ".pagination-next a",
        "li.next a",
    ]

    def _try_click(element):
        try:
            class_name = (element.get_attribute("class") or "").lower()
            aria_disabled = (element.get_attribute("aria-disabled") or "").lower()
            if "disabled" in class_name or aria_disabled == "true":
                return False
            if not element.is_displayed():
                return False

            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.5)

            try:
                element.click()
            except Exception:
                try:
                    ActionChains(driver).move_to_element(element).pause(0.1).click(element).perform()
                except Exception:
                    driver.execute_script("arguments[0].click();", element)
            return True
        except Exception:
            return False

    for selector in next_selectors:
        elements = driver.find_elements(By.CSS_SELECTOR, selector)
        for element in elements:
            if _try_click(element):
                return True

    # Icon/text based next controls (>, ›, », next)
    xpath_candidates = [
        "//a[normalize-space()='>' or normalize-space()='›' or normalize-space()='»' or contains(translate(normalize-space(), 'NEXT', 'next'), 'next')]",
        "//button[normalize-space()='>' or normalize-space()='›' or normalize-space()='»' or contains(translate(normalize-space(), 'NEXT', 'next'), 'next')]",
        "//*[contains(@class,'pagination')]//a[normalize-space()='>' or normalize-space()='›' or normalize-space()='»']",
        "//*[contains(@class,'pagination')]//button[normalize-space()='>' or normalize-space()='›' or normalize-space()='»']",
    ]
    for xpath in xpath_candidates:
        elements = driver.find_elements(By.XPATH, xpath)
        for element in elements:
            if _try_click(element):
                return True

    # Numeric pagination fallback: click current+1 if available.
    current_page = None
    active_xpath_candidates = [
        "//*[contains(@class,'active')]//a",
        "//*[contains(@class,'active')]//span",
        "//*[contains(@class,'selected')]//a",
        "//*[contains(@class,'selected')]//span",
        "//*[@aria-current='page']",
    ]
    for xpath in active_xpath_candidates:
        elements = driver.find_elements(By.XPATH, xpath)
        for element in elements:
            text = (element.text or "").strip()
            if text.isdigit():
                current_page = int(text)
                break
        if current_page is not None:
            break

    if current_page is not None:
        next_page = str(current_page + 1)
        next_num_xpath = (
            "//a[normalize-space()='" + next_page + "'] | "
            "//button[normalize-space()='" + next_page + "']"
        )
        elements = driver.find_elements(By.XPATH, next_num_xpath)
        for element in elements:
            if _try_click(element):
                return True

    # JS fallback for SPA pagers where handlers are attached dynamically.
    try:
        clicked = driver.execute_script(
            """
            const candidates = Array.from(document.querySelectorAll('a,button,[role="button"]'));
            const valid = candidates.filter(el => {
              const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
              const cls = (el.className || '').toString().toLowerCase();
              const aria = (el.getAttribute('aria-label') || '').toLowerCase();
              const title = (el.getAttribute('title') || '').toLowerCase();
              const disabled = el.getAttribute('aria-disabled') === 'true' || cls.includes('disabled');
              if (disabled) return false;
              return txt === '>' || txt === '›' || txt === '»' || txt.includes('next') || cls.includes('next') || aria.includes('next') || title.includes('next');
            });
            if (!valid.length) return false;
            valid[0].scrollIntoView({block: 'center'});
            valid[0].click();
            return true;
            """
        )
        if clicked:
            return True
    except Exception:
        pass

    return False


def _is_driver_alive(driver):
    if driver is None:
        return False
    try:
        _ = driver.window_handles
        return True
    except Exception:
        return False


def _is_closed_window_error(exc):
    msg = str(exc).lower()
    return (
        "no such window" in msg
        or "target window already closed" in msg
        or "web view not found" in msg
        or "invalid session id" in msg
    )


def _safe_quit(driver):
    if driver is None:
        return
    try:
        driver.quit()
    except Exception as quit_exc:
        print(f"Browser quit warning: {quit_exc}")


def scrape_website(website, wait_seconds=45, slow_scroll=False, paginate=False, max_pages=1):
    print("Launching chrome browser")
    driver = None
    html_pages = []
    # Automatically download and use the correct ChromeDriver version
    options = webdriver.ChromeOptions()
    options.add_argument("--no-sandbox")  # Bypass OS security model
    options.add_argument("--disable-dev-shm-usage")  # Prevent shared memory issues
    options.add_argument("--disable-images")  # Disable images for faster loading
    options.add_argument("--disable-blink-features=AutomationControlled")  # Hide automation
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    options.add_experimental_option("excludeSwitches", ["enable-automation"])  # Remove automation flags
    options.add_experimental_option("useAutomationExtension", False)  # Disable extensions
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    try:
        # Prefer Selenium Manager; fallback to webdriver-manager
        try:
            driver = webdriver.Chrome(options=options)
        except Exception as e:
            print(f"Selenium Manager failed: {e}. Falling back to webdriver-manager.")
            driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=options
            )
        # Execute JavaScript to hide automation indicators
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": "Object.defineProperty(navigator, 'webdriver', {get: () => false});"
        })
        #automating the browser
        driver.execute_cdp_cmd("Network.enable", {})
        driver.get(website)
        print("waiting for Page Loaded ...")
        wait = WebDriverWait(driver, wait_seconds)
        wait.until(lambda d: d.execute_script("return document.readyState") in ("interactive", "complete"))

        try:
            wait.until(
                EC.presence_of_element_located((
                    By.CSS_SELECTOR,
                    ".product-item, .product-content, .price-new, .product-title, [class*='product'], [data-testid*='product']"
                ))
            )
        except TimeoutException:
            wait.until(
                lambda d: len(
                    (d.find_element(By.TAG_NAME, "body").text or "").strip()
                ) > 120
            )

        # Extra wait for JS-heavy product grids
        try:
            extra_wait = max(20, min(wait_seconds, 40))
            WebDriverWait(driver, extra_wait).until(
                lambda d: len(d.find_elements(By.CSS_SELECTOR, ".product-item, .product-content, .product-card, [class*='product'], [data-testid*='product']")) > 0
            )
        except TimeoutException:
            pass

        def _scroll_current_page():
            if slow_scroll:
                max_passes = 18
                stable_passes = 0

                for _ in range(max_passes):
                    current_height = driver.execute_script(
                        "return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);"
                    )
                    if not current_height or current_height <= 0:
                        break

                    viewport_height = driver.execute_script("return window.innerHeight;") or 800
                    step = max(400, int(viewport_height * 0.85))

                    position = 0
                    while position < current_height:
                        driver.execute_script("window.scrollTo(0, arguments[0]);", position)
                        time.sleep(1.0)
                        position += step

                    driver.execute_script("window.scrollTo(0, arguments[0]);", current_height)
                    time.sleep(2.2)

                    new_height = driver.execute_script(
                        "return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);"
                    )

                    if new_height <= current_height + 50:
                        stable_passes += 1
                    else:
                        stable_passes = 0

                    if stable_passes >= 2:
                        break
            else:
                for ratio in (0.35, 0.7, 1.0):
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight * arguments[0]);", ratio)
                    time.sleep(1.4)

            driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1.6 if slow_scroll else 1.2)

        def _capture_html_with_network():
            page_html = driver.execute_script("return document.documentElement.outerHTML;")
            network_payloads = _collect_network_product_payloads(driver)
            if network_payloads and "__CAPTURED_NETWORK_JSON__" not in page_html:
                payload_json = json.dumps(network_payloads, ensure_ascii=False)
                if "</body>" in page_html:
                    page_html = page_html.replace(
                        "</body>",
                        f'<script id="__CAPTURED_NETWORK_JSON__" type="application/json">{payload_json}</script></body>'
                    )
                else:
                    page_html += f'\n<script id="__CAPTURED_NETWORK_JSON__" type="application/json">{payload_json}</script>\n'
            return page_html

        html_pages = []
        max_pages_to_scrape = max(1, max_pages if paginate else 1)

        for page_idx in range(max_pages_to_scrape):
            _scroll_current_page()
            page_html = _capture_html_with_network()

            if page_html and len(page_html.strip()) >= 200:
                html_pages.append(page_html)

            if page_idx == max_pages_to_scrape - 1:
                break

            if not paginate:
                break

            before_url = driver.current_url
            moved = _click_next_page(driver)
            if not moved:
                break

            try:
                WebDriverWait(driver, 20).until(
                    lambda d: d.execute_script("return document.readyState") in ("interactive", "complete")
                )
            except TimeoutException:
                pass

            time.sleep(2.0)
            after_url = driver.current_url

            # If URL and visible page do not change, stop to avoid loops
            if before_url == after_url:
                # keep one extra attempt only when new products may still load via JS pagination
                try:
                    WebDriverWait(driver, 8).until(
                        lambda d: len(d.find_elements(By.CSS_SELECTOR, ".product-item, .product-content, .product-card, [class*='product'], [data-testid*='product']")) > 0
                    )
                except TimeoutException:
                    break

        html = "\n\n<!-- PAGE_SPLIT -->\n\n".join(html_pages)
        if not html or len(html.strip()) < 200:
            raise ValueError("Empty or too small page source returned.")
        return html
    except TimeoutException:
        print("Timeout while loading the page.")
        if _is_driver_alive(driver):
            try:
                return driver.page_source
            except Exception:
                pass
        if html_pages:
            return "\n\n<!-- PAGE_SPLIT -->\n\n".join(html_pages)
        return None
    except NoSuchWindowException as e:
        print(f"Browser window closed unexpectedly: {e}")
        if html_pages:
            return "\n\n<!-- PAGE_SPLIT -->\n\n".join(html_pages)
        return None
    except WebDriverException as e:
        if _is_closed_window_error(e):
            print(f"Browser session closed unexpectedly: {e}")
            if html_pages:
                return "\n\n<!-- PAGE_SPLIT -->\n\n".join(html_pages)
            return None
        print(f"WebDriver error occurred: {e}")
        return None
    except Exception as e:
        if _is_closed_window_error(e):
            print(f"Browser session closed unexpectedly: {e}")
            if html_pages:
                return "\n\n<!-- PAGE_SPLIT -->\n\n".join(html_pages)
            return None
        print(f"An error occurred: {e}")
        return None
    finally:
        if driver is not None:
            _safe_quit(driver)
            print("Closing the browser.")

def clean_body_content(html_content):
    soup = BeautifulSoup(html_content, "html.parser")

    # Remove scripts, styles, asides and other non-content tags
    for tag in soup(["script", "style", "aside"]):
        tag.extract()

    # Get visible text and normalize whitespace
    cleaned_content = soup.get_text(separator="\n")
    cleaned_content = "\n".join(
        line.strip() for line in cleaned_content.splitlines() if line.strip()
    )

    if len(cleaned_content) < 80:
        body = soup.body
        if body:
            body_text = body.get_text(separator="\n")
            body_text = "\n".join(
                line.strip() for line in body_text.splitlines() if line.strip()
            )
            if len(body_text) > len(cleaned_content):
                cleaned_content = body_text

    return cleaned_content

def split_dom_content(dom_content,max_length=6000):
    return[
        dom_content[i: i+ max_length] for i in range (0,len(dom_content),max_length)
    ]


def _collect_network_product_payloads(driver):
    payloads = []
    seen_urls = set()
    keywords = ("product", "products", "category", "department", "search", "item")

    try:
        perf_logs = driver.get_log("performance")
    except Exception:
        return payloads

    for entry in perf_logs:
        try:
            message = json.loads(entry.get("message", "{}")).get("message", {})
            if message.get("method") != "Network.responseReceived":
                continue

            params = message.get("params", {})
            response = params.get("response", {})
            url = (response.get("url") or "").lower()
            mime_type = (response.get("mimeType") or "").lower()
            resource_type = (params.get("type") or "").lower()

            if not any(key in url for key in keywords):
                continue

            if resource_type not in ("xhr", "fetch") and "json" not in mime_type:
                continue

            request_id = params.get("requestId")
            if not request_id or url in seen_urls:
                continue

            body_data = driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id})
            body = body_data.get("body", "")
            if body_data.get("base64Encoded"):
                body = base64.b64decode(body).decode("utf-8", errors="ignore")

            body = (body or "").strip()
            if not body:
                continue

            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                continue

            payloads.append(parsed)
            seen_urls.add(url)
        except Exception:
            continue

    return payloads


def _iter_dicts(value):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from _iter_dicts(nested)
    elif isinstance(value, list):
        for item in value:
            yield from _iter_dicts(item)


def _extract_from_payloads(payloads):
    products = []
    seen = set()

    name_keys = ("product_name", "productname", "name", "itemname", "title")
    current_price_keys = ("discounted_price", "discountprice", "saleprice", "price", "amount", "sellingprice")
    original_price_keys = ("original_price", "mrp", "regularprice", "listprice", "wasprice")

    for payload in payloads:
        for node in _iter_dicts(payload):
            normalized = {str(k).lower().replace(" ", ""): v for k, v in node.items()}

            name = None
            for key in name_keys:
                raw = normalized.get(key)
                if isinstance(raw, str) and _is_valid_product_name(raw):
                    name = " ".join(raw.split()).strip()
                    break
            if not name:
                continue

            discounted_price = None
            original_price = None

            for key in current_price_keys:
                raw = normalized.get(key)
                parsed = _parse_price(str(raw)) if raw is not None else None
                if parsed is not None:
                    discounted_price = parsed
                    break

            for key in original_price_keys:
                raw = normalized.get(key)
                parsed = _parse_price(str(raw)) if raw is not None else None
                if parsed is not None:
                    original_price = parsed
                    break

            if original_price is None and discounted_price is not None:
                original_price = discounted_price
                discounted_price = None

            if original_price is None and discounted_price is None:
                continue

            key = f"{name.lower()}|{original_price}|{discounted_price}"
            if key in seen:
                continue
            seen.add(key)

            save_amount = None
            if original_price is not None and discounted_price is not None:
                save_amount = round(original_price - discounted_price, 2)

            products.append(
                {
                    "product_name": name,
                    "original_price": original_price,
                    "discounted_price": discounted_price,
                    "discount_percent": None,
                    "save_amount": save_amount,
                }
            )

    return products


def _parse_price(text):
    if not text:
        return None
    match = re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", text)
    if not match:
        return None
    value = match[0].replace(",", "")
    try:
        return float(value)
    except ValueError:
        return None


def _extract_discount_percent_from_text(text):
    if not text:
        return None

    match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if not match:
        return None

    try:
        return float(match.group(1))
    except ValueError:
        return None


def _extract_prices_from_card_text(card):
    card_text = card.get_text(" ", strip=True)
    if not card_text:
        return None, None

    raw_numbers = re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?", card_text)
    if not raw_numbers:
        return None, None

    values = []
    for raw in raw_numbers:
        try:
            value = float(raw.replace(",", ""))
        except ValueError:
            continue
        if value <= 0:
            continue
        values.append(value)

    if not values:
        return None, None

    unique_values = []
    seen_vals = set()
    for value in values:
        normalized = round(value, 2)
        if normalized in seen_vals:
            continue
        seen_vals.add(normalized)
        unique_values.append(normalized)

    if len(unique_values) >= 2:
        first = unique_values[0]
        second = unique_values[1]
        if second >= first:
            return second, first
        return first, second

    return unique_values[0], None


def _looks_like_price_text(text):
    if not text:
        return False

    normalized = " ".join(str(text).split()).strip()
    parsed = _parse_price(normalized)
    if parsed is None:
        return False

    lowered = normalized.lower()
    currency_hint = re.search(r"\b(rs\.?|lkr|inr|usd|eur|gbp|price)\b", lowered)

    cleaned = re.sub(r"\b(rs\.?|lkr|inr|usd|eur|gbp|price|unit|off)\b", " ", lowered)
    cleaned = re.sub(r"[\d\s,./₹$€£%-]", "", cleaned)

    return bool(currency_hint) or cleaned == ""


def _extract_retailer2_from_card(card):
    tokens = [" ".join(text.split()).strip() for text in card.stripped_strings if str(text).strip()]
    if not tokens:
        return None, None, None

    stop_tokens = {"add", "off", "%", "/", "unit"}

    has_discount_hint = any(("%" in token) or (token.lower() == "off") for token in tokens)

    name_like_nodes = card.select(
        ".product-title, .product-name, .name, h2, h3, [data-testid*='name'], a[title], img[alt]"
    )
    if len(name_like_nodes) > 1:
        return None, None, None

    price_candidates = []
    for index, token in enumerate(tokens):
        lowered = token.lower()
        if lowered in stop_tokens or "%" in lowered:
            continue

        parsed = _parse_price(token)
        if parsed is None:
            continue

        prev_token = tokens[index - 1].lower() if index > 0 else ""
        next_token = tokens[index + 1].lower() if index < len(tokens) - 1 else ""
        if prev_token in {"%", "off"} or next_token in {"%", "off"}:
            continue

        if re.fullmatch(r"\d+(?:\.\d+)?", token) and parsed <= 3:
            continue

        rounded = round(parsed, 2)
        if rounded not in price_candidates:
            price_candidates.append(rounded)

    def _dedupe(values):
        unique = []
        seen_vals = set()
        for value in values:
            rounded = round(value, 2)
            if rounded in seen_vals:
                continue
            seen_vals.add(rounded)
            unique.append(rounded)
        return unique

    contextual_original = []
    contextual_discounted = []
    contextual_generic = []

    for node in card.select("[class*='price'], [class*='amount'], [class*='mrp'], [class*='cost'], [data-testid*='price']"):
        node_text = node.get_text(" ", strip=True)
        if not node_text:
            continue

        parsed = _parse_price(node_text)
        if parsed is None:
            continue

        lowered_text = node_text.lower()
        if "%" in lowered_text and ("off" in lowered_text or parsed <= 100):
            continue

        if re.fullmatch(r"\d+(?:\.\d+)?", node_text.strip()) and parsed <= 3:
            continue

        value = round(parsed, 2)
        class_text = " ".join(node.get("class", [])).lower()
        attr_text = f"{node.get('data-testid', '')} {node.get('aria-label', '')}".lower()
        context = f"{class_text} {attr_text} {lowered_text}"

        if any(key in context for key in ("old", "original", "mrp", "was", "strike", "regular", "actual")):
            contextual_original.append(value)
        elif any(key in context for key in ("new", "sale", "discount", "now", "special", "final")):
            contextual_discounted.append(value)
        else:
            contextual_generic.append(value)

    contextual_original = _dedupe(contextual_original)
    contextual_discounted = _dedupe(contextual_discounted)
    contextual_generic = _dedupe(contextual_generic)

    name = None

    name_selectors = [
        ".product-title",
        ".product-name",
        ".name",
        "h2",
        "h3",
        "a[title]",
        "[data-name]",
        "[data-title]",
        "img[alt]",
        "[aria-label]",
        "[data-testid*='name']",
    ]

    for selector in name_selectors:
        element = card.select_one(selector)
        if not element:
            continue

        if selector == "img[alt]":
            candidate = (element.get("alt") or "").strip()
        elif selector in ("a[title]", "[data-name]", "[data-title]", "[aria-label]"):
            candidate = (
                element.get("title")
                or element.get("data-name")
                or element.get("data-title")
                or element.get("aria-label")
                or ""
            ).strip()
        else:
            candidate = element.get_text(" ", strip=True)

        if _is_valid_product_name(candidate) and not _looks_like_price_text(candidate):
            name = " ".join(candidate.split()).strip()
            break

    if not name:
        for token in reversed(tokens):
            lowered = token.lower()
            if lowered in stop_tokens or "%" in lowered:
                continue
            if re.fullmatch(r"[\d\s,.$€£₹%-]+", token):
                continue
            if _is_valid_product_name(token) and not _looks_like_price_text(token):
                name = " ".join(token.split()).strip()
                break

    if not name:
        return None, None, None

    original_price = None
    discounted_price = None

    if contextual_discounted and contextual_original:
        discounted_price = contextual_discounted[0]
        original_price = next((p for p in contextual_original if p >= discounted_price), contextual_original[0])
    elif contextual_original and not contextual_discounted:
        original_price = contextual_original[0]
    elif contextual_discounted and not contextual_original:
        if has_discount_hint and contextual_generic:
            discounted_price = contextual_discounted[0]
            original_price = next((p for p in contextual_generic if p >= discounted_price), None)
        else:
            original_price = contextual_discounted[0]
    elif has_discount_hint and len(price_candidates) >= 2:
        discounted_price = price_candidates[0]
        original_price = next((p for p in price_candidates[1:] if p >= discounted_price), price_candidates[1])
    elif len(price_candidates) >= 1:
        original_price = price_candidates[0]

    if original_price is not None and discounted_price is not None and discounted_price >= original_price:
        discounted_price = None

    if original_price is None and discounted_price is not None:
        original_price = discounted_price
        discounted_price = None

    if original_price is None and discounted_price is None:
        return None, None, None

    return name, original_price, discounted_price


def extract_products_retailer2(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    products = []
    seen = set()

    containers = soup.select(
        ".product-item, .product-content, .product-card, .product, .item, [data-testid*='product'], [class*='product']"
    )

    for card in containers:
        name, original_price, discounted_price = _extract_retailer2_from_card(card)
        if not name:
            continue
        if _looks_like_price_text(name):
            continue

        key = name.lower()
        if key in seen:
            continue
        seen.add(key)

        save_amount = None
        if original_price is not None and discounted_price is not None:
            save_amount = round(original_price - discounted_price, 2)

        products.append(
            {
                "product_name": name,
                "original_price": original_price,
                "discounted_price": discounted_price,
                "discount_percent": None,
                "save_amount": save_amount,
            }
        )

    return products


def extract_products(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    products = []
    seen = set()

    def add_product(item):
        name = " ".join(str(item.get("product_name") or "").split()).strip()
        if not _is_valid_product_name(name):
            return
        if _looks_like_price_text(name):
            return

        original_price = _parse_price(str(item.get("original_price"))) if item.get("original_price") is not None else None
        discounted_price = _parse_price(str(item.get("discounted_price"))) if item.get("discounted_price") is not None else None

        if original_price is None and discounted_price is None:
            return

        if original_price is None and discounted_price is not None:
            original_price = discounted_price
            discounted_price = None

        save_amount = None
        if original_price is not None and discounted_price is not None:
            save_amount = round(original_price - discounted_price, 2)

        key = name.lower()
        if key in seen:
            return
        seen.add(key)
        products.append({
            "product_name": name,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_percent": item.get("discount_percent"),
            "save_amount": save_amount,
        })

    def extract_name_from_card(card):
        name_selectors = [
            ".product-title",
            ".product-name",
            ".name",
            "h2",
            "h3",
            "a[title]",
            "[data-name]",
            "[data-title]",
            "img[alt]",
            "[aria-label]",
        ]

        for selector in name_selectors:
            el = card.select_one(selector)
            if not el:
                continue

            candidate = ""
            if selector == "img[alt]":
                candidate = (el.get("alt") or "").strip()
            elif selector in ("a[title]", "[data-name]", "[data-title]", "[aria-label]"):
                candidate = (
                    el.get("title")
                    or el.get("data-name")
                    or el.get("data-title")
                    or el.get("aria-label")
                    or ""
                ).strip()
            else:
                candidate = el.get_text(" ", strip=True)

            if _is_valid_product_name(candidate):
                if _looks_like_price_text(candidate):
                    continue
                return " ".join(candidate.split()).strip()

        for text in card.stripped_strings:
            candidate = str(text).strip()
            if len(candidate) < 3:
                continue
            if _is_valid_product_name(candidate):
                if _looks_like_price_text(candidate):
                    continue
                return " ".join(candidate.split()).strip()

        return None

    containers = soup.select(
        ".product-item, .product-content, .product-card, .product, .item"
    )
    if not containers:
        containers = soup.select("[class*='product']")

    for card in containers:
        name = extract_name_from_card(card)
        if not name:
            continue

        discounted_el = card.select_one(
            ".price-new, .special-price, .discount-price, .price-sale"
        )
        original_el = card.select_one(
            ".price-old, .old-price, .price-regular, .price"
        )
        discount_pct_el = card.select_one(
            ".discount, .discount-percentage, .off, .sale-badge"
        )

        discounted_price = _parse_price(discounted_el.get_text(" ", strip=True)) if discounted_el else None
        original_price = _parse_price(original_el.get_text(" ", strip=True)) if original_el else None
        discount_percent = _parse_price(discount_pct_el.get_text(" ", strip=True)) if discount_pct_el else None

        if discount_percent is None:
            discount_percent = _extract_discount_percent_from_text(card.get_text(" ", strip=True))

        if original_price is None or (discounted_price is None and discount_percent is not None):
            text_original, text_discounted = _extract_prices_from_card_text(card)
            if original_price is None:
                original_price = text_original
            if discounted_price is None:
                discounted_price = text_discounted

        if original_price is not None and discounted_price is not None and discounted_price >= original_price:
            discounted_price = None

        if original_price is None and discounted_price is not None:
            original_price = discounted_price
            discounted_price = None

        save_amount = None
        if original_price is not None and discounted_price is not None:
            save_amount = round(original_price - discounted_price, 2)

        add_product({
            "product_name": name,
            "original_price": original_price,
            "discounted_price": discounted_price,
            "discount_percent": discount_percent,
            "save_amount": save_amount,
        })

    if products:
        return products

    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            if "@graph" in node and isinstance(node["@graph"], list):
                nodes.extend(node["@graph"])
                continue

            node_type = str(node.get("@type", "")).lower()
            if "product" not in node_type:
                continue

            name = str(node.get("name") or "").strip()
            offers = node.get("offers")
            if isinstance(offers, list):
                offer = offers[0] if offers else {}
            else:
                offer = offers if isinstance(offers, dict) else {}

            price = _parse_price(str(offer.get("price") or offer.get("lowPrice") or ""))
            high_price = _parse_price(str(offer.get("highPrice") or ""))

            original_price = high_price or price
            discounted_price = None
            if high_price is not None and price is not None and price < high_price:
                discounted_price = price

            add_product(
                {
                    "product_name": name,
                    "original_price": original_price,
                    "discounted_price": discounted_price,
                    "discount_percent": None,
                    "save_amount": (round(original_price - discounted_price, 2) if original_price and discounted_price else None),
                }
            )

    if products:
        return products

    network_script = soup.select_one("#__CAPTURED_NETWORK_JSON__")
    if network_script:
        raw = network_script.get_text(strip=True)
        if raw:
            try:
                payloads = json.loads(raw)
                network_products = _extract_from_payloads(payloads if isinstance(payloads, list) else [payloads])
                if network_products:
                    return network_products
            except json.JSONDecodeError:
                pass

    return products