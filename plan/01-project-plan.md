# deitte.com Rebuild — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Progress Status (as of 2026-03-01)

- ✅ Phase 1.1 — Ghost content (DB + images) backed up to S3 `ghost-content/`
- ✅ Phase 1.2 — All static dirs (old_home, archives, travel, IFrameDemo3, petitemama, helpingsiteignore, resume) backed up to S3
- ✅ Phase 2.1 — wget crawl of deitte.com complete; output at `/tmp/deitte-crawl/deitte.com/`; also backed up to S3 `ghost-crawl/`
- ✅ Phase 3.1 — GitHub repo `bdeitte/deitte-com` created (public); remote `origin` added; `CNAME` file written
- ✅ Phase 4 — Static dirs + crawl output copied into repo; Ghost blog index saved at `blog/index.html`
- ✅ Phase 5.1/5.2 — `index.html` written with computer image and nav links
- ⏳ Phase 5.3 — **NOT YET DONE**: commit to main, create gh-pages branch, configure GitHub Pages
- ⏳ Phase 6 — DNS cutover not yet done

### Known fixes applied during crawl cleanup
- `blog/index.html`: added `<base href="/">` so relative asset paths resolve from root
- `blog/index.html` + all post pages: fixed wget `--adjust-extension` doubled extensions in srcset (`.jpgjpg` → `.jpg`, `.pngpng` → `.png`, etc.)
- `blog/index.html`: downloaded 5 Unsplash post images locally to `content/images/unsplash/` and replaced external URLs
- All post `index.html` files: re-copied from crawl after rsync bug excluded them (`--exclude="index.html"` matched all levels, not just root)

### Deviation from plan
- Blog link in `index.html` goes to `/blog/` (crawled Ghost root index copied there) rather than a specific post slug
- `blog/index.html` uses `<base href="/">` instead of path rewrites

**Goal:** Migrate deitte.com from a live Ghost/nginx AWS server to a fully static GitHub Pages site with a new index page linking to all preserved content.

**Architecture:** Crawl the live Ghost blog to produce static HTML, copy static subdirectories directly from the server, build a new `index.html` as the site root, and deploy the whole thing via GitHub Pages with a custom domain. The Ghost post URLs (`deitte.com/some-post/`) are preserved unchanged; only the root `index.html` is replaced with the new page.

**Tech Stack:** Plain HTML/CSS/JS, rsync/scp for file transfer, wget for Ghost crawl, AWS CLI for S3 backup, GitHub Pages for hosting, Namecheap for DNS.

---

## Reference

- **Server:** `ubuntu@<aws-server-ip>`, key: `~/.ssh/id_rsa_ownaws`
- **S3 bucket:** `deitte-backup-things`, prefix: `deitte-com/`
- **GitHub user:** `bdeitte`
- **Computer image (from Ghost):** `/var/www/ghost/content/images/2020/10/computer-3.png` (and variants)

### Final site structure

```
/                        ← new index.html (links to everything)
CNAME                    ← "deitte.com" for GitHub Pages
<post-slug>/index.html   ← static Ghost blog posts (from wget crawl)
assets/                  ← Ghost theme assets (from wget crawl)
content/images/          ← Ghost images (from wget crawl)
old_home/                ← old Flash-era homepage
archives/                ← old blog archives 2005–2011
travel/                  ← old travel blog
IFrameDemo3/             ← old Flash/IFrame demo
deitte_resume.pdf        ← resume
```

Not included on site (S3 backup only): `petitemama/`, `helpingsiteignore/`

---

## Phase 1: Back Up Everything to S3

### Task 1.1: Back up Ghost database and images

**Step 1: Copy Ghost content data to S3**

```bash
aws s3 sync \
  --exclude "*" \
  --include "data/*" \
  --include "images/*" \
  s3://deitte-backup-things/deitte-com/ghost-content/ \
  --dryrun  # remove --dryrun when ready to run for real
```

Wait — this needs to go server→local→S3 or server→S3 directly. Use rsync to local first, then S3 sync:

```bash
# Pull Ghost content from server
rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  --exclude "logs/" \
  ubuntu@<aws-server-ip>:/var/www/ghost/content/ \
  /tmp/deitte-backup/ghost-content/

# Push to S3
aws s3 sync /tmp/deitte-backup/ghost-content/ \
  s3://deitte-backup-things/deitte-com/ghost-content/
```

