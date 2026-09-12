# FPL

A responsive, multi-manager Fantasy Premier League decision dashboard. The interface uses live public FPL data for squads, ranks, prices, fixtures, live points and player history. Deterministic models calculate expected minutes, expected points, captain rankings, multi-gameweek projections and squad-aware transfer recommendations. Groq explains those structured results; it does not produce the predictions.

## Local setup

1. Copy `.env.example` to `.env.local` and add the server-side Groq and Supabase credentials.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000` and enter a public FPL Manager ID.

The selected manager and transfer draft are stored only in the browser. Public FPL data and prediction runs are cached in Supabase.

## Services

- `app/api/fpl/*`: public FPL API proxy and aggregated dashboard feed.
- `lib/predictions.ts`: deterministic V1 feature and projection engine.
- `app/api/explain`: Groq explanation endpoint restricted to structured app results.
- `supabase/schema.sql`: persistent cache and analytics schema.
- `backend/`: optional FastAPI analytics service contract for separating Python model workloads later.

No authenticated FPL writes are performed.
