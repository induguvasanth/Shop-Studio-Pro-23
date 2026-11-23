# Shop Studio 23 — Consolidated Build

## Contents
- `index.html`, `shopstudio.bundle.js`, `shopstudio.bundle.css`, `sw.js`: GitHub Pages frontend.
- `Customer.html`, `Owner.html`, `OwnerConsole.html`, `Bridge.html`, `BACKEND-Code.gs`: customer/owner workflow and Apps Script.
- `shopstudio-config.js`, `shopstudio-customer-api.js`: customer API configuration/adapter; preserve when deploying.
- `windows-scanner-bridge/`: optional Windows scanner bridge, separate from browser frontend.
- `windows10-print-agent/`: optional Windows printing agent.

## Integration choices
- Current Shop Studio 23 frontend and feature set preserved; the earlier Shop Studio 16 QR portal was used only to restore direct owner/customer navigation.
- Local frontend JavaScript/CSS combined into ordered bundles to reduce network requests and redundant patch files. Script loading order was preserved.
- Owner console opens directly at the Google-authenticated Apps Script deployment URL; entering an owner deployment URL is required. Customer QR points to the customer upload page. Embedded owner console is optional.
- Existing scanner bridge, print agent and Apps Script were retained without modifying credentials or live deployments.

## Deployment
1. Back up existing repository and its deployed Apps Script configuration.
2. Replace the GitHub Pages frontend with files from this archive, keeping the original directory structure.
3. Configure `shopstudio-config.js` and the QR Orders owner/customer URLs as necessary.
4. Re-deploy `BACKEND-Code.gs` only if backend differs from your existing working deployment. Do not replace private configuration files.
5. Close old tabs and refresh, or unregister a stale service worker once if the old app is still cached.

## Test status
Validated structural references, syntax and basic UI navigation with automated checks. Real scanner, local printer, authenticated customer/owner Apps Script and all PDF/printing workflows require real-device/live tests. A build passing syntax validation is not an end-to-end functionality guarantee.
