# Contributing to Fixed Income Analytics

Thanks for your interest in improving Fixed Income Analytics. Issues, discussions, and pull requests are
all welcome.

This project is maintained under a benevolent-dictator model — see [`GOVERNANCE.md`](./GOVERNANCE.md)
for how decisions are made.

## Before you start

- For anything non-trivial, **open an issue first** to discuss the approach. It saves everyone time
  and avoids work that doesn't fit the project's direction.
- Bugs and small, self-evident fixes can go straight to a pull request.

## Contributor License Agreement (required)

Before your first contribution can be merged, you must agree to the
**[Contributor License Agreement](./CLA.md)**.

You keep full ownership of your work — the CLA grants the project the rights it needs to include
your contribution and to keep the project's licensing options open. It is a one-time agreement that
covers all your future contributions.

**How to accept:** when you open a pull request, the CLA check will guide you (typically a single
click to sign via the CLA-assistant bot). If the automated check is not yet enabled, a maintainer
will ask you to confirm your agreement to `CLA.md` on the pull request before merging.

> Maintainer note: external contributions are **not merged** until the CLA is accepted. See the
> hard-rule note in `GOVERNANCE.md`.

## Development

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test              # vitest
npm run build         # tsup → ESM + CJS + .d.ts
```

Please make sure `typecheck`, `test`, and `build` all pass before opening a pull request. CI runs
the same checks.

## Code style and conventions

- Match the surrounding code — naming, comment density, and structure. The codebase has strong,
  consistent patterns (pure domain math returning `Result<T>`, immutable value objects, formulas
  organized as `*.types` / `*.math` / `*.validation` / `index`). New work should fall in gracefully.
- Keep the domain layer pure (no I/O, no exceptions; return `Result`).
- Add **direct, focused tests** for new behavior, mirroring the existing suite. Pin financial math
  to analytical identities or reference values rather than to internally-computed numbers.
- Update the docs (`docs/concepts/methodology.md` for new financial methods) and add an example line
  where it helps.

## Pull requests

- Keep PRs focused on a single change.
- Write a clear description of *what* and *why*.
- Link the issue it addresses.

## Credit

Merged contributors are added to [`AUTHORS`](./AUTHORS). Thank you.
