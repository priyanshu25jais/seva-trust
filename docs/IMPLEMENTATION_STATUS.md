# Implementation status

This archive contains the full demo workflow assembled from the supplied project:
- public scheme directory and preliminary eligibility finder
- donor registration/login and donation history
- campaign-backed mock donation creation
- idempotent mock payment confirmation
- transactional receipt number allocation and PDF download
- admin summary, recent donations, CSV export and basic scheme/campaign APIs

Not included / not production-ready:
- real payment gateway and verified webhooks
- actual recurring payment collection
- live AI summary generation
- email/SMS/WhatsApp notifications
- production tax certificate / Form 10BD integration
- verified official scheme content
- production PAN encryption and key management
- deployment configuration

Database note: transaction-based payment confirmation requires MongoDB running as a replica set. The supplied MongoDB Atlas connection is suitable when the cluster supports transactions. A standalone local MongoDB server will fail this workflow.

Seed note: the seed script is destructive by design and now refuses to run unless `SEED_RESET=true` is set. Only run it against a disposable demo database.
