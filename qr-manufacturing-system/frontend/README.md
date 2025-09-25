# QR Manufacturing System Frontend

This is the frontend for the QR Manufacturing System, built with React and TypeScript.

## Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

## Environment Variables

Create a `.env.local` file with the following variables:
```
REACT_APP_API_URL=https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/api
```

For production, set these in your Vercel project settings.

## Build

```bash
npm run build
```

## Deployment

This project is configured for deployment on Vercel.

### Vercel Deployment Settings

- Build Command: `npm run build`
- Output Directory: `build` 
- Framework Preset: Create React App
- Root Directory: Set to the directory containing this README (qr-manufacturing-system/frontend)

### Environment Variables for Production

In your Vercel project, set:
- `REACT_APP_API_URL`: URL to your backend API, e.g., `https://your-backend.onrender.com/api`

## Features

- QR Code Generation
- Item Scanning
- Inventory Management
- Engraving Simulation

## Analytics (Real Data)

- The Analytics page now sources real data from the backend endpoints:
	- `GET /inventory/stats`
	- `GET /items/manufactured?limit=...`
	- `GET /stats`
- Code lives under `src/features/analytics/` with an industry-standard feature structure:
	- `AnalyticsPage.tsx` – page UI
	- `api.ts` – fetchers
	- `types.ts` – TypeScript types
	- `utils.ts` – data transforms for charts
- Existing route `src/pages/Analytics.tsx` re-exports the new feature page to preserve routing.

### Config

- Backend API base is read from `REACT_APP_API_BASE` or `REACT_APP_API_URL`.
	- If `REACT_APP_API_URL` ends with `/api`, it will be normalized automatically.