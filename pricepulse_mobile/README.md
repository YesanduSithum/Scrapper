# PricePulse Mobile (React Native)

Mobile frontend for PricePulse built with Expo + React Native.
It uses the same backend endpoints and database as the web app.

## Setup

### Network Configuration

The backend host is configured in [`src/constants/config.ts`](src/constants/config.ts). If you need to connect to a backend on a different IP or network, edit that file and change the `BACKEND_HOST` constant.

**Note:** Both the frontend and mobile apps have their own `config.ts` files—keep the `BACKEND_HOST` values in sync if you want them on the same network.

### Installation & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start app:**
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

