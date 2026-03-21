# FoodList AI Scraper

Quick start (Windows PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` from `.env.example` and set `GITHUB_TOKEN`.

Place a matching `chromedriver.exe` (same major version as your Chrome) in the project folder or update `chrome_driver_path` in `scrape.py`.

Run the app:

```powershell
streamlit run Interface.py
```

Troubleshooting:
- If PowerShell blocks activation: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- If Selenium fails: confirm `chromedriver.exe` version matches Chrome and path is correct.
- If AI fails: ensure `GITHUB_TOKEN` is set and network access is available.

## AI Provider configuration

The scraper can either talk to your local Ollama model or any online API that speaks an OpenAI-style chat protocol. Configure it via `.env` variables:

- `AI_PROVIDER`: `ollama` (default) to hit your local Ollama instance, or `api` to send requests to a remote endpoint.
- `AI_API_URL`: required when `AI_PROVIDER=api`; should accept `model`, `messages`, and return a JSON payload whose content exists in `choices[0].message.content`, `choices[0].text`, or `content`.
- `AI_API_MODEL`: (optional) override the remote model name, defaulting to `gpt-4o-mini`.
- `AI_API_KEY`: (optional) bearer token for services that require authentication.
- `AI_RESPONSE_TIMEOUT`: (optional) HTTP timeout in seconds (default `60`).

Set `AI_PROVIDER=api` only after you have the remote endpoint and key ready; until then `ollama` keeps working locally.

## Database save flow (PostgreSQL)

This project now supports saving filtered scraped data directly into your DB schema (`categories`, `retailers`, `products`, `prices`).

### 1) Configure DB connection

In `.env`, set:

```env
DATABASE_URL=postgresql://username:password@host:5432/database_name
```

### 2) Install dependencies

```powershell
pip install -r requirements.txt
```

### 3) Use from UI

1. Run app: `streamlit run Interface.py`
2. Add multiple product listing URLs (one per line)
3. Click **Scrape Site**
4. Review **Filtered Product Data**
5. Click **Save Filtered Data to Database**

### How the insert/update works

- **Retailer**: inferred from each URL domain (e.g., `keells.com` -> `keells`)
- **Category**: uses scraped `category`, otherwise inferred from URL path
- **Product**: normalized and inserted/upserted with required fields in your schema
- **Price**: stores current effective price (discounted price if available, else original price)
- Existing `(productId, retailerId)` price rows are updated automatically via upsert






foodlist/Scripts/activate