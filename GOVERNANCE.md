# Governance

## Who decides

Fixed Income Analytics is a **benevolent-dictator (BDFL)** project. **Matas Urbonavičius** is the
project lead and holds final say on direction, design, what gets merged, and what gets released.

Contributors propose; the lead decides. This is not about gatekeeping — it's about keeping the
project coherent. Anyone is welcome to open issues, discussions, and pull requests, and good ideas
are adopted regardless of where they come from. But when there is a disagreement that discussion
doesn't resolve, the lead makes the call.

This model may be relaxed over time (e.g. a maintainer team or steering group) as the project and
its community grow. Loosening control is easy; tightening it later is not — so we start clear.

## How changes land

- `main` is protected: no direct pushes. All changes arrive via pull request.
- Pull requests require review and approval by the project lead (see `CODEOWNERS`).
- The lead holds merge and release rights.
- CI (typecheck, tests, build) must pass before merge.

## Identity

The **name "Fixed Income Analytics" and any associated logo are marks of the project lead**, and are *not*
covered by the source-code license. See [`TRADEMARK.md`](./TRADEMARK.md). The code is open under
Apache-2.0; the name is not a free-for-all.

## ⚠️ Note to future maintainers — read before merging the first external contribution

This project keeps the option open to relicense, dual-license, or offer a commercial edition in the
future. That option **only survives if every outside contribution is covered by a Contributor
License Agreement (CLA)** that grants the project lead the necessary rights.

- A CLA is in place: see [`CLA.md`](./CLA.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **Do not merge any pull request from an external contributor until they have agreed to the CLA.**
- Removing or weakening the CLA, or merging un-covered external code, can permanently foreclose the
  ability to relicense or commercialize the project. Treat this as a hard rule.
