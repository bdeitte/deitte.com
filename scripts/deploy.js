#!/usr/bin/env node
const { spawnSync } = require('child_process');
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
