# Pre-Planning Checklist

Before creating a detailed project plan, the following items need to be completed.

## Project Overview

Rebuild the deitte.com website. This involves:
- Backing up all existing HTML/JS/etc files from an AWS server to S3
- Light editing of the backed-up files
- Creating a fresh, simple new website that links to the old sites
- Uploading everything to GitHub (this repo) and a VPS on Namecheap
- Documenting all planning and activity in this repo's `plan/` directory

## 1. Initialize Git Repository

- [ ] Run `git init` in this directory
- [ ] Create a `.gitignore` file (include `.env`, credentials, `.DS_Store`, `node_modules/`, etc.)
- [ ] Make an initial commit with the plan directory

## 2. Create CLAUDE.md

- [ ] Create a `CLAUDE.md` at the repo root
- [ ] Document project conventions (file structure, naming, etc.)
- [ ] Document server details (AWS hostname, S3 bucket name, Namecheap VPS details)
- [ ] Document any preferences for how work should be done in Claude Code

This file persists across Claude Code sessions and keeps context consistent.

## 3. Verify Required Tools Are Installed

Check that the following CLI tools are available on this machine:

- [ ] `git` - version control
- [ ] `aws` - AWS CLI for S3 operations and potentially pulling files from EC2
- [ ] `ssh` / `scp` / `rsync` - for transferring files to/from servers
- [ ] `gh` - GitHub CLI for creating the repo on GitHub, managing PRs
- [ ] A text editor or static site tooling if needed (may just use plain HTML/CSS/JS)

## 4. Confirm Access and Credentials

- [ ] SSH access to the AWS server (key file location, hostname, username)
- [ ] AWS credentials configured (`aws configure`) for S3 bucket operations
- [ ] S3 bucket name decided or already created
- [ ] SSH access to the Namecheap VPS (key file, hostname, username)
- [ ] GitHub account authenticated (`gh auth login`)

## 5. Gather Information About the Existing Site

Before planning the migration, we need to understand what we're working with:

- [ ] Inventory of files on the AWS server (directory structure, file types, total size)
- [ ] Identify which parts of the existing site are "old sites" to be preserved vs. replaced
- [ ] Note any server-side dependencies (databases, server-side scripts, APIs, etc.)
- [ ] Check if there are any domain/DNS considerations (where deitte.com currently points)

## 6. Decide on the New Site Approach

These don't need final answers yet, but should be thought about before planning:

- [ ] Static HTML/CSS/JS, or use a minimal framework/generator?
- [ ] What does "links to the old sites" mean exactly? Subdirectories? Subdomains? Simple link page?
- [ ] Any design preferences or requirements for the new site?
- [ ] Will the old site files be served from the same VPS, or remain on S3/elsewhere?

---

## Status

**Current step:** Work through items 1-4, then discuss items 5-6 before creating the full project plan.
