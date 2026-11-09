# Seva Trust: women's schemes finder and donations

A Hindi-first web app for a charitable trust (client brief: *NGO donation platform with a women's
schemes finder on the home page*). Women find the government schemes they may use, in plain Hindi.
Donors give in three steps and get their receipt and 80G certificate at once. The accounts team
never types a receipt.

> The trust name, PAN and 80G number are **placeholders** (the brief gives none), payments are
> **mocked** (test mode), and seven of the ten schemes are **illustrative**. See "Assumptions" in the
> Technical Design Document.

## What it does

| Area | What is built |
|------|---------------|
| Home page | Schemes first. Browse by need (pension, livelihood, health) and by district. Each scheme shows benefit, who can apply, documents, how to apply, nearest help centre, official source link and last-checked date |
| Eligibility finder | 6 one-per-screen questions. Rule engine returns **possible** matches and the rules used (passed, or "checked when you apply"). Never a promise. Offers a helpline call-back (stored only with consent). Optional: type or speak a Hindi sentence, AI fills the answers, **the woman confirms** before anything is matched |
| Donation | One-time or monthly (test mode), campaign pages, PAN capture and validation, mock card payment, foreign cards blocked with an FCRA notice, instant receipt and 80G certificate (PDF) |
| Receipts | Atomic, gap-free numbers per financial year (`80G/2026-27/000123`), safe against gateway retries and double clicks |
| Donor account | History and certificate downloads |
| Admin | Scheme CMS in Hindi and English (draft, review, publish, audit trail, preview), AI Hindi summary drafts with guardrails and mandatory approval, campaign report, Form 10BD CSV export, helpline call-back requests, mock monthly-gift run |

Screenshots are in `docs/screenshots`. The Technical Design Document explains the design decisions.

## Run it locally

You need Node.js 20+ and a free MongoDB Atlas cluster (transactions need a replica set).

```bash
git clone https://github.com/priyanshu25jais/seva-trust && cd seva-trust
npm run install:all                      # installs server and client
cp .env.example server/.env              # then edit server/.env (MONGODB_URI, JWT_SECRET, MOCK_WEBHOOK_SECRET)
npm run seed                             # fills the DEMO database (it clears it first!)
npm run server                           # API on http://localhost:4000
npm run client                           # app on http://localhost:5173 (new terminal)
```

Windows PowerShell: use `copy .env.example server\.env` instead of `cp`.
Demo logins and test cards are in `deployment.md`.

## Tests

```bash
npm test                  # server (118 tests) and client (27 tests)
npm run test:server
npm run test:client
```

Server tests start MongoDB in memory as a single-node replica set, so no database setup is needed.
What they prove: 100 parallel receipt confirmations give 100 unique, consecutive numbers; repeated
gateway webhooks create one receipt; a failure after the counter moves leaves no gap; the financial
year turns over at midnight India time; the 80G PDF contains the required fields; admin routes need
the admin role; the AI summary guardrails block a wrong number; and more.

### Load test and receipt check

```bash
# terminal 1: server with high rate limits (local only)
RATE_LIMIT_DONATE_MAX=10000000 MOCK_WEBHOOK_SECRET=load-secret-123 npm run server
# terminal 2
node scripts/loadtest.js --url http://localhost:4000 --total 5000 --concurrency 50 --secret load-secret-123
npm run verify:receipts
```

Results from my run are in `docs/load-test/`: 5,000 donations at concurrency 50 and 1,000 at
concurrency 5, then `verify:receipts` over the whole database: 6,000 receipts numbered 1 to 6,000,
0 duplicates, 0 missing numbers, 0 paid donations without a receipt. `scripts/loadtest.k6.js` is the
same test for k6 (written but not run in my environment).

### Browser and accessibility checks

`scripts/e2e-browser.py` drives the real app in headless Firefox on a 390px phone (finder, three-step
donation, foreign-card block, login, admin, AI draft, language switch) and saves screenshots.
`scripts/a11y-audit.py` runs axe-core (WCAG 2.1 A and AA rules) over 12 page states:
0 violations (`docs/audit/axe-results.json`). This is an automated audit, not a manual screen-reader test.

## Architecture in one minute

```
React (Vite, i18next, react-router)  ->  Express API  ->  MongoDB (Mongoose, transactions)
                                          |
                                          +-- route -> controller -> service -> model
                                          +-- pdfkit renders the 80G PDF from an immutable receipt snapshot
                                          +-- AI provider (Gemini or Groq) behind one small interface, with guardrails
```

```
client/src      pages, components, lib (api, auth, format), i18n (hi, en), test
server/src      app.js, config, middleware, routes, controllers, services, models, validation, utils, scripts/seed.js
server/tests    receipts, donations, admin, schemes, ai, finder, unit
scripts         loadtest.js, loadtest.k6.js, verify-receipts.js, e2e-browser.py, a11y-audit.py
docs            screenshots, load-test, audit
```

Key decisions (details in the TDD):

- **Receipt numbers:** one counter document per financial year, incremented and the receipt inserted in
  **one MongoDB transaction**, so a failure cannot burn a number. Confirmation is idempotent (existing
  receipt check, unique indexes, idempotency key). Within one server process confirmations are queued
  to avoid retry storms; correctness never depends on that queue (tested with it switched off).
- **PDF from a snapshot:** the certificate is rendered from the donor name, PAN and amount saved on the
  receipt, so later edits never change an issued certificate. Nothing is stored as a binary.
- **AI never decides eligibility.** Matching is a deterministic, tested rule engine. AI only drafts a
  Hindi summary (editor approves; every number must appear in the official notice) and, optionally,
  turns a sentence into answers that the woman confirms.
- **Hindi first and light:** system fonts (no web font download), 94 KB gzipped main script, admin
  screens loaded on demand, no trackers.

## Environment variables

Names only; see `.env.example`. `MONGODB_URI`, `JWT_SECRET`, `MOCK_WEBHOOK_SECRET`, `CLIENT_ORIGIN`,
`TRUST_NAME`, `TRUST_NAME_HI`, `TRUST_PAN`, `TRUST_80G_NUMBER`, `LLM_PROVIDER`, `LLM_API_KEY`,
`LLM_MODEL`, `RATE_LIMIT_DONATE_MAX`, `RATE_LIMIT_AUTH_MAX`, `SERVE_CLIENT`, `NODE_ENV`, `PORT`.

## Known limits

Payments are a mock. Monthly giving is a mock record plus a "run due gifts" action, not real recurring
billing. Admin screens cover schemes, reports and call-backs, not campaigns or static pages. PAN is
stored as typed (shown masked); field-level encryption is the next step. The live AI call needs an API
key; without one the admin sees a clearly labelled template draft. Hindi text was written for this demo
and should be reviewed by a native editor before real use. The Noto Sans Devanagari font in
`server/assets/fonts` is licensed under the SIL Open Font License.
