# Shop Studio 23 — targeted fixes (23 November 2026)

## Source selection
- Base: Shop-Studio-23-Consolidated-Reviewed.zip (current consolidated project).
- QR reference: Shop-Studio-23-main(2).zip, specifically its embedded `Owner.html` QR Print Orders section. The owner/customer page links were added for easier access if iframe loading is blocked.
- The unrelated PTE mock test archive was not used.

## Changes
- Restored QR Print Orders embedded owner management layout from the supplied old Shop Studio project, with external owner/customer links. A deployed `Owner.html` file is required; owner sign-in and backend operation require actual Google Apps Script configuration.
- Added one unified crop interaction layer for Scan Document, Passport Photo and Photo & Signature. Select Crop, drag or resize, Apply Crop. Smart Card crop code was not modified.
- Added thumbnail previews to PDF Tools file inputs: Merge, Images to PDF, Split, Rotate, PDF to Image, Reorder, Advanced PDF Studio, PDF editor and editor image. PDF thumbnails use available PDF.js; images use the browser decoder.
- New sources: studio-interactions-fix.js and studio-interactions-fix.css. Updated index.html and sw.js.

## Important limitations
- JavaScript syntax/static file validation passed. Headless browser launch was blocked by the execution environment's network policy; real interactive crop, PDF render, and QR/Apps Script testing are not confirmed.
- The older QR embedded owner page previously returned a 404 on some GitHub Pages deployments; ensure Owner.html is published at the same location as index.html, or use Open Owner Portal. Google-authenticated Apps Script consoles may disallow iframe embedding.
- Keep private agent secrets out of the public repository; preserve your local print agent configuration.
