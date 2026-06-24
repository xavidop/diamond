# Security Policy

## Supported versions

Diamond is actively developed; security fixes land on the latest release.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's **[Report a vulnerability](https://github.com/xavidop/diamond/security/advisories/new)**
(Security → Advisories → Report a vulnerability). Include:

- a description and impact,
- steps to reproduce or a proof of concept,
- affected component (`cli/`, `web/`, or `site/`) and version/commit.

You'll get an acknowledgement, and we'll coordinate a fix and disclosure with you.

## Scope notes

- Diamond reads the **public** MLB Stats API; no MLB credentials are involved.
- DiamondGPT uses provider API keys supplied by the user/operator — keys are
  never committed and are read from the environment or entered at runtime.
