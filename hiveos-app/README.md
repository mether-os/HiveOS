# HiveOS Web Application

The Next.js frontend for HiveOS — an AI-powered collaborative workspace platform.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **State**: Zustand, TanStack React Query
- **Auth**: Better Auth (GitHub OAuth)
- **Realtime**: Socket.io Client
- **Canvas**: React Flow
- **Animations**: Framer Motion

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t hiveos-app .
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. See the root README for details.
