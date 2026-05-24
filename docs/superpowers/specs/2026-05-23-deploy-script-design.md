# Deploy Script Design

**Date:** 2026-05-23
**Status:** Approved for implementation planning

## Goal

Replace the manual "copy changes to `gh-pages` and push" workflow with a single command: `npm run deploy`. Also add `npm run serve` / `npm start` so the local-preview step from `CLAUDE.md` becomes a script too.

## Non-goals

- No CI/GitHub Action — this is a local, user-triggered deploy.
- No build step, bundler, or framework.
- No automated tests for the script itself.

## Files

- `package.json` — npm scripts only, zero runtime dependencies.
- `scripts/deploy.js` — the deploy script (Node, built-ins only, shells out to `git` / `rsync`).
- `.gitignore` — add `node_modules/` (already present) and the worktree path if it ends up inside the repo.

## npm scripts

```json
{
  "scripts": {
    "serve": "npx serve .",
    "start": "npm run serve",
    "deploy": "node scripts/deploy.js"
  }
}
```

## Deploy script flow

### 1. Preflight

- Verify cwd is the repo root (look for `.git/` and `CNAME`).
- Verify current branch is `main`; abort otherwise.
- Verify the working tree is clean (`git status --porcelain` empty); abort if dirty so we never deploy uncommitted work.
- `git fetch origin gh-pages`.

### 2. Worktree setup

- Worktree path: `../deitte.com-gh-pages` (sibling directory — keeps it outside the repo so rsync can't recurse into it and `.gitignore`/excludes stay simple).
- If the path already exists from a prior aborted run: `git worktree remove --force` it first.
- `git worktree add -B gh-pages <path> origin/gh-pages` — resets the local `gh-pages` branch to match the remote, avoiding drift.

### 3. Sync

`rsync -a --delete` from repo root → worktree, with:

- `--filter=':- .gitignore'` — honors per-directory `.gitignore` rules (covers `.env*`, `*.pem`, `*.key`, `credentials.json`, `.DS_Store`, `node_modules/`).
- Explicit `--exclude` for files that aren't gitignored but shouldn't ship:
  - `CLAUDE.md`
  - `README.md`
  - `.gitignore`
  - `package.json`
  - `package-lock.json`
  - `scripts/`
  - `plan/`
  - `docs/`
  - `.git/`
  - `.github/` (if ever added)

Files that must survive: `CNAME`, `.nojekyll` (they live in main and are not excluded).

### 4. Commit + push

- In the worktree: `git add -A`.
- If `git diff --cached --quiet` shows no changes → print "No changes to deploy." and exit 0.
- Otherwise:
  - Print `git diff --cached --stat` so the user sees what's changing.
  - Prompt: `Deploy these changes? [y/N]` (read from stdin).
  - On `y`/`yes`:
    - `git commit -m "Deploy from main @ <short-sha-of-main-HEAD>"`
    - `git push origin gh-pages`
  - On anything else: abort without committing.
- If stdin is not a TTY, refuse to push (safety for accidental piped invocations).

### 5. Teardown

- `git worktree remove --force <path>` in a `finally` block so it runs on success, failure, or Ctrl-C.
- Trap `SIGINT` to ensure cleanup on interrupt.

## Error handling

- Every shelled command checks exit code; on failure, print stderr and exit nonzero after teardown.
- No retries — failures are surfaced to the user to resolve.

## Verification (manual)

After implementation:

1. Run `npm run deploy` with no pending changes → expect "No changes to deploy."
2. Make a trivial change on `main`, commit it, run `npm run deploy` → confirm prompt, accept, then verify on GitHub that `gh-pages` has the change and that `CLAUDE.md` / `README.md` / `scripts/` are absent and `CNAME` / `.nojekyll` are present.
3. Run `npm run serve` → confirm site loads at the printed local URL.
