# Contributing

Thanks for your interest in contributing to Hypothesis Atlas.

## Development Setup

1. Run `make laptop-install`
2. Start app: `make dev`
3. Start worker: `make worker`

## Pull Requests

- Keep PRs focused and small
- Include a clear summary of what changed and why
- Update docs if behavior or setup changes
- Run `npm run build -- --no-lint` before opening a PR

## DCO Sign-off Required

By contributing you agree that your contributions are licensed under the project's dual licensing (AGPL-3.0 + commercial — see [`LICENSE`](LICENSE) and [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md)) and you certify the terms of the [Developer Certificate of Origin v1.1](https://developercertificate.org/) for every commit:

```bash
git commit -s
```

Commits without a `Signed-off-by:` line will not be merged. A DCO sign-off is used (rather than a CLA) to keep the copyright chain clean without per-contributor paperwork; for significant corporate contributions, contact the maintainer to arrange a CLA instead.

## License Headers

New source files should carry the SPDX identifier on the first line:

```ts
// SPDX-License-Identifier: AGPL-3.0-only
```

(adjust the comment syntax to the file type).

## Issues

- Use issues for bugs and feature requests
- Include reproduction steps, expected behavior, and actual behavior
