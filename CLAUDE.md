# Claude Code Instructions

## Git Commits

Always use [Conventional Commits](https://www.conventionalcommits.org/) format for all commit messages:

```
<type>(<optional scope>): <description>
```

Valid types:
- `feat` — a new feature
- `fix` — a bug fix
- `chore` — maintenance tasks (deps, config, tooling)
- `docs` — documentation changes only
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `ci` — CI/CD pipeline changes
- `build` — changes to the build system or external dependencies
- `perf` — performance improvements
- `style` — formatting, whitespace (no logic change)

Examples:
- `feat(analyzer): add crawl depth configuration`
- `fix(api): handle null response from upstream`
- `chore: update nx and package dependencies`
- `docs: update README with setup instructions`

This is required for the GitHub PR checks to pass.
