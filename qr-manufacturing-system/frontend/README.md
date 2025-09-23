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
REACT_APP_API_URL=http://localhost:5002/api
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