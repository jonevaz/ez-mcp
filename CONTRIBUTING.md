# Contributing to ez-mcp

Thanks for wanting to help. **First open-source contribution?** You're welcome
here — this guide assumes you've never sent a pull request before, and walks
through the whole thing. If anything is unclear, that's a bug in this document;
open an issue and tell us.

- [The short version](#the-short-version)
- [What we're looking for](#what-were-looking-for)
- [Setting up your machine](#setting-up-your-machine)
- [Making a change, step by step](#making-a-change-step-by-step)
- [Running the checks](#running-the-checks)
- [How the project fits together](#how-the-project-fits-together)
- [Opening the pull request](#opening-the-pull-request)
- [After you open it](#after-you-open-it)
- [Good first issues](#good-first-issues)
- [Ground rules](#ground-rules)

## The short version

For people who've done this before:

```bash
# fork on GitHub first, then:
git clone https://github.com/<your-username>/ez-mcp.git
cd ez-mcp
npm install
npm run dev            # app on http://localhost:3000
git checkout -b fix/short-description
# ...make your change, add a test...
npm test && npx tsc --noEmit && npm run lint && npm run build
git commit -m "Fix X in the OpenAPI parser"
git push origin fix/short-description
# then open a PR on GitHub
```

Everyone else: keep reading.

## What we're looking for

ez-mcp is a **faithful bridge** from an OpenAPI/Swagger spec to an MCP server —
one API operation becomes one MCP tool. It is deliberately *not* a layer that
reinterprets your API. Before you build something big, it helps to know which
side of that line it falls on. The [Roadmap in the
README](README.md#roadmap) is the current wish-list.

Especially welcome:

- **Spec compatibility.** A real-world OpenAPI or Swagger spec that imports
  wrong, drops parameters, or produces a broken tool schema. These are the
  highest-value bug reports — attach the spec (or a trimmed-down version).
- **Bug fixes** with a test that fails before your fix and passes after.
- **Docs** — if you got confused, fix the thing that confused you.

Please **open an issue first** for anything large or anything that changes the
shape of the product (new config, new dependency, a change to what a tool looks
like to the agent). A quick "I'm thinking of doing X, sound right?" saves you
from writing code that gets turned down.

## Setting up your machine

You need **Node.js 22 or newer** and npm (comes with Node). Check with:

```bash
node --version
```

Then:

```bash
# 1. Fork the repo on GitHub (button in the top-right of the repo page).
# 2. Clone YOUR fork (not the original):
git clone https://github.com/<your-username>/ez-mcp.git
cd ez-mcp

# 3. Install dependencies:
npm install

# 4. Start the dev server:
npm run dev
```

Open http://localhost:3000. A SQLite database is created automatically at
`data/app.db` — it's ignored by git, so your local data never ends up in a
commit.

> **Tip for trying the whole flow:** import the Swagger Petstore spec
> (`https://petstore3.swagger.io/api/v3/openapi.json`) as a source, add a couple
> of its operations to a new MCP, publish it, and call it with the snippet on
> the MCP detail page. That exercises import → tool schema → validation →
> execution end to end.

## Making a change, step by step

**1. Create a branch.** Never work on `main`. Give the branch a short,
descriptive name:

```bash
git checkout -b fix/swagger-formdata-content-type
```

Use a prefix that matches the work: `fix/`, `feat/`, `docs/`, `refactor/`.

**2. Make your change.** See [How the project fits
together](#how-the-project-fits-together) for where things live.

**3. Add a test.** If you're fixing a parser bug, add a fixture and a test that
fails on `main`. If you're not sure how, open the PR anyway and say so — we'll
help you write it. A change to parsing or execution without a test usually can't
be merged, because we can't tell if it stays fixed.

**4. Run the checks** (next section). Fix anything red.

**5. Commit.** Write a message that says *what* changed and *why*, in the
imperative:

```bash
git add .
git commit -m "Send Swagger formData bodies as urlencoded"
```

Small, focused commits are easier to review than one giant one.

## Running the checks

These are exactly what CI runs on your PR, so run them locally first and there
are no surprises:

```bash
npm test            # vitest — parser, validation, executor, secrets
npx tsc --noEmit    # TypeScript types
npm run lint        # eslint
npm run build       # Next.js production build
```

While iterating on tests, `npm run test:watch` re-runs them as you save.

The test fixtures in `tests/fixtures/` are real specs (Petstore OpenAPI 3 and
Swagger 2.0) plus a synthetic `edge-cases.yaml` that concentrates the tricky
cases — `$ref`, recursive schemas, `allOf`, unresolvable references. When you
fix a spec-parsing bug, the ideal PR adds a minimal fixture that reproduces it.

## How the project fits together

You usually only need to touch one of these. Data flows left to right:

**spec → source (endpoints) → MCP (tools) → agent calls tool → HTTP request**

| Area | File | When you'd touch it |
| --- | --- | --- |
| Parse a spec into endpoints | `src/lib/openapi.ts` | An operation/parameter is imported wrong |
| Resolve `$ref`, `allOf`, schemas | `src/lib/json-schema.ts` | A schema comes out empty, wrong, or loops |
| Auto-discover a spec from a URL | `src/lib/spec-discovery.ts` | A docs-page URL isn't resolved to its spec |
| Build the tool's `inputSchema` | `src/lib/tool-schema.ts` | The agent sees the wrong shape for a tool |
| Validate the agent's arguments | `src/lib/validate.ts` | A bad call should be rejected with a clear message |
| Make the actual HTTP request | `src/lib/executor.ts` | Wrong URL, body encoding, or auth on the outgoing call |
| Encrypt / mask credentials | `src/lib/secrets.ts` | Anything touching stored secrets |
| The MCP JSON-RPC endpoint | `src/app/api/mcp/[slug]/route.ts` | Protocol-level behaviour (`tools/list`, `tools/call`, …) |
| Server actions (create/edit/publish) | `src/lib/actions.ts` | The admin operations behind the UI |
| UI | `src/components/`, `src/app/` | Anything you see in the browser |

The database schema lives in `src/db/schema.ts`, and the design-system
components (buttons, inputs, modals) in `src/components/ds/`.

> **Heads up:** this project pins a version of Next.js whose conventions may
> differ from what you've seen elsewhere. If you're changing routing, server
> actions, or config, check the guide in `node_modules/next/dist/docs/` rather
> than going from memory.

## Opening the pull request

```bash
git push origin fix/swagger-formdata-content-type
```

GitHub prints a link to open the PR — or go to your fork's page and click
**Compare & pull request**. Point it at `main` of the original repo.

A template will fill in automatically. Please actually fill it out — the "How I
tested it" section is the part reviewers read first. A good PR:

- Changes **one thing**. If you found three unrelated bugs, that's three PRs.
- Has a title that describes the change (`Fix formData content-type`, not
  `Update executor.ts`).
- Links the issue it closes (`Closes #12`).
- Contains no secrets, tokens, or real API keys — double-check the diff, and
  never commit anything under `data/`.

Draft PRs are welcome. If it's not ready but you want early feedback, open it as
a **draft** and say what you're stuck on.

## After you open it

- **CI runs automatically.** If it goes red, click "Details" to see which check
  failed and push a fix to the same branch — the PR updates itself.
- **A maintainer will review.** We try to give a first response within a few
  days. A nudge after a week is completely fine.
- **Review comments are about the code, not you.** Push more commits to the same
  branch to address them; no need to open a new PR.
- Once approved, a maintainer merges. 🎉

## Good first issues

Look for issues tagged
[`good first issue`](https://github.com/jonevaz/ez-mcp/labels/good%20first%20issue).
No open ones right now? Some standing starter tasks:

- Add a real-world spec you use to `tests/fixtures/` and a test asserting a few
  of its operations parse correctly.
- Improve an error message in `src/lib/validate.ts` to be more actionable.
- Fill a gap from the README's **Known limitations** — start with the smallest.

## Ground rules

- **Be kind.** Assume good faith, keep it respectful. This project follows the
  [Code of Conduct](CODE_OF_CONDUCT.md) (Contributor Covenant 2.1); behaviour
  that violates it isn't welcome. Report concerns privately to jone@vaztech.me.
- **License.** ez-mcp is GPL-3.0. By contributing, you agree your contribution
  is licensed under the same terms.
- **Your work is your own.** Only submit code you have the right to submit. Don't
  paste in code from a source with an incompatible license.

Thanks again — genuinely. Every fixed spec and clearer error message makes this
useful for the next person.
