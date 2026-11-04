Project: Seva Trust (illustrative name, an assumption). Client: a charitable trust in Bhopal, Madhya Pradesh. Build an NGO donation platform whose home page leads with a women's schemes section and eligibility finder, plus donations with instant 80G receipts.

Stack: React + Vite, Node + Express, MongoDB Atlas with Mongoose, JWT auth, zod validation, Jest + supertest.

Architecture: modular monolith. Flow is route -> controller -> service -> model. Business logic lives in services as plain functions. Controllers only validate and respond. React components only display.

Roles: visitor (no login), donor, admin. Enforce access with middleware, never only by hiding buttons.

Product rules: Hindi first (react-i18next, hi default, English toggle). Minimal design: white space, one accent colour, 18px base text, 48px tap targets, 4.5:1 contrast, no stock photos, no trackers. Every screen has loading, empty and error states and works at 360px width. Donating takes at most 3 steps.

Safety rules: payments are mocked. Trust PAN and 80G number are placeholders read from env. Scheme pages show a source link and last-checked date. Eligibility results say possible match, show the rules used, and never promise. AI output is always a draft until an admin approves it.

Security: no secrets in git, .env.example only, helmet, rate limiting, validate all inputs, show PAN masked in UI.

Git: small commits with conventional messages (feat:, fix:, test:, docs:). Never squash. After each task, tell me what you changed and how to verify it.
