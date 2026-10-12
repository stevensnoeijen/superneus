# Superneus vs Potterpim

Comic-book 2D fighting game in the browser: Superneus vs Potterpim. Built with PixiJS +
Vite into one self-contained `index.html`. See `CLAUDE.md` for development notes.

## Privacy: error reporting

The deployed game reports crashes and JavaScript errors to [Sentry](https://sentry.io)
(EU region), so bugs on players' devices become visible. Only production builds report;
development and tests never do.

What a report contains: the error message and stack trace, the game version, browser and
OS, touch vs. desktop, the graphics renderer, screen pixel ratio / canvas size, and recent
game steps (page changes, match start, pause, K.O.).

What is **not** collected: no IP addresses or user info, no cookies, no headers or URL
query parameters, no session replay and no performance tracing. Ad-blockers may block
reporting; that is accepted.

### Setup (maintainers)

- DSN: committed in `src/monitoring/sentry.ts` (public by design); `VITE_SENTRY_DSN`
  overrides it at build time.
- Source maps: the build writes a hidden `dist/index.html.map` for the inlined script
  (`inlineSourceMap()` in `vite.config.js`). The deploy workflow uploads it with
  `getsentry/action-release` (release = the content-hash app version, `url_prefix`
  `app:///`) and deletes all `.map` files before publishing to GitHub Pages.
- GitHub: secret `SENTRY_AUTH_TOKEN`, variables `SENTRY_ORG` and `SENTRY_PROJECT`.
  Without the token, the upload step is skipped.
