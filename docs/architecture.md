# Architecture

## Current Direction

The project is being refactored toward a layered structure:

- `apps/`: runnable entrypoints such as CLI and future desktop app
- `src/app/`: use cases that orchestrate business flows
- `src/domain/`: schemas and business-facing models/rules
- `src/infra/`: integrations with browser automation, file storage, PDF, email, and notifications
- `src/shared/`: cross-cutting helpers such as logging and path utilities

## Current Mainline

The missing-stay mainline has been rewritten as a clean Playwright flow:

- CLI entrypoint: `apps/cli/index.js`
- Main use case: `src/app/use-cases/submit-missing-stay-batch.js`
- Browser adapters:
  - `src/infra/browser/playwright/marriott-session.js`
  - `src/infra/browser/playwright/marriott-auth-client.js`
  - `src/infra/browser/playwright/marriott-missing-stay-submitter.js`
- Runtime config: `src/infra/config/load-runtime-config.js`
- Input/output storage: `src/infra/storage/`

The prior missing-stay implementation is no longer the source of truth. Legacy paths only exist as wrappers where needed.

## Email Integration Policy

Email is now API-only:

- API client: `src/infra/email/ryyasia-api-client.js`
- Email polling service: `src/infra/email/ryyasia-api-email-service.js`

Email responsibilities are intentionally narrow:

- create mailbox
- query email list

Verification-code extraction and generic IMAP/mailparser-based email code have been dropped from the main project surface.

## Planned Next Migration

- Move PDF parsing/export/cleaning into `src/infra/pdf/`
- Introduce domain entities and DTOs for normalized folio/member/stay data
- Add tests around the new use-case boundaries

## Main Runtime Flow

`CLI -> use-case -> browser/storage/notify adapters -> output artifacts`

## Legacy Removal

The former `ocbot` / `agent-browser` experimental automation path and its old commands have been removed from the active project surface.
