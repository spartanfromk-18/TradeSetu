# TradeSetu Pre-launch Checklist

Use one copy of this checklist per release candidate. Every unchecked item requires evidence,
an owner, and a date before it can be marked complete. `MANUAL` means a human must perform the
check; `BLOCKED` requires an explicit resolution before production promotion.

## A. Automated local gates

| Gate | Status | Evidence | Owner | Date |
|---|---|---|---|---|
| `npm run release:check` passes | NOT STARTED |  |  |  |
| `npm run audit:prod` reports 0 high-severity production vulnerabilities | NOT STARTED |  |  |  |
| `git status` and intended commit contents reviewed | NOT STARTED |  |  |  |
| Development dependency risk acceptance reviewed | ACCEPTED | [dependency-risk.md](./dependency-risk.md) | Release manager | 2026-10-19 |

## B. Vercel preview smoke tests

Perform these manually against the Vercel preview URL in [preview-urls.md](./preview-urls.md).

| Check | Status | Evidence | Owner | Date |
|---|---|---|---|---|
| Preview uses `npm run build:vercel` and publishes `dist/` | MANUAL | Deployment log URL:  |  |  |
| Home page loads over HTTPS with expected title and calculator | MANUAL | Preview URL / screenshot:  |  |  |
| Valid inputs generate a quote and broker comparison | MANUAL | Test input and screenshot:  |  |  |
| Deep-link refresh returns the SPA instead of 404 | MANUAL | Deep-link URL and result:  |  |  |
| Console and network show no unexpected errors or requests | MANUAL | Console capture / HAR path:  |  |  |
| IndexedDB read/write works after page reload | MANUAL | Storage inspection / screenshot:  |  |  |
| Mobile layout works at narrow viewport | MANUAL | Device/viewport and evidence:  |  |  |
| Required security headers are present | MANUAL | Header capture:  |  |  |
| Hashed `/assets/` responses are immutable and cacheable | MANUAL | Header capture / repeat request:  |  |  |

## C. Cloudflare Pages preview smoke tests

Perform the same checks against a non-production Pages preview or branch deployment.

| Check | Status | Evidence | Owner | Date |
|---|---|---|---|---|
| Preview uses `npm run build` and publishes `dist/` | MANUAL | Deployment log URL:  |  |  |
| Home page, quote generation, deep-link refresh, console, and IndexedDB checks pass | MANUAL | Test evidence:  |  |  |
| Mobile layout works at narrow viewport | MANUAL | Device/viewport and evidence:  |  |  |
| Required security headers are present | MANUAL | Header capture:  |  |  |
| Hashed `/assets/` responses are immutable and cacheable | MANUAL | Header capture / repeat request:  |  |  |

## D. Browser/device validation

All entries begin as `MANUAL / NOT STARTED`. Test quote generation, reload persistence,
Web Worker execution, keyboard-only navigation, reduced motion, speech fallback, and console
errors. Mobile layout applies to mobile targets.

| Target | App loads | Calculator works | IndexedDB after reload | Web Worker | Keyboard navigation | Reduced motion | Speech fallback | Mobile layout | Console errors | Evidence / Owner / Date |
|---|---|---|---|---|---|---|---|---|---|---|
| Chrome desktop | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | N/A | MANUAL / NOT STARTED |  |
| Firefox desktop | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | N/A | MANUAL / NOT STARTED |  |
| Safari desktop | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | N/A | MANUAL / NOT STARTED |  |
| Edge desktop | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | N/A | MANUAL / NOT STARTED |  |
| Android Chrome | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED |  |
| iOS Safari | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED | MANUAL / NOT STARTED |  |

## E. Performance release gate

Run Lighthouse against a deployed preview. Do not fill in measurements until they are observed.

### Performance evidence

| Field | Value |
|---|---|
| Preview URL |  |
| Test date |  |
| Device profile |  |
| Lighthouse performance score |  |
| LCP (target: < 2.5s) |  |
| CLS (target: < 0.1) |  |
| INP (target: < 200ms) |  |
| Initial JS gzip size |  |
| Calculator first-interaction result |  |
| Report file path |  |
| Owner |  |

Example commands:

```bash
npx lighthouse <PREVIEW_URL> --preset=perf --form-factor=mobile --screenEmulation.mobile=true --output=html --output-path=./artifacts/lighthouse-mobile.html
npx lighthouse <PREVIEW_URL> --preset=perf --form-factor=desktop --output=html --output-path=./artifacts/lighthouse-desktop.html
```

Replace `<PREVIEW_URL>` with the actual preview URL. These commands are measurement examples,
not automated release gates.

## F. Edge worker launch decision

| Question | Decision | Evidence / Owner / Date |
|---|---|---|
| Is the edge worker required for the core calculator? | NO — core calculation is browser-local |  |
| Is it required for launch? | NO — recommended default |  |
| If NO, will it be disabled for initial production release? | YES — recommended default |  |
| If enabled, what manual preview checks are required? | Valid/invalid requests, CORS, ETags/304, cache failures, security headers, and local operation when unavailable |  |

Default recommendation: if the core calculator works without the edge worker, disable it for the
first production release and verify it in a later release. Do not change worker functionality as
part of this release-candidate preparation.

## G. Release decision

Production promotion is allowed only when every applicable gate is `PASS` or formally `ACCEPTED`
with documented justification. `MANUAL` and `BLOCKED` gates are not complete.

| Gate | Status | Evidence | Owner | Date |
|---|---|---|---|---|
| Automated local checks | MANUAL |  |  |  |
| Production dependency audit | MANUAL |  |  |  |
| Development dependency risk acceptance | ACCEPTED | [dependency-risk.md](./dependency-risk.md) |  |  |
| Vercel preview smoke test | MANUAL |  |  |  |
| Cloudflare Pages preview smoke test | MANUAL |  |  |  |
| Performance gate | MANUAL |  |  |  |
| Browser/device validation | MANUAL |  |  |  |
| Edge-worker decision | ACCEPTED | Section F recommendation, confirm before release |  |  |
| Rollback readiness | MANUAL |  |  |  |

**Final decision:** NO-GO
**Decision owner:** ____________________
**Decision date:** ____________________
**Decision notes:** Production promotion remains blocked until the applicable manual gates are
completed and the final decision is changed to `GO`.
