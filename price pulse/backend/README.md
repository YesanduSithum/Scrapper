# Price Pulse Backend (FastAPI)

Backend API for Price Pulse built with **Python**, **FastAPI**, **SQLAlchemy**, and **PostgreSQL**.

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL 14+

### Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file:**
   ```env
   PORT=5000
   ENVIRONMENT=development
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/pricepulse
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:5173
   ```

5. **Start the API server:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
   ```

   Or run the one-command PowerShell starter:
   ```powershell
   .\start_backend.ps1
   ```

Backend runs at `http://localhost:5000`.

---

## 📁 Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── db/
│   │   ├── models.py
│   │   └── session.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── categories.py
│   │   ├── products.py
│   │   └── retailers.py
│   ├── utils/
│   │   ├── responses.py
│   │   └── serializers.py
│   └── main.py
├── prisma/
│   └── migrations/
├── requirements.txt
└── README.md
```

## 🔌 API Endpoints

### Health Check
- `GET /api/health`

### Products
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/search?q=query`
- `GET /api/products/category/:categoryId`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Categories
- `GET /api/categories`
- `GET /api/categories/:id`

### Retailers
- `GET /api/retailers`
- `GET /api/retailers/:id`

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`

## 📝 Notes

- API response shape is preserved as `{ success, data }` and `{ success, message }`.
- Existing frontend base URL (`http://localhost:5000/api`) remains unchanged.
- Existing Prisma migrations and table structure are reused by SQLAlchemy models.
