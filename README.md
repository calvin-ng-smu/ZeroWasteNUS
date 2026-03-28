# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Live API (MongoDB)

This project now includes a small Express API backed by MongoDB to drive live dashboard updates.

1. Start MongoDB locally (or set `MONGODB_URI` to your hosted instance).
2. Install dependencies: `npm install`
3. Run the API: `npm run server`
4. Run the frontend: `npm run dev`

The UI polls `http://localhost:3001/api/dashboard` every 5 seconds. Override with `VITE_API_BASE_URL` if needed.

### Postman demo

#### 1. Record a transaction (purchase-level)

`POST http://localhost:3001/api/transactions`

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

`POST http://localhost:3001/api/cup-events`

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