**Step 2: Verify S3 upload**

```bash
aws s3 ls s3://deitte-backup-things/deitte-com/ghost-content/ --recursive | head -20
```

Expected: See `data/` and `images/` directories listed.

### Task 1.2: Back up static subdirectories (all of them, including excluded ones)

**Step 1: Pull all static directories from server**

```bash
rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/old_home/ \
  /tmp/deitte-backup/old_home/

rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/petitemama/ \
  /tmp/deitte-backup/petitemama/

rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/archives/ \
  /tmp/deitte-backup/archives/

rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/travel/ \
  /tmp/deitte-backup/travel/

rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/helpingsiteignore/ \
  /tmp/deitte-backup/helpingsiteignore/

rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/IFrameDemo3/ \
  /tmp/deitte-backup/IFrameDemo3/

rsync -avz -e "ssh -i ~/.ssh/id_rsa_ownaws" \
  ubuntu@<aws-server-ip>:/var/www/deitte_resume.pdf \
  /tmp/deitte-backup/deitte_resume.pdf
```

**Step 2: Push all to S3**

```bash
aws s3 sync /tmp/deitte-backup/ \
  s3://deitte-backup-things/deitte-com/
```

**Step 3: Verify**

```bash
aws s3 ls s3://deitte-backup-things/deitte-com/ --recursive | \
  awk '{print $4}' | sed 's|/[^/]*$||' | sort -u
```

Expected: See all directory prefixes listed.

---

## Phase 2: Crawl Ghost Blog to Static HTML

### Task 2.1: Crawl the live site with wget

Ghost generates all pages dynamically. We capture them as static HTML while the server is still live.

**Step 1: Run wget mirror**

```bash
mkdir -p /tmp/deitte-crawl

wget \
  --mirror \
  --convert-links \
  --adjust-extension \
  --page-requisites \
  --no-parent \
  --directory-prefix=/tmp/deitte-crawl \
  --exclude-directories=/petitemama,/helpingsiteignore \
  https://deitte.com/
```

Flags explained:
- `--mirror`: recursive, timestamps, infinite depth
- `--convert-links`: rewrites links to work from local files
- `--adjust-extension`: adds `.html` where needed
- `--page-requisites`: grabs CSS, JS, images for each page
- `--exclude-directories`: skips directories not wanted on new site

This may take a few minutes. Expected output: lots of 200 OK responses for pages and assets.

**Step 2: Verify crawl output**

```bash
ls /tmp/deitte-crawl/deitte.com/
```

Expected: directories for each post slug, `assets/`, `content/`, `rss/`, etc.

**Step 3: Spot-check a post**

```bash
# Pick any post directory and open the HTML
ls /tmp/deitte-crawl/deitte.com/
# then:
open /tmp/deitte-crawl/deitte.com/<some-post-slug>/index.html
```

Verify the page looks correct (styled, images load).

**Step 4: Back up crawl output to S3**

```bash
aws s3 sync /tmp/deitte-crawl/deitte.com/ \
  s3://deitte-backup-things/deitte-com/ghost-crawl/
```

---

## Phase 3: Set Up GitHub Pages

### Task 3.1: Create the GitHub Pages repository

**Step 1: Check if remote repo exists**

```bash
gh repo view bdeitte/deitte-com 2>&1
```

If it doesn't exist yet:

```bash
gh repo create bdeitte/deitte-com --public --source=. --remote=origin --push
```

If it exists, just confirm the remote is set:

```bash
git remote -v
```

**Step 2: Enable GitHub Pages on the repo**

```bash
gh api repos/bdeitte/deitte-com/pages \
  --method POST \
  --field source[branch]=main \
  --field source[path]=/
```

If that fails (Pages already enabled or needs UI), go to:
`https://github.com/bdeitte/deitte-com/settings/pages`
and set Source → Deploy from branch → `main` → `/ (root)`.

**Step 3: Add the CNAME file**

```bash
echo "deitte.com" > /Users/briandeitte/deitte-com/CNAME
```

Commit later with the rest of the content (Phase 5).

---

## Phase 4: Assemble Site Content in Repo

### Task 4.1: Copy static subdirectories into repo

