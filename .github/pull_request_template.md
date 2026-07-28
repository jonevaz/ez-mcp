<!--
Thanks for contributing to ez-mcp! 🎉
First time here? Read CONTRIBUTING.md — it walks through setup and what we look for.
Keep this PR focused: one topic per PR is much easier to review and merge.
-->

## What & why

<!-- What does this change do, and what problem does it solve?
     Link any related issue with "Closes #123" so it auto-closes on merge. -->

Closes #

## Type of change

<!-- Delete the ones that don't apply. -->

- Bug fix
- New feature
- Parser / spec-compatibility (OpenAPI 3.x or Swagger 2.0)
- Docs
- Refactor / internal (no behaviour change)
- Other:

## How I tested it

<!-- Show your work. "It builds" is not testing. -->

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

<!-- If it touches the parser: which real spec(s) did you try it against?
     If it touches the MCP endpoint or executor: what tools/call did you run, and what came back? -->

## For parser / spec changes

<!-- Delete this whole section if it doesn't apply. -->

- [ ] I added or updated a fixture in `tests/fixtures/` covering this case
- [ ] I added a test that fails on `main` and passes with this change

## Checklist

- [ ] The change is focused on a single topic
- [ ] I read [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md)
- [ ] No secrets, tokens, or real API keys in the diff (including `data/`)
- [ ] I updated the docs / README if behaviour changed
- [ ] I updated the "Known limitations" or "Roadmap" in the README if this closes a gap

## Anything reviewers should know

<!-- Trade-offs you made, things you're unsure about, follow-ups you're leaving for later.
     Being honest here makes review faster, not slower. -->
