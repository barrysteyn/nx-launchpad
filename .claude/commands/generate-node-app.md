Generate a new Node.js/TypeScript application in this Nx monorepo using the workspace generator.

This generator scaffolds a Node.js TypeScript CLI app compiled to CommonJS, deployable as an AWS Lambda.

Follow these steps:

1. **Ask the user for the following before running anything:**
   - App name (must be kebab-case, e.g. `my-node-app`)
   - Short description of the app
   - Include AWS infrastructure? (yes/no, default: yes)
   - If yes: include API Gateway? (yes/no, default: yes)

2. **Run the generator** with the collected answers:
   ```
   npx nx generate @nx-launchpad/tools:node-app <app-name>
   ```
   The generator automatically runs `npm install --legacy-peer-deps` after writing files to keep the lock file in sync.

3. **Verify the generated files:**
   - `apps/<app-name>/src/main.ts` — exports `handler(event, context)` for Lambda and `main()` for local execution
   - `apps/<app-name>/tsconfig.json` — `"module": "commonjs"`, `"types": ["node"]`
   - `apps/<app-name>/package.json` — identity fields only, no `"type"` field (defaults to CJS)
   - `apps/<app-name>/eslint.config.js` — CJS flat config with `argsIgnorePattern: '^_'`
   - `apps/<app-name>/project.json` — Nx targets: `lint`, `format`, `typecheck`, `test`, `build`, `serve`, and all `tf-*` / `deploy` targets if infra was selected
   - `apps/<app-name>/infra/` — present if infrastructure was selected

4. **Run the generated project's targets to confirm the scaffold works:**
   ```
   npx nx run <app-name>:lint
   npx nx run <app-name>:format
   npx nx run <app-name>:typecheck
   npx nx run <app-name>:test
   npx nx run <app-name>:build
   ```
   If infra was generated, also run:
   ```
   npx nx run <app-name>:tf-validate
   ```

5. **Verify the lock file** — the generator runs `npm install` automatically, but confirm with:
   ```
   npm ci --legacy-peer-deps
   ```
   If this fails with a lock file sync error, regenerate it:
   ```
   npm install --legacy-peer-deps
   ```
   Then re-run `npm ci --legacy-peer-deps` to confirm it passes.

6. **Commit the result** using two commits:
   - One for the generated app files
   - One for `package-lock.json` if it changed

**Conventions to enforce:**
- App name must be kebab-case
- The `serve` target builds first (`dependsOn: ["build"]`) then runs `node dist/main.js` — do not use `--experimental-strip-types` directly, as `export` statements cause Node to treat the file as ESM
- Never commit `dist/` — it is the compiled output and is gitignored
- The `build` target compiles TypeScript to `dist/` via `tsc`; the Lambda `source_path` points to `dist/`
- The Lambda runtime is `nodejs22.x` and the handler is `main.handler`
