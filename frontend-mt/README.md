# Next.js Multithreaded Messages (Workers)

A minimal Next.js (App Router) app demonstrating messaging with multiple Web Workers.

## What it does
- **Worker 1 (echo)**: echoes your message with a random latency to simulate async work.
- **Worker 2 (heavy)**: simulates CPU-heavy work and returns a hash-like result and timing.
- **UI**: Send messages to each worker and observe logs in real time.

## Run locally (port 3001)

```bash
# from project root
cd frontend-mt
npm install
npm run dev
```

Then open http://localhost:3001

## Structure
- `app/page.tsx` – simple UI with inputs and log.
- `public/workers/echo.js` – echo worker.
- `public/workers/compute.js` – heavy compute worker.
- `app/globals.css` – basic dark styling.

## Notes
- Workers are created via `new Worker("/workers/echo.js")` and `new Worker("/workers/compute.js")` from the `public/` directory.
- This example uses only standard Web APIs; no extra libraries required.
