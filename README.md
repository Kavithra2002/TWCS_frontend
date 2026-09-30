# TWCS frontend

Dashboard for the Tea Withering Control System. Next.js 15 (App Router) + TypeScript + Tailwind + Recharts.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app runs at http://localhost:3000 and expects the backend at http://localhost:4000 (`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL`).
