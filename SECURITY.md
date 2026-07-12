# Security Policy

Shinobi generates IAM policies, network rules, and other security-sensitive
infrastructure. We take vulnerability reports seriously — both in the codebase
itself and in the security posture of what it generates (e.g., a code path
that silently widens IAM scope).

## Supported Versions

Only the latest published `0.x` versions of the `@shinobi/*` packages receive
security fixes.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security reports.

- Preferred: use GitHub's private vulnerability reporting on this repository
  ("Security" tab → "Report a vulnerability").
- You should receive an acknowledgement within 5 business days.

Please include a description of the issue, a minimal reproduction (a manifest
plus the command run, where applicable), and the affected package/version.

## Scope Notes

Reports about generated infrastructure being broader than the manifest
requested (least-privilege violations, silent wildcard widening, policy-pack
bypass) are in scope and treated as security issues, not just bugs — see
KL-005 in [CLAUDE.md](CLAUDE.md).
