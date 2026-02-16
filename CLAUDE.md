# CLAUDE.md - deitte.com rebuild

## Project

Rebuilding the deitte.com website. The project involves:
- Backing up existing site files from an AWS server to S3
- Light editing of the backed-up files
- Creating a new simple website that links to the old sites
- Deploying to GitHub and a Namecheap VPS

## Workflow Preferences

- **Always ask before committing.** Never auto-commit.
- Document all planning and decisions in the `plan/` directory
- Keep credentials and server connection details OUT of version-controlled files
- Store any sensitive connection info in `.env` or communicate it at runtime

## File Structure

```
plan/           # Project plans, checklists, and decision logs
```

## Tech Stack

- Static HTML/CSS/JS (to be confirmed during planning)
- AWS CLI for S3 operations
- SSH/SCP/rsync for server transfers
- GitHub for version control and hosting the repo
- Namecheap VPS for serving the site
