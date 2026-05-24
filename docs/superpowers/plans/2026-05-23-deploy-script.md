# Deploy Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual gh-pages deploy with `npm run deploy`, and add `npm run serve` / `npm start` for local preview.

**Architecture:** A single Node script (`scripts/deploy.js`, built-ins only) creates a sibling `git worktree` of `gh-pages`, rsyncs `main`'s tree into it with excludes (honoring `.gitignore`), shows a diff, prompts for confirmation, commits, pushes, and tears the worktree down. `package.json` exposes the npm scripts; no runtime dependencies.

**Tech Stack:** Node (built-ins: `child_process`, `readline`, `path`, `fs`), `git`, `rsync`, `npx serve`.

**Spec:** `docs/superpowers/specs/2026-05-23-deploy-script-design.md`

---

## File Structure

- Create: `package.json` — npm scripts, no deps
- Create: `scripts/deploy.js` — deploy script
- Modify: `.gitignore` — already has `node_modules/`; nothing else needed since the worktree is a sibling dir outside the repo

---

## Task 1: Add package.json with npm scripts

**Files:**
- Create: `package.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "deitte-com",
  "version": "1.0.0",
  "private": true,
  "description": "deitte.com static site (served from gh-pages)",
  "scripts": {
    "serve": "npx serve .",
    "start": "npm run serve",
    "deploy": "node scripts/deploy.js"
  }
}
```

- [ ] **Step 2: Verify `npm run serve` works**

Run: `npm run serve`
Expected: `npx serve` starts (prompts to install `serve` if not cached, then serves on `http://localhost:3000`). Ctrl-C to stop.

