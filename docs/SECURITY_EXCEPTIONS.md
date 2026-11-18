# Security exceptions (dependency audit)

CI job **Dependency vulnerability scan** runs `npm run audit:gate`
(`scripts/audit-gate.mjs`). It wraps `npm audit` with the same threshold
(**high and critical block**) and supports explicit, time-boxed exceptions.
`npm audit` itself has no per-advisory ignore, which is why the wrapper exists.

## Active exceptions

| Advisory | Package | Expires (review) | Status |
|---|---|---|---|
| [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (CVE-2026-112366, CVSS 7.5) | `picomatch` <= 4.0.7 | **2026-12-02** (00:00 UTC) | No patched release exists |

### Reason

On 2026-11-17 the advisory was widened to every published `picomatch` version
(`<= 4.0.7`). The registry's latest is 4.0.7 and the upstream fix
(micromatch/picomatch#194) is not released, so no upgrade, override or Vite
change can remove it. `npm audit` reports it as 4 high entries (`picomatch`,
`fdir`, `tinyglobby`, `vite`) - one root cause, not four.

### Residual risk

- **Dev-only.** `npm ls picomatch --omit=dev` is empty; it is not in the
  production bundle (`dist/index.cjs`).
- The flaw is a ReDoS: a crafted repeated-extglob pattern such as `+(*)` can
  block the Node event loop. Vite, `tinyglobby` and `fdir` receive globs from
  our own config and source, never from application users.
- Worst case: a hung local dev server or CI build (availability only; no data
  exposure or code execution). Risk rises only if a tool is added that passes
  untrusted globs to picomatch.

### Removal conditions

Remove the exception (delete the entry in `EXCEPTIONS`) when **any** is true:

1. A patched `picomatch` is published (expected `>= 4.0.8`): run
   `npm update picomatch` (or add an `overrides` entry if a parent pins it),
   confirm `npm audit --audit-level=high` passes **without** the exception.
2. A Vite/`tinyglobby`/`fdir` release stops depending on the affected range.
3. The review date passes: the gate **fails** from 2026-12-02. Either remove the
   exception (1 or 2) or re-assess and extend `expiresOn` in a reviewed change.

## How the gate behaves

- Blocks every high/critical advisory not covered by an active exception. The
  exception matches the **advisory id**, not the package: any other advisory on
  `picomatch`, `vite`, `fdir` or `tinyglobby` still blocks. An entry carrying the
  excepted advisory *and* another one is blocked.
- **Fails closed** (exit 2) if `npm audit` cannot run, errors (e.g. 403/offline),
  prints nothing or invalid JSON, uses an unexpected report version, or the
  listed entries do not match npm's own totals (truncated or tampered report).
- Exit codes: `0` pass, `1` blocked by findings, `2` audit failed/invalid.
- Moderate/low findings are reported by `npm audit` but do not block (unchanged).

## Changing exceptions

Adding or extending an exception needs explicit review and approval. Keep each
one to a single advisory id with a reason and an expiry, and update this file.
Run `npm run test:audit-gate` after any change.
