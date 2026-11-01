# Call2Kitchen Frontend

Frontend foundation for Call2Kitchen: the AI Voice Console (`/`) and the Restaurant Operations Dashboard (`/dashboard`).

## Stack

* Next.js 16 with App Router
* TypeScript (strict)
* Tailwind CSS v4
* Framer Motion
* Lucide React

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server (default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |

## Port note

The Express backend runs on port `3000` by default. Next.js also defaults to port `3000`, so if you run both locally at the same time, start the frontend on a different port:

```bash
npm run dev -- --port 3001
```

The frontend calls the backend through `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`). No backend code was modified, and no voice calls, orders, or authentication are connected in this phase.

## Routes

* `/` — AI Voice Console (immersive placeholder)
* `/dashboard` — Restaurant Operations Dashboard (placeholder)
