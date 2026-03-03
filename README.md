# deitte.com

Personal website for Brian Deitte, hosted on GitHub Pages at [deitte.com](https://deitte.com).

## What's here

- **`index.html`** — the current homepage
- **`blog/`** — static snapshot of a Ghost blog (2015–2020), crawled with wget before the server was decommissioned
- **`old_home/`** — older blog (2005–2011), covering Flex and other tech topics
- **`archives/`** — archive pages from the old blog
- **`assets/`, `content/`** — Ghost theme CSS/JS and images
- **`plan/`** — planning docs for the rebuild (not published to the site)
- And other odds and ends

## How it was built

The site was rebuilt with significant help from Claude Code, moving from a very-underused EC2 server to the current setup. The process involved backing up a live Ghost/nginx server to S3, crawling the blog to static HTML, assembling everything into this repo, and deploying via GitHub Pages. The `plan/` directory has the full details.
