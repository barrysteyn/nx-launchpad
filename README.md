# NxLaunchpad

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Getting Started

**==> 🚀🚀🚀 All the rest of the instructions assume you are in the NX root folder. <==**

Install needed VSCode extensions:
```bash
cd .vscode && cat extensions.json | jq -r '.recommendations[]' | xargs -n 1 code --install-extension && cd ..
```

Set git config:
```bash
git config --global pull.rebase true
git config user.name "Your Name"
git config user.email "your.name@project.com"
```