```bash
REPO=/Users/briandeitte/deitte-com

cp -r /tmp/deitte-backup/old_home/    $REPO/old_home/
cp -r /tmp/deitte-backup/archives/    $REPO/archives/
cp -r /tmp/deitte-backup/travel/      $REPO/travel/
cp -r /tmp/deitte-backup/IFrameDemo3/ $REPO/IFrameDemo3/
cp    /tmp/deitte-backup/deitte_resume.pdf $REPO/deitte_resume.pdf
```

Do NOT copy `petitemama/` or `helpingsiteignore/` into the repo.

### Task 4.2: Copy crawled Ghost content into repo

The crawled files live at `/tmp/deitte-crawl/deitte.com/`. Copy everything except the root `index.html` (which we'll replace with the new page):

```bash
REPO=/Users/briandeitte/deitte-com

# Copy everything from crawl except index.html at root
rsync -av \
  --exclude="index.html" \
  /tmp/deitte-crawl/deitte.com/ \
  $REPO/
```

**Verify key paths exist:**

```bash
ls $REPO/assets/     # Ghost CSS/JS
ls $REPO/content/    # Ghost images (including computer-3.png)
```

---

## Phase 5: Build the New index.html

### Task 5.1: Identify the computer image path

From the crawl, the computer image will be at:
`content/images/2020/10/computer-3.png`

Confirm:
```bash
ls /Users/briandeitte/deitte-com/content/images/2020/10/ | grep computer
```

Pick the best variant (likely `computer-3.png` — inspect them in Finder or a browser to choose).

### Task 5.2: Write index.html

Create `/Users/briandeitte/deitte-com/index.html`. The page should:
- Use the computer image prominently
- Have a simple, clean design (no framework needed — plain HTML/CSS)
- Include links to:
  - The Ghost blog posts (link to a notable post or an archive/index page from the crawl)
  - `old_home/` — old home
  - `archives/` — old blog archives
  - https://github.com/bdeitte - GitHub
  - https://www.linkedin.com/in/deitte/ - LinkedIn
  - https://nurseyournails.com/ - Betsy's business

Starting HTML (refine styling and fill in the blog link after the crawl):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>deitte.com</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Mono:wght@300;400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --cream: #F4EFE4;
      --ink:   #261E17;
      --rust:  #B5622A;
      --muted: #8A7A6E;
    }

    html, body { height: 100%; }

    body {
      background-color: var(--cream);
      color: var(--ink);
      font-family: 'IBM Plex Mono', monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }

    /* Subtle grain texture */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 1000;
      opacity: 0.4;
    }

    @keyframes fadein {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    main {
      text-align: center;
      max-width: 480px;
      animation: fadein 0.8s ease both;
    }

    .computer {
      width: min(260px, 80vw);
      height: auto;
      display: block;
      margin: 0 auto 2.5rem;
      animation: fadein 0.8s 0.1s ease both;
    }

    h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(2rem, 6vw, 3rem);
      font-weight: 400;
      letter-spacing: -0.01em;
      margin-bottom: 0.25rem;
      animation: fadein 0.8s 0.2s ease both;
    }

    .domain {
      font-size: 0.75rem;
      color: var(--muted);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 3rem;
      animation: fadein 0.8s 0.3s ease both;
    }

    nav ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      animation: fadein 0.8s 0.4s ease both;
    }

    nav a {
      color: var(--ink);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 300;
      letter-spacing: 0.04em;
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      transition: color 0.2s;
    }

    nav a::before {
      content: '—';
      color: var(--rust);
    }

    nav a:hover { color: var(--rust); }

    footer {
      margin-top: 3.5rem;
      font-size: 0.7rem;
      color: var(--muted);
      letter-spacing: 0.08em;
      animation: fadein 0.8s 0.5s ease both;
    }
  </style>
</head>
<body>
  <main>
    <img class="computer" src="content/images/2020/10/computer-3.png" alt="">
    <h1>Brian Deitte</h1>
    <p class="domain">deitte.com</p>
    <nav>
      <ul>
        <li><a href="/[ghost-archive-url]">Blog</a></li>
        <li><a href="/old_home/">Old Home</a></li>
        <li><a href="/archives/">Archives</a></li>
        <li><a href="https://github.com/bdeitte">GitHub</a></li>
        <li><a href="https://www.linkedin.com/in/deitte/">LinkedIn</a></li>
        <li><a href="https://nurseyournails.com/">Betsy's Nails</a></li>
      </ul>
    </nav>
    <footer>been here since 2001</footer>
  </main>
