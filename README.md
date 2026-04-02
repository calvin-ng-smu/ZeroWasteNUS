# ZeroWasteNUS Dashboard (React + Vite + Express)

This repository contains:
- A React (Vite) dashboard UI
- A small Express API (`/api/dashboard`, `/api/simulate`, etc.) that provides live data
- An optional Python simulator that generates transactions/returns

## Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm
- (Optional) Python 3.9+ for the simulator
- (Optional) MongoDB (local or Atlas). If MongoDB is not reachable, the API falls back to an in-memory store automatically.

## Quick Start (works without MongoDB)

1) Install dependencies (required):

`npm install`

2) Terminal A — start the API:

`npm run server`

3) Terminal B — start the frontend:

`npm run dev`

4) Open the UI (Vite will print the URL; typically `http://localhost:5173`).

Notes (Windows):
- The API binds to `127.0.0.1:3001`.
- This project defaults to `http://127.0.0.1:3001` (IPv4 loopback) to avoid Windows `localhost` IPv6 issues.

## Live API (MongoDB)

This project now includes a small Express API backed by MongoDB to drive live dashboard updates.

If MongoDB is not reachable (e.g. Atlas TLS / local Mongo not running), the API will automatically fall back to an in-memory store for the current process, so the dashboard + simulator can still run.

### Option A: Local MongoDB
1. Start MongoDB locally.
2. `npm install`
3. `npm run server`
4. `npm run dev`

### Option B: MongoDB Atlas (recommended for multi-device)
1. Create a free Atlas cluster and user.
2. Copy `.env.example` to `.env`.
3. Paste your Atlas connection string into `MONGODB_URI` in `.env`.
4. Run: `npm install` then `npm run server` and `npm run dev`.

The UI polls `http://127.0.0.1:3001/api/dashboard` every 5 seconds.
Override with `VITE_API_BASE_URL` if needed (example: `VITE_API_BASE_URL=http://127.0.0.1:3001`).

## Simulation (Python)

If you want the dashboard to update continuously without manually posting events, run the simulator.

1. Start the API and frontend:
  - `npm run server`
  - `npm run dev`

2. In a separate terminal, run (base URL defaults to the API):
  - Change into the scripts folder:
    - `cd scripts`
  - Run the simulator:
    - macOS / Linux: `python3 simulate_cups.py --base-url http://localhost:3001`
    - Windows: `python simulate_cups.py --base-url http://localhost:3001`
    - If `localhost` fails on Windows, use IPv4 explicitly: `--base-url http://127.0.0.1:3001`
  - If you started the API on a different port, pass it explicitly (example):
    - `python simulate_cups.py --base-url http://127.0.0.1:3002`

This will:
- POST to `POST /api/simulate`
- Randomly generate cup choices (Campus Rental / BYO / Single-Use)
- Generate return events that decrement the **Active Rentals** KPI

Tweak the behavior (examples):
- Faster updates: `python simulate_cups.py --tick-seconds 0.5`
- More events per tick: `python simulate_cups.py --events-per-tick 25`
- More rentals: `python simulate_cups.py --p-rental 0.6 --p-byo 0.2 --p-disposable 0.2`
- More returns: `python simulate_cups.py --return-prob 0.002`

### Postman demo

#### 1. Record a transaction (purchase-level)

`POST http://127.0.0.1:3001/api/transactions`

Body (JSON):
```
{
  "timestamp": "2025-03-01T10:15:00Z",
  "outlet_id": "Frontier",
  "stall_id": "Drink Stall 1",
  "campus_zone": "UTown",
  "channel": "walk-up",
  "cup_mode": "rental", // one of: disposable, BYO, rental
  "drink_category": "cold",
  "price": 3.5,
  "disposable_fee_applied": false,
  "incentive_applied": true,
  "user_hash": "abc123hash"
}
```

This writes into the `transactions` collection and recomputes the dashboard charts.

#### 2. Record a cup lifecycle event

`POST http://127.0.0.1:3001/api/cup-events`

Body (JSON):
```
{
  "timestamp": "2025-03-01T11:05:00Z",
  "cup_id": "CUP-0001",
  "event_type": "returned", // issued, returned, collected, washed, redistributed, retired, exception
  "location_id": "Frontier Drop-off 1",
  "rental_id": "RENTAL-123",
  "condition_flag": "ok",
  "operator_id": "staff-42"
}
```

This writes into the `cup_events` collection (ready for deeper operational drill-down).

### Batch simulation endpoint

`POST http://127.0.0.1:3001/api/simulate`

Body (JSON) options:

1) Random transactions + returns:
```
{ "random_events": 10, "returns": 3 }
```

2) Explicit counts:
```
{ "byo": 4, "rental": 3, "disposable": 3, "returns": 2 }
```

## Troubleshooting

- `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'dotenv' ...`
  - You have not installed dependencies yet.
  - Fix: run `npm install` from the repo root, then retry `npm run server`.

- `EADDRINUSE` / port already in use
  - Something is already using port 3001.
  - Fix: stop the other process, or start the API on another port:
    - PowerShell: `$env:PORT=3002; npm run server`
    - Then set `VITE_API_BASE_URL=http://127.0.0.1:3002` before `npm run dev`.

- Mongo connection warnings / TLS issues
  - This is expected if MongoDB isn"t configured.
  - The API will fall back to an in-memory store so the demo still runs.
