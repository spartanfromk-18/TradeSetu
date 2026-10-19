# Dependency Risk Acceptance Record

**Record:** Tailwind 3 development dependency chain
**Decision:** Accepted for release candidate only
**Record date:** 2026-10-19
**Owner:** TBD — project maintainer
**Review date:** TBD
**Expiry date:** TBD — review before production promotion

## Vulnerable dependency chain

```text
tailwindcss@3.4.19
├─ chokidar@3.6.0
│  └─ braces@3.0.3
└─ micromatch@4.0.8
   └─ braces@3.0.3
```

The audit also reports related transitive findings through `fast-glob`, `postcss-nested`, and
`postcss-selector-parser`.

## Severity and advisory context

The primary finding is `GHSA-vfj7-8cjw-p6xm`: `braces` is vulnerable to stack-exhaustion denial
of service through deeply nested patterns. npm reports it as **high severity**, CWE-674, CVSS
3.1 score 7.5. The related selector-parser findings are reported as moderate. The available npm
fix is `tailwindcss@4.3.3`, which is a semver-major upgrade.

## Evidence and assessment

- `npm audit --omit=dev --audit-level=high` was run for this release-candidate review and reported
  **found 0 vulnerabilities**.
- `tailwindcss`, `chokidar`, `micromatch`, and `braces` are in the development dependency tree.
- The generated frontend bundle does not ship Tailwind's build tooling or these packages.
- The calculator runtime, Web Worker, IndexedDB code, and optional edge worker do not import or
  execute this dependency chain.
- The affected code remains reachable during Tailwind/PostCSS build-time content scanning, so the
  vulnerability is not claimed to be impossible. This assessment assumes the project build is run
  by trusted CI/developer environments with repository-controlled content globs, not as a public
  service processing attacker-controlled input.

## Production exposure assessment

No production runtime path was identified for the vulnerable packages. The production-only npm
audit is clean, and the packages are not included in `dist/`. Build-time exposure remains a
development/CI availability risk if an attacker could supply deeply nested patterns to the
Tailwind scan or compromise the build environment.

## Release-candidate decision

Accept this risk for the release candidate because the verified exposure is development/build-time
only and no production runtime path was identified. Do not upgrade Tailwind automatically as part
of this release.

## Compensating controls

- Keep the build environment and Node.js requirement at Node 20+.
- Run `npm run audit:prod` in the release gate.
- Use repository-controlled Tailwind content globs; do not expose the build pipeline as an
  untrusted input service.
- Keep CI and local dependency installation restricted to trusted changes and review lockfile
  updates.
- Reassess this record if the build process, content sources, or deployment architecture changes.

## Tailwind 4 migration plan

Plan a separate migration from Tailwind 3 to Tailwind 4. That work must review the Tailwind
configuration and PostCSS integration, update dependencies and the lockfile, run both hosting
builds, compare rendered styles, and execute the browser/device checklist before changing this
record. The migration is intentionally out of scope for this release candidate.
