# Pre-Planning Checklist

Before creating a detailed project plan, the following items need to be completed.

## Project Overview

Rebuild the deitte.com website. This involves:
- Backing up all existing HTML/JS/etc files from an AWS server to S3
- Light editing of the backed-up files
- Creating a fresh, simple new website that links to the old sites
- Uploading everything to GitHub (this repo) and serving via GitHub Pages with the custom domain managed through Namecheap
- Documenting all planning and activity in this repo's `plan/` directory

## 1. Initialize Git Repository

- [x] Run `git init` in this directory
- [x] Create a `.gitignore` file (include `.env`, credentials, `.DS_Store`, `node_modules/`, etc.)
- [x] Make an initial commit with the plan directory

## 2. Create CLAUDE.md

- [x] Create a `CLAUDE.md` at the repo root
- [x] Document project conventions (file structure, naming, etc.)
- [x] Document server details — kept out of repo per preference, will provide at runtime
- [x] Document any preferences for how work should be done in Claude Code

This file persists across Claude Code sessions and keeps context consistent.

## 3. Verify Required Tools Are Installed

Check that the following CLI tools are available on this machine:

- [x] `git` - version control (v2.50.1)
- [x] `aws` - AWS CLI (v2.33.22)
- [x] `ssh` / `scp` / `rsync` - all installed
- [x] `gh` - GitHub CLI (v2.86.0)

## 4. Confirm Access and Credentials

- [x] SSH access to the AWS server — key: `~/.ssh/id_rsa_ownaws`, host: `ubuntu@<aws-server-ip>`
- [x] AWS credentials configured (`aws configure`) for S3 bucket operations
- [x] S3 bucket: `deitte-backup-things` (already exists); will use `deitte-com/` prefix for site backup
- [x] Namecheap DNS access confirmed — will update when ready to cut over
- [x] GitHub account authenticated — logged in as `bdeitte`

## 5. Gather Information About the Existing Site

Before planning the migration, we need to understand what we're working with:

- [x] Inventory of files on the AWS server (directory structure, file types, total size)
- [x] Identify which parts of the existing site are "old sites" to be preserved vs. replaced
- [x] Note any server-side dependencies — Ghost blog (Node.js) is the main site; all other content is static
- [x] DNS confirmed — deitte.com currently points to `<aws-server-ip>` (AWS server); will need to update to GitHub Pages IPs when ready

### Server Inventory (AWS: ubuntu@<aws-server-ip>)

Web root: `/var/www/` served by nginx

| Path | Size | Notes |
|---|---|---|
| `ghost/content/data` | 232KB | Ghost SQLite DB (blog posts) — back up |
| `ghost/content/images` | 26MB | Ghost blog images — back up |
| `ghost/content/logs` | 2.2GB | Logs only — skip |
| `old_home/` | 18MB | Old homepage (Flash-era static files) — preserve |
| `petitemama/` | 7.6MB | Old parenting blog — preserve |
| `archives/` | 5.7MB | Old blog archives 2005–2011 — preserve |
| `travel/` | 384KB | Old travel blog — preserve |
| `helpingsiteignore/` | 1.3MB | Old blog — preserve |
| `IFrameDemo3/` | 1.1MB | Old Flash/IFrame demo — preserve |
| `deitte_resume.pdf` | 60KB | Resume — preserve |

**Total real content to back up: ~60MB**

Main site runs Ghost (Node.js) proxied to port 2368; nginx handles SSL via Let's Encrypt.
Static old-site subdirectories served directly by nginx.

## 6. Decide on the New Site Approach

- [x] Static HTML/CSS/JS — plain static, no framework/generator
- [x] New `index.html` links to: static Ghost blog, old homepage (`old_home/`), archives, travel, IFrame demo, resume — **not** petitemama or helpingsiteignore
- [x] Design: simple new page; reuse the computer image from the existing Ghost blog theme
- [x] Old content served as subdirectories on the same GitHub Pages site
- [x] `/petitemama/` and `/helpingsiteignore/` — back up to S3 only, do not include on new site

## 7. Ghost Blog — Static Export Strategy

- [x] Ghost version 3.35.x (self-hosted), running dynamically via Node.js — **no static HTML on disk**
- [x] Crawl live site (`https://deitte.com`) with `wget --mirror` while server is still up to produce static HTML


