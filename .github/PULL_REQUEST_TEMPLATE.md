<!--
PR title must follow Conventional Commits (it feeds semantic-release & the changelog).
Examples: feat(cli): add pitch scatter · fix(web): correct standings sort · docs: …
-->

## What & why
<!-- What does this change and why? Link any related issue: Closes #123 -->

## Component(s)
<!-- cli / web / site / ci / docs -->

## Checklist
- [ ] PR title follows Conventional Commits
- [ ] Builds & tests pass for the affected component
  - CLI: `cd cli && go build ./... && go vet ./... && go test ./...`
  - Web: `cd web && npm run lint && npm test`
  - Site: `cd site && npm run build`
- [ ] Docs/README updated if behavior changed
- [ ] No secrets or API keys committed