- [ ] **Step 3: Verify `npm run deploy` resolves (will fail because script doesn't exist yet)**

Run: `npm run deploy`
Expected: Node error like `Cannot find module '.../scripts/deploy.js'`. This confirms the script wiring is correct.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Add package.json with serve/start/deploy scripts"
```

---

## Task 2: Implement deploy script — preflight + worktree + sync + commit/push + teardown

This is one task because the script is small and the pieces are tightly coupled. Build the whole script, then exercise it end-to-end.

**Files:**
- Create: `scripts/deploy.js`

- [ ] **Step 1: Create `scripts/deploy.js`**

```javascript
#!/usr/bin/env node
const { execFileSync, spawnSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = process.cwd();
const WORKTREE_PATH = path.resolve(REPO_ROOT, '..', 'deitte.com-gh-pages');

const EXCLUDES = [
  'CLAUDE.md',
  'README.md',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'scripts',
  'plan',
  'docs',
  '.git',
  '.github',
];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}\n${result.stderr}`);
  }
  return result.stdout;
}

function preflight() {
  if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    throw new Error(`Not a git repo root: ${REPO_ROOT}`);
  }
  if (!fs.existsSync(path.join(REPO_ROOT, 'CNAME'))) {
    throw new Error(`CNAME missing at ${REPO_ROOT} — wrong directory?`);
  }
  const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch !== 'main') {
    throw new Error(`Must deploy from 'main' branch (currently on '${branch}')`);
  }
  const dirty = capture('git', ['status', '--porcelain']).trim();
  if (dirty) {
    throw new Error(`Working tree is dirty. Commit or stash first:\n${dirty}`);
  }
  run('git', ['fetch', 'origin', 'gh-pages']);
}

function setupWorktree() {
  if (fs.existsSync(WORKTREE_PATH)) {
    console.log(`Removing stale worktree at ${WORKTREE_PATH}`);
    spawnSync('git', ['worktree', 'remove', '--force', WORKTREE_PATH], { stdio: 'inherit' });
    if (fs.existsSync(WORKTREE_PATH)) {
      fs.rmSync(WORKTREE_PATH, { recursive: true, force: true });
    }
  }
  run('git', ['worktree', 'add', '-B', 'gh-pages', WORKTREE_PATH, 'origin/gh-pages']);
}

function teardownWorktree() {
  if (fs.existsSync(WORKTREE_PATH)) {
    spawnSync('git', ['worktree', 'remove', '--force', WORKTREE_PATH], { stdio: 'inherit' });
  }
}

function sync() {
  const args = ['-a', '--delete', '--filter=:- .gitignore'];
  for (const e of EXCLUDES) args.push(`--exclude=${e}`);
  args.push(`${REPO_ROOT}/`, `${WORKTREE_PATH}/`);
  run('rsync', args);
}

function prompt(question) {
  if (!process.stdin.isTTY) {
    throw new Error('stdin is not a TTY; refusing to deploy non-interactively');
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function commitAndPush() {
  run('git', ['-C', WORKTREE_PATH, 'add', '-A']);
  const staged = spawnSync('git', ['-C', WORKTREE_PATH, 'diff', '--cached', '--quiet']);
  if (staged.status === 0) {
    console.log('No changes to deploy.');
    return;
  }
  console.log('\nChanges to deploy:');
  run('git', ['-C', WORKTREE_PATH, 'diff', '--cached', '--stat']);
  const answer = (await prompt('\nDeploy these changes? [y/N] ')).trim().toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted.');
    return;
  }
  const sha = capture('git', ['rev-parse', '--short', 'HEAD']).trim();
  run('git', ['-C', WORKTREE_PATH, 'commit', '-m', `Deploy from main @ ${sha}`]);
  run('git', ['-C', WORKTREE_PATH, 'push', 'origin', 'gh-pages']);
  console.log('\nDeployed.');
}

async function main() {
  process.on('SIGINT', () => { teardownWorktree(); process.exit(130); });
  try {
    preflight();
    setupWorktree();
    sync();
    await commitAndPush();
  } finally {
    teardownWorktree();
  }
}

main().catch((err) => {
  console.error(`\nDeploy failed: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Make it executable (optional, harmless)**

Run: `chmod +x scripts/deploy.js`

- [ ] **Step 3: Smoke-test preflight from a non-main branch**

Run:
```bash
git checkout -b deploy-test
npm run deploy
git checkout main
git branch -D deploy-test
```
Expected: Script aborts with `Must deploy from 'main' branch (currently on 'deploy-test')`. No worktree created.

- [ ] **Step 4: End-to-end no-op deploy**

With a clean `main` and no pending changes vs `gh-pages` (likely there ARE pending changes since this is the first run with the new script — that's fine, see Step 5).

Run: `npm run deploy`
Expected (if no changes): `No changes to deploy.` and worktree cleaned up.
Expected (if changes exist): prints diff stat, prompts `Deploy these changes? [y/N]`. Answer `n` → `Aborted.`, worktree cleaned up.

Verify cleanup: `ls ../deitte.com-gh-pages` should return "No such file or directory".

- [ ] **Step 5: End-to-end real deploy**

Make a trivial visible change on `main` (e.g., add a comment to `index.html`), commit it, then:

Run: `npm run deploy`
Answer `y` at the prompt.

Verify:
- `git log origin/gh-pages -1` shows the new `Deploy from main @ <sha>` commit
- Visit https://deitte.com after Pages rebuilds (usually <1 min) and confirm the change is live
- On `gh-pages`: `CLAUDE.md`, `README.md`, `scripts/`, `package.json`, `docs/` are absent; `CNAME`, `.nojekyll` are present
- `ls ../deitte.com-gh-pages` returns "No such file or directory"

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy.js
git commit -m "Add deploy script for gh-pages publishing"
```

---

## Task 3: Update CLAUDE.md deploy instructions

**Files:**
- Modify: `CLAUDE.md` — replace the "## Deploying" section

- [ ] **Step 1: Edit `CLAUDE.md` "## Deploying" section**

Replace the current "## Deploying" block with:

```markdown
## Deploying

Run `npm run deploy`. The script syncs `main`'s tree into a temporary `gh-pages`
worktree (excluding `CLAUDE.md`, `README.md`, `.gitignore`, `package.json`,
`scripts/`, `docs/`, `plan/`, and anything in `.gitignore`), shows a diff,
and pushes after you confirm.
```

Also update the "## After making changes" section to mention `npm run serve` instead of `npx serve .`:

```markdown
## After making changes

Commit the changes, then run `npm run serve` so they can be previewed locally.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md to reference npm run deploy/serve"
```

---

## Verification checklist (post-implementation)

- [ ] `npm run serve` serves the site locally
- [ ] `npm run deploy` from a non-main branch aborts cleanly
- [ ] `npm run deploy` with a dirty tree aborts cleanly
- [ ] `npm run deploy` with no changes prints "No changes to deploy."
- [ ] `npm run deploy` with changes shows diff stat, prompts, and on `n` aborts without committing
- [ ] `npm run deploy` with changes and `y` commits + pushes; site updates at deitte.com
- [ ] Worktree at `../deitte.com-gh-pages` is removed after every run (success, abort, or failure)
- [ ] `gh-pages` branch contains no `CLAUDE.md`, `README.md`, `scripts/`, `package.json`, `docs/`, or `plan/`, but does contain `CNAME` and `.nojekyll`
