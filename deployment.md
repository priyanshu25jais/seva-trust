# Deployment

## 1. Run locally

Requirements: Node.js 20 or newer, a free MongoDB Atlas cluster (https://www.mongodb.com/atlas).

1. Clone the repository and open a terminal in it:
   ```
   git clone <GitHub URL of this project>
   cd seva-trust
   ```
2. Install everything:
   ```
   npm run install:all
   ```
3. Create the environment file. Copy `.env.example` to `server/.env`
   (macOS/Linux: `cp .env.example server/.env`, Windows PowerShell: `copy .env.example server\.env`) and set
   at least `MONGODB_URI`, `JWT_SECRET` and `MOCK_WEBHOOK_SECRET`. In Atlas, create a database user and allow
   your IP address under Network Access.
4. Seed the demo data. **This deletes everything in the database named in `MONGODB_URI`, so use a
   demo database.**
   ```
   npm run seed
   ```
   It creates 12 schemes (10 published, 1 draft, 1 in review), 2 campaigns, 52 users, 43 sample paid
   donations with real receipts and 2 call-back requests.
5. Start the API and the web app in two terminals:
   ```
   npm run server      # http://localhost:4000
   npm run client      # http://localhost:5173  (open this one)
   ```
6. Run the tests (no database setup needed, they use an in-memory MongoDB):
   ```
   npm test
   ```

## 2. How it is deployed

One web service serves the API **and** the built React app, with MongoDB Atlas as the database.

- **Database:** MongoDB Atlas free cluster (M0). Network Access allows `0.0.0.0/0` so the host can connect.
  Use the connection string with the database name, for example `.../seva-trust?retryWrites=true&w=majority`.
- **Web service:** Render (free plan). The repository contains `render.yaml`, or create a Web Service by hand:
  - Build command: `npm install --include=dev --prefix client && npm run build --prefix client && npm install --prefix server`
  - Start command: `npm start --prefix server`
  - Health check path: `/api/health`
  - Set the environment variables below in the Render dashboard (never in Git).
- **First-time data:** from your own computer, point `MONGODB_URI` at the Atlas database and run `npm run seed`
  once (it clears that database first).
- **Notes:** the free plan sleeps after inactivity, so the first visit can take about 30 seconds. In
  production the server refuses to start if `JWT_SECRET` is short or `MOCK_WEBHOOK_SECRET` is not set.

Live app: `<paste the Render URL here>`

## 3. Environment variables (names only)

| Name | Purpose |
|------|---------|
| `NODE_ENV` | `production` on the host |
| `PORT` | Set by the host |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Signs login tokens (24+ random characters) |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `MOCK_WEBHOOK_SECRET` | Shared secret for the mock payment webhook |
| `CLIENT_ORIGIN` | The public URL of the app |
| `TRUST_NAME`, `TRUST_NAME_HI`, `TRUST_PAN`, `TRUST_80G_NUMBER` | Placeholders printed on certificates |
| `LLM_PROVIDER` | `gemini`, `groq` or `fallback` |
| `LLM_API_KEY` | Key for the AI provider (optional) |
| `LLM_MODEL` | Optional model override |
| `RATE_LIMIT_DONATE_MAX`, `RATE_LIMIT_AUTH_MAX` | Per-IP limits per 15 minutes |
| `SERVE_CLIENT` | Serve the built React app from the API (default true in production) |
| `NODE_VERSION` | Render only: `20` |

## 4. Demo logins for the reviewer

These accounts are fake and exist only in the demo database.

| Role | Email | Password |
|------|-------|----------|
| Trust admin | `admin@seva.test` | `DemoPass123` |
| Donor | `donor@seva.test` | `DemoPass123` |

Visitors do not need to log in: schemes, the finder and donating work without an account.

**Test cards** for the mock payment (any future expiry, any 3 digit CVV):

| Card | Result |
|------|--------|
| `4111 1111 1111 1111` | Successful payment, receipt and 80G certificate |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 0003` | Foreign card: blocked with an FCRA notice |

**A quick tour:** open the home page, tap "पात्रता जाँचें" and answer the 6 questions; donate from "दान करें" with
the first test card and download the certificate; log in as admin, open the scheme in review (SCH-072), paste
a notice into the AI summary box, create a draft, approve it, then publish the scheme.

**AI summary:** with no `LLM_API_KEY` the admin page shows a clearly labelled template draft. With a
Gemini or Groq key and `LLM_PROVIDER` set, the draft comes from the model and is checked (every number must
be in the notice) before it can be approved.
