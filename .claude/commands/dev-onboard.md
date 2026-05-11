Set up the local dev environment for an already-onboarded fork: installs Homebrew, Volta + Node, uv, Maven, optional Java 21, cloud CLIs (gh/aws/terraform/jq), npm modules + husky hooks, VSCode extensions, and configures repo-local git settings.

This is the contributor-only setup. For a fresh fork that still needs cloud provisioning, run `/onboard` instead — `/onboard` calls this skill as its first step.

Follow these steps in order.

## Step 1 — Ask about Java

If `.env` exists and contains `ONBOARD_AUTO=true`, **skip this prompt** — default to no-Java for Step 2's script invocation.

Otherwise, ask the user:

> "Install Java 21 (Temurin) now? It's only needed if you'll be working with JVM apps in this workspace. You can re-run `/dev-onboard` later if you change your mind. [y/N]"

Remember their answer for Step 2 — you'll inline it on the `bash scripts/setup.sh` command if they said yes.

## Step 2 — Run the install script

Run:

- If the user answered **yes** in Step 1: `INSTALL_JAVA=true bash scripts/setup.sh`
- If the user answered **no** (default): `bash scripts/setup.sh`

Watch for errors. If any of these fail (Homebrew install, Volta install, brew formula install, npm ci), halt and report the exact error to the user — most failures here need manual investigation.

After the script completes, confirm by checking that key tools are on PATH:

```bash
command -v volta && command -v node && command -v uv && command -v gh && command -v terraform && command -v aws
```

If any return empty, the user likely needs to open a new terminal for PATH changes to take effect. Tell them to open a new terminal and re-run `/dev-onboard`.

## Step 3 — Configure repo-local git settings

These two settings are project conventions and are set automatically (no prompt). They are repo-local, not global, so other repos on the user's machine are not affected.

```bash
git config pull.rebase true
git config push.autoSetupRemote true
```

Confirm by reading them back:

```bash
git config --get pull.rebase
git config --get push.autoSetupRemote
```

Both should output `true`.

## Step 4 — Set git user.name / user.email if missing

Check whether they're already set (either repo-locally or globally):

```bash
git config user.name
git config user.email
```

If `git config user.name` returns empty, ask:

> "Your git `user.name` is not set in this repo. What should it be? (e.g. 'Jane Doe')"

Set repo-locally:

```bash
git config user.name "<answer>"
```

If `git config user.email` returns empty, ask:

> "Your git `user.email` is not set in this repo. What should it be? (e.g. 'jane@example.com')"

Set repo-locally:

```bash
git config user.email "<answer>"
```

If both were already set, skip this step entirely (no prompt).

## Step 5 — Done

Print:

> "Dev environment ready. If `volta` / `node` / `gh` aren't found in your shell, open a new terminal so PATH changes take effect.
>
> Next steps:
>   • If this is a fresh fork: run `/onboard` to provision staging cloud resources.
>   • Otherwise: you're ready to work — see the README for what to do next."
