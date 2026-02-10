# Contributing

Thanks for your interest in contributing to iphone-mcp! Here's how to get started.

## Getting started

1. Fork the repo and clone your fork
2. Enable Corepack and install dependencies:
   ```bash
   corepack enable
   yarn install
   ```
3. Run the preflight check:
   ```bash
   yarn doctor
   ```
4. Create a branch for your change:
   ```bash
   git checkout -b my-change
   ```

## Development workflow

```bash
yarn dev          # Run with auto-restart on changes
yarn test         # Run all tests
yarn check        # Format + lint fix + typecheck (run before committing)
```

## Before submitting a PR

1. Run `yarn check` and make sure it passes
2. Add tests for new functionality
3. Keep changes focused — one feature or fix per PR
4. Write a clear PR description explaining what changed and why

## Code style

- ESM only (`import`/`export`)
- Strict TypeScript — no `any`
- Single quotes, 2-space indent, trailing commas (Prettier handles formatting)
- See `CLAUDE.md` for detailed conventions

## Reporting bugs

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Output of `yarn doctor`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
