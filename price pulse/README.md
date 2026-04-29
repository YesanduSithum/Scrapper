# PricePulse

A mobile-first grocery price comparison application for Sri Lanka. Compare prices across **Cargills**, **Keells**, and **Sathosa** in real time.

## 🎯 Project Structure

This project is organized as a monorepo with separate frontend and backend:

```
price pulse/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Python + FastAPI + PostgreSQL
├── README.md          # This file
└── SETUP_INSTRUCTIONS.md
```

## ✨ Features

- **Multilingual search** – English, Sinhala (සිංහල), and Singlish, with optional voice search (microphone)
- **Comparison Radar** – Product cards with a 3-column price grid; lowest price in green, highest in red; "Last updated" timestamps
- **Basket Summary** – Bottom-docked basket that shows totals per store and highlights the cheapest store for your full list
- **Inflation & Budgeting** – Category bar chart, retailer pie chart, and a budget progress bar that turns red when near/over your monthly limit
- **Find Nearest Store** – Opens a map (Google Maps) to the closest branch of the cheapest retailer

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS (emerald primary, soft greys, high-contrast white)
- Recharts (bar & pie charts)
- Lucide React (icons)
- Noto Sans + Noto Sans Sinhala (Google Fonts) for Sinhala script support

### Backend
- Python + FastAPI
- SQLAlchemy ORM + PostgreSQL
- JWT Authentication
- passlib (bcrypt) for password hashing

## 🚀 Quick Start

### Prerequisites
- Python (3.10 or higher)
- Node.js (v18 or higher) for frontend
- PostgreSQL (v14 or higher)
- npm

### Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Configure .env file with your database credentials
cp .env.example .env

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

Backend runs at: **http://localhost:5000**

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

Open in a mobile viewport or DevTools device mode for the best experience.

## 📚 Documentation

For detailed setup instructions, see [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)

- [Frontend README](frontend/README.md)
- [Backend README](backend/README.md)

## 🏗️ Build for Production

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

### Backend
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

## 🗄️ Database

The backend uses PostgreSQL. The database schema includes:
- Products with multilingual names
- Categories (Dairy, Vegetables, Fruits, etc.)
- Retailers (Cargills, Keells, Sathosa)
- Prices per product per retailer
- User authentication

## 🔌 API Endpoints

- `GET /api/products` - Get all products with prices
- `GET /api/products/search?q=query` - Search products
- `GET /api/categories` - Get all categories
- `GET /api/retailers` - Get all retailers
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

## 🗺️ Maps Integration

"Find Nearest Store" uses the Google Maps Embed API when `VITE_GOOGLE_MAPS_API_KEY` is set.

Create `frontend/.env` like this:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_embed_api_key
```

If the key is missing, the app falls back to a Google Maps link.
