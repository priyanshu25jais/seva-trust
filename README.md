# Seva Trust

Illustrative donation platform for a charitable trust in Bhopal, Madhya Pradesh. The product is Hindi-first. Scheme pages and eligibility results are informational only.

## What it does

- Women’s schemes on the home page, each with a source link and last-checked date
- Eligibility finder that reports a **possible match** and the rules used — never a promise
- Donations in at most three steps, with a mocked payment and an instant 80G-style receipt
- Roles: visitor (no login), donor, admin — enforced on the server

## Stack

React + Vite, Node + Express, MongoDB + Mongoose, JWT, zod, Jest + supertest.

## Setup

1. Copy `.env.example` to `.env` in this folder and in `server/` if you prefer a local copy. Fill `MONGODB_URI` and `JWT_SECRET`. Keep `TRUST_PAN` and `TRUST_80G_NUMBER` as placeholders.
2. Server:

   ```bash
   cd server
   npm install
   npm test
   npm run seed
   npm run dev
   ```

3. Client (Vite React, Hindi default via react-i18next):

   ```bash
   cd client
   npm install
   npm run dev
   ```

   Open http://localhost:5173 — you should see a Hindi heading and a language toggle.
   `/api` requests are proxied to the server at http://localhost:4000.

4. PDF Hindi smoke check (needs Noto Sans Devanagari under `server/assets/fonts/`):

   ```bash
   cd server
   npm run pdf-smoke
   ```

   Writes `scripts/out/smoke.pdf`.

Seed admin: `admin@seva.example` / `ChangeMeAdmin1`  
Seed donor: `donor@seva.example` / `ChangeMeDonor1`

## Safety

Payments are mocked. Trust PAN and 80G numbers come from environment variables. AI-generated copy stays a draft until an admin approves it. Donor PAN is masked in the UI (`ABCDE****F`).
