# Price Pulse - Project Setup Instructions

## 🎯 Project Structure

Your project is now split into two sections:

```
pricepulse/
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── data/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── README.md
│
├── backend/                   # Python + FastAPI + PostgreSQL
│   ├── src/
│   │   └── (legacy Node backend)
│   ├── app/
│   │   ├── core/
│   │   ├── db/
│   │   ├── routers/
│   │   ├── utils/
│   │   └── main.py
│   ├── prisma/
│   │   └── schema.prisma
│   ├── requirements.txt
│   └── README.md
│
├── README.md
└── SETUP_INSTRUCTIONS.md
```

## 🚀 Backend Setup Instructions

### Step 1: Install PostgreSQL

If you don't have PostgreSQL installed:

**Windows:**
1. Download from: https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember your password for the postgres user
4. Default port is 5432

### Step 2: Create Database

Open PostgreSQL command line (SQL Shell/psql) and run:

```sql
CREATE DATABASE pricepulse;
```

### Step 3: Backend Installation

```bash
# Navigate to backend folder
cd pricepulse/backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file in the backend folder:

```bash
cp .env.example .env
```

If you are on Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with your database credentials:

```env
PORT=5000
ENVIRONMENT=development

# Update with your PostgreSQL credentials
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/pricepulse

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:5173
```

### Step 5: Set Up Database

```bash
# Use existing SQL migration under backend/prisma/migrations
# and run it in PostgreSQL (or use your current seeded DB).
```

### Step 6: Start Backend Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

Backend will run at: http://localhost:5000

If you see a missing `DATABASE_URL` error, copy `.env.example` to `.env` and update the PostgreSQL connection string first.

Test it: http://localhost:5000/api/health

## 🎨 Frontend Setup (Update)

Your frontend is now in the `frontend/` folder and needs to connect to the backend API.

### Step 1: Navigate to Frontend Directory

```bash
cd pricepulse/frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Connect the frontend to the backend API

The frontend already uses `src/services/api.ts`, so just make sure the backend is running at `http://localhost:5000` before starting Vite.

## 🧪 Testing Both Parts

1. **Start Backend:**
   ```bash
  cd pricepulse/backend
  .\start_backend.ps1
   ```
   Running at: http://localhost:5000

   Make sure `pricepulse/backend/.env` exists before running the script.

2. **Start Frontend (in new terminal):**
   ```bash
  cd pricepulse/frontend
   npm run dev
   ```
   Running at: http://localhost:5173

3. **Test API:**
   - http://localhost:5000/api/health
   - http://localhost:5000/api/products
   - http://localhost:5000/api/categories

## 🛠️ Useful Commands

### Backend
```bash
cd pricepulse/backend

uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload   # Dev server
uvicorn app.main:app --host 0.0.0.0 --port 5000            # Production-like run
```

### Frontend
```bash
cd pricepulse/frontend

npm install             # Install dependencies
npm run dev             # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
```

## 📝 Next Steps

1. ✅ Backend structure created
2. ✅ Database schema defined
3. ✅ API routes ready
4. 🔄 Install PostgreSQL
5. 🔄 Create & configure database
6. 🔄 Install backend dependencies
7. 🔄 Run migrations & seed
8. 🔄 Update frontend to use API

## 🐛 Troubleshooting

**Database connection error?**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

**Port already in use?**
- Change PORT in backend/.env
- Kill process using port: `netstat -ano | findstr :5000`

**Prisma errors?**
- Run `npm run prisma:generate`
- Delete `node_modules` and `package-lock.json`, reinstall

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Express Docs](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
