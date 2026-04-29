# Price Pulse Frontend

React + TypeScript + Vite frontend for the Price Pulse grocery price comparison application.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

   The app will run at: http://localhost:5173

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   ├── context/          # React context providers
│   ├── data/             # Mock data
│   ├── App.tsx           # Main app component
│   ├── Home.tsx          # Home page
│   ├── main.tsx          # Entry point
│   ├── types.ts          # TypeScript types
│   └── index.css         # Global styles
├── public/               # Static assets
│   └── Applogo/
├── index.html            # HTML template
├── package.json
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS config
├── postcss.config.js     # PostCSS config
└── tsconfig.json         # TypeScript config
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔌 Connecting to Backend

The frontend connects to the backend API at `http://localhost:5000`

To use the backend API, create `src/services/api.ts`:

```typescript
import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const productAPI = {
  getAll: () => api.get('/products'),
  getById: (id: string) => api.get(`/products/${id}`),
  search: (query: string) => api.get(`/products/search?q=${query}`),
}

export const categoryAPI = {
  getAll: () => api.get('/categories'),
}

export const retailerAPI = {
  getAll: () => api.get('/retailers'),
}
```

## 🎨 Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Context API** - State management

## 📦 Key Dependencies

- `react` & `react-dom` - Core React
- `recharts` - Charts and graphs
- `lucide-react` - Icons
- `tailwindcss` - Utility-first CSS

## 🚧 Development

### Adding New Components

1. Create component file in `src/components/`
2. Use TypeScript for type safety
3. Follow existing naming conventions
4. Import and use in your pages

### Styling

- Uses Tailwind CSS utility classes
- Global styles in `src/index.css`
- Tailwind config in `tailwind.config.js`

## 🔄 Updating from Mock Data to API

Replace mock data imports with API calls:

```typescript
// Before
import { MOCK_PRODUCTS } from './data/mockProducts'
const [products, setProducts] = useState(MOCK_PRODUCTS)

// After
import { productAPI } from './services/api'
const [products, setProducts] = useState([])

useEffect(() => {
  productAPI.getAll().then(response => {
    setProducts(response.data.data)
  })
}, [])
```

## 🌐 Build for Production

```bash
npm run build
```

The build output will be in the `dist/` folder.

To preview the production build:

```bash
npm run preview
```

## 📝 Notes

- Backend must be running on port 5000 for API calls to work
- CORS is configured on the backend to accept requests from localhost:5173
- Authentication tokens are stored in localStorage

## 🗺️ Maps Setup

To use the embedded Google Map in "Find Nearest Store", add this to `frontend/.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_embed_api_key
```

If the key is not set, the app shows a Google Maps link instead of an embedded map.
