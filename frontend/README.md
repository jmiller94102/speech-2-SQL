# Sales Dashboard Frontend

A Next.js + Tailwind CSS dashboard UI inspired by the provided Figma: https://www.figma.com/design/xLiT1mPRl5nWPCpYGUGk23/Sales-Dashboard--Community-?node-id=1-697

## Tech Stack
- Next.js (App Router)
- React 18
- Tailwind CSS
- Chart.js via react-chartjs-2
- lucide-react icons

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Run the development server

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Project Structure
- `app/` – Next.js App Router pages, root layout, and global styles
- `components/` – Reusable UI components (sidebar, topbar, cards, charts, tables)
- `lib/` – Mock data used for charts and tables

## Notes
- Colors and spacing are tuned to approximate the Figma design in a dark theme.
- Replace mock data in `lib/mock.ts` with real API data as needed.
- To customize theme colors, see `tailwind.config.js` and `app/globals.css`.
