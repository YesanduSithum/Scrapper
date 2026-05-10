# PricePulse Mobile (React Native)

Mobile frontend for PricePulse built with Expo + React Native.
It uses the same backend endpoints and database as the web app.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your backend URL:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

3. Start app:

```bash
npm run start
```

## Notes

- No backend/database code is changed.
- All mobile files are inside `pricepulse_mobile`.
- Main screens included:
  - Auth (Sign in / Register)
  - Home (queue + process grocery list)
  - Processed matches
  - Grocery list
  - Comparison + nearest store maps
  - Budget view

