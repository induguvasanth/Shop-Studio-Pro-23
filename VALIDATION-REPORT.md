# Shop Studio 23 — Integration and validation report

## Source strategy
- Base: `Shop-Studio-23-main.zip` (current project).
- Reference: `Shop-Studio-16-main(2).zip` (earlier original project).
- Targeted working QR portal reference: the earlier in-session `Shop-Studio-16-QR-Print-Orders-Restored.zip` because the current project still embedded `Owner.html`, causing the reported 404. No other old UI features were reintroduced.

## Important fixes
1. Restored direct QR owner/customer portal UI in place of the broken owner iframe entry. Owner authentication still requires an actual Google-authenticated Apps Script deployment.
2. Consolidated the 23 ordered frontend JavaScript source files into `shopstudio.bundle.js` and 8 stylesheets into `shopstudio.bundle.css`, retaining execution/style order. All functionality lives in those source bundles; do not add old scripts back to `index.html`.
3. Reinstated hidden, disabled compatibility DOM nodes needed by original code during startup (camera input, camera button, and scanner bridge button); they are **not** visible or operational UI options.
4. Simplified source tree and removed superseded patch notes. Kept Apps Script, customer/owner pages, scanner bridge and printer agent unchanged.
5. Restored missing runtime config load before app bundle, so QR settings can use deployment configuration.
6. Updated the service worker to use a new cache ID and network-first first-party asset loading.

## Automated checks actually run
- All top-level JavaScript passed `node --check` and Python printing agent passed syntax compilation.
- Internal script/style references validated; no missing local entrypoint references.
- Headless Chromium smoke test using an HTML-injection harness (normal network navigation blocked in this environment): all 10 sidebar sections navigated successfully, and no JavaScript page errors were reported.
- Simulated JPEG upload displayed on Passport Photo canvas (400×260 test image).
- Simulated JPEG upload displayed on Photo & Signature canvas.
- Smart Card image upload, Save Front, Save Back, Build Sheet succeeded: sheet canvas 2480×3508, no page errors.
- Passport Photo: Generate 8-Photo Sheet created the 1800×1200 sheet canvas.
- Scan Document: image upload succeeded; + Blank Page created a second document page with selection updated.

## Not verified / required real environment
- PDF import/export, OCR and edge detection require CDN libraries or OpenCV and should be checked online.
- QR codes require QRCode.js CDN access; direct customer link remains if CDN unavailable.
- Authenticated customer/owner flows need live Google Apps Script deployments, secrets and access controls.
- Local scanner, printer driver, print queue, Canon device, and Windows services cannot be tested here.
- UI validation is a representative smoke test, **not** proof that every control works end-to-end. Do not treat as production sign-off.

## Deployment
1. Back up the repository and Apps Script deployments. Replace frontend repository contents with the files in this ZIP (excluding optional Windows tool folders if you keep them installed separately).
2. Configure the correct customer and separately authenticated owner Apps Script deployments in the QR Orders settings. Do not put private print-agent secrets into public GitHub files.
3. Reload with Ctrl+Shift+R. If old assets persist, clear the old service worker/site data once and reload.
4. Test image uploads, PDF page import/export, Smart Card and Passport Photo sheets, QR sign-in, real printer output, and Windows scanner on your computer before production use.
