# Seva Trust — Hindi-first NGO support platform

An internship project prototype for a charitable trust. It combines a women's welfare scheme directory, rule-based eligibility pre-screening, donor accounts and a donation/receipt workflow (donation workflow is the next implementation phase).

## Stack
- Client: React 18, Vite, React Router, react-i18next
- API: Node.js, Express, Mongoose, Zod, JWT
- Database: MongoDB
- Tests: Jest, Supertest, mongodb-memory-server
- PDFs: PDFKit with Noto Sans Devanagari

## Run locally

1. Install a recent Node.js LTS and MongoDB (local or hosted free tier).
2. Copy `.env.example` to `.env` in the project root. Set a long random `JWT_SECRET` and your MongoDB URI. Keep trust identifiers as placeholders for the demo.
3. Start the API:
   ```bash
   cd server && npm install && npm run dev
   ```
4. In another terminal start the UI:
   ```bash
   cd client && npm install && npm run dev
   ```
5. Open http://localhost:5173. Vite proxies `/api` to `http://localhost:4000`.

## Implemented in this revision
- Public scheme list API: `GET /api/schemes?lang=hi&district=Bhopal&need=Pension`
- Public scheme detail API: `GET /api/schemes/:code?lang=hi`
- Deterministic pre-screen API: `POST /api/schemes/eligibility/check`
- Hindi-first responsive homepage, language toggle, scheme category filters and eligibility form.
- Eligibility output is explicitly a possible match, not an official government decision.

Example request:
```json
{
  "age": 42,
  "district": "Bhopal",
  "lang": "hi",
  "answers": {
    "gender": "female",
    "maritalStatus": "widow",
    "documents": ["bpl_card"]
  }
}
```

## Demo-data warning
The bundled scheme records are illustrative seed data. Several records use placeholder `example.gov.in` source URLs and must not be represented as verified government schemes. Replace them with verified official scheme details and source URLs before any public launch. The eligibility checker is a preliminary rule-based filter only.

## Existing demo seed accounts
The seed script creates `admin@seva.test` and `donor@seva.test`, both with password `DemoPass123`. The seed script currently clears collections; use only with a disposable development database. Do not run it against production data.

## Remaining implementation phases
1. Donation creation and mock-payment confirmation with idempotency.
2. Transaction-safe receipt numbering, PDF receipt generation and retry handling.
3. Donor dashboard and donation history.
4. Admin scheme/campaign editor, approval workflow and audit trail.
5. Donation reports, export, security hardening and concurrency/load tests.

## Security notes
- Never use default JWT secrets in production.
- Do not store PAN as plaintext; implement authenticated encryption or avoid retaining it where not needed.
- Do not expose private donor records or receipt PDFs through public URLs.
- Mock payment status is not a real payment confirmation.
- Obtain legal/accounting review before issuing actual 80G certificates or claiming tax deductibility.
