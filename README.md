# finances
Local-only web app to upload a bank CSV and visualize spending by category and month.
Imports are saved in the browser database (IndexedDB) so you can revisit trends later.

## Setup
1. Install dependencies: `npm install`
2. Run dev server: `npm run dev`

## Docker
Run everything (frontend, API, Postgres):
1. `docker compose up -d`
2. App: http://localhost:4173
3. API: http://localhost:8080/health

## CSV format
No header row, 6 columns in order:
1. Date (MM/DD/YYYY)
2. Type
3. Description
4. Location
5. Amount (e.g., "($21.54)")
6. Balance (ignored)