</body>
</html>
```

Note: replace `/[ghost-archive-url]` with the actual archive or tag page URL found during the crawl (Task 5.1). Verify the correct computer image variant in Task 5.1 as well.

**Step: Preview locally**

```bash
cd /Users/briandeitte/deitte-com
python3 -m http.server 8080
# Open http://localhost:8080 in browser
```

Verify the page looks correct and all links resolve.

### Task 5.3: Commit everything to main (including plans)

The `plan/` directory, `README.md`, and `CLAUDE.md` belong in the repo for reference, but should **not** appear on the public website. We handle this with a two-branch strategy: `main` holds everything; `gh-pages` holds only the website files. GitHub Pages serves from `gh-pages`, so the plans are never published.

**Step 1: Stage and commit all files to main**

```bash
cd /Users/briandeitte/deitte-com

# Website content
git add CNAME index.html old_home/ archives/ travel/ IFrameDemo3/ deitte_resume.pdf
git add assets/ content/    # Ghost crawl output

# Plans and project docs (tracked in main, not published)
git add CLAUDE.md plan/

git status                  # review before committing
```

Ask user to confirm before committing (per workflow preference — never auto-commit).

After confirmation:

```bash
git commit -m "Add static site content, new index page, and project plans"
git push origin main
```

**Step 2: Create and populate the gh-pages branch (website files only)**

```bash
# Create an orphan gh-pages branch (no history, clean slate)
git checkout --orphan gh-pages

# Remove everything from staging
git rm -rf .

# Check out only the website files from main
git checkout main -- \
  CNAME \
  index.html \
  old_home/ \
  archives/ \
  travel/ \
  IFrameDemo3/ \
  deitte_resume.pdf \
  assets/ \
  content/

git status    # should show only website files, no plan/ or CLAUDE.md

git commit -m "Deploy website to gh-pages"
git push origin gh-pages

# Return to main for ongoing work
git checkout main
```

**Step 3: Configure GitHub Pages to serve from gh-pages**

```bash
gh api repos/bdeitte/deitte-com/pages \
  --method POST \
  --field source[branch]=gh-pages \
  --field source[path]=/
```

Or in the GitHub UI: Settings → Pages → Branch → `gh-pages` → `/ (root)`.

**Step 4: Verify**

The site will be live at `https://bdeitte.github.io/deitte-com/` — confirm it loads and that `https://bdeitte.github.io/deitte-com/plan/` returns a 404.

When deploying future website changes, repeat Step 2's checkout commands (or switch to `gh-pages`, cherry-pick the changed files, commit, and push).

---

## Phase 6: DNS Cutover

### Task 6.1: Update Namecheap DNS

In the Namecheap dashboard for `deitte.com`, update DNS records:

**A records** — set all four GitHub Pages IPs:
```
@   A   185.199.108.153
@   A   185.199.109.153
@   A   185.199.110.153
@   A   185.199.111.153
```

**CNAME record** — for www:
```
www   CNAME   bdeitte.github.io.
```

Remove or replace any existing A record pointing to `<aws-server-ip>`.

### Task 6.2: Verify DNS propagation

```bash
# Check A record (may take a few minutes to propagate)
dig deitte.com A +short

# Should return the four GitHub Pages IPs:
# 185.199.108.153
# 185.199.109.153
# 185.199.110.153
# 185.199.111.153
```

### Task 6.3: Verify HTTPS and custom domain

GitHub Pages auto-provisions a Let's Encrypt certificate once DNS propagates (usually within minutes).

```bash
curl -I https://deitte.com
```

Expected: `HTTP/2 200` with GitHub Pages headers.

Spot-check key URLs:
- `https://deitte.com/` — new index page
- `https://deitte.com/<a-post-slug>/` — Ghost blog post
- `https://deitte.com/old_home/` — old homepage
- `https://deitte.com/deitte_resume.pdf` — resume download

---


## Open Questions / Decisions Deferred

- Which Ghost post (if any) should the "Blog" link on index.html point to? An archive page from the crawl, or a specific post?
- Final design/styling for index.html — to be decided when building Phase 5
- Which variant of the computer image to use (`computer-3.png`, `computer-3_o-2.png`, etc.)
