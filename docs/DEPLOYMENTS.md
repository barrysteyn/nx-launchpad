# Deployments

The deploy workflow (`.github/workflows/deploy.yml`) detects affected projects and deploys only what changed.

## Automatic deploys

| Branch | Environment |
|---|---|
| `main` | staging |
| `production` | production |

Every push to one of these branches runs `nx affected` over the touched commits, builds the projects whose source changed (or whose dependencies changed), and deploys them to the matching environment. No manual trigger needed.

## Manual deploys

Trigger from the **Actions** tab in GitHub. You will be prompted for an environment (`staging` or `production`) and an optional app name — leave blank to deploy all affected apps.

## Force-redeploying outside of CI

CI uses `nx affected`, which only deploys projects touched by recent changes. This is the right default — use it always.

There are three situations where you might need to bypass it and deploy manually:

- **After a dependency upgrade** — `affected` does not treat `package.json` changes as a trigger (by design), so a package bump won't auto-redeploy apps.
- **First deploy of a fresh repo** — no previous commit to diff against.
- **Recovering a broken environment** — staging is in a bad state and you want to force everything back to a known good state.

In those cases, deploy specific apps directly:

```bash
npx nx run <app-name>:deploy:staging
npx nx run <app-name>:deploy:production
```

Or redeploy everything at once (use sparingly):

```bash
npx nx run-many -t deploy --configuration=staging
```
