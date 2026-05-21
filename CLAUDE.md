# CLAUDE.md

## What this is

Brian Deitte's personal website, served as static files via GitHub Pages at deitte.com.
There is no build step, no package manager, and no test suite — files are HTML/CSS/JS served
as-is. `index.html` is a single self-contained homepage (inline `<style>`, no external CSS).

## Deployment model (important)

Two branches with different contents:

- **`main`** — the working repo. Includes `CLAUDE.md`, which is  NOT meant to be published.
- **`gh-pages`** — an orphan branch containing only the website files. This is what GitHub Pages
  serves. 

When publishing site changes, they must reach `gh-pages`, not just `main`. `CNAME` (`deitte.com`)
and `.nojekyll` must remain present on the served branch.

## Repository layout

- `index.html` — homepage (cream/ink design, inline styles, Google Analytics via gtag.js)
- `blog/index.html` — Old Ghost blog post listing; uses `<base href="/">` because assets are root-relative
- `<post-slug>/index.html` — individual crawled Ghost posts (e.g. `not-a-manager-readme/`)
- `assets/`, `content/images/` — Old Ghost theme CSS/JS and images (incl. `content/images/unsplash/`)
- `old_home/`, `archives/`, `archives.htm`, `travel/` — older blogs (2005–2011) and archives
- `IFrameDemo3/`, various `*.zip`/`*.swc`/`*.jar` — old Flex/Flash demo downloads, kept as-is

## Working with the crawled blog content

The `blog/` and post directories are a wget snapshot of a since-decommissioned Ghost server.
Known quirks already fixed but worth watching for if regenerating or editing crawled HTML:

- Assets are referenced root-relative, which is why `blog/index.html` needs `<base href="/">`.
- wget `--adjust-extension` produced doubled extensions (`.jpgjpg`, `.pngpng`, `.jpegpeg`) that
  had to be repaired in the HTML.

When changing site-wide things (e.g. analytics), the change must be applied across all the
separate HTML files, not just `index.html` — there is no shared header/template.

## Conventions

- Keep credentials and server connection details OUT of version-controlled files (`.gitignore`
  already excludes `.env*`, `*.pem`, `*.key`, `credentials.json`). Server IPs/keys are provided
  at runtime, never committed.

