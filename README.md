# Pharma Demo Area & Party Wise V12

This version fixes the browser "Page Unresponsive" problem during large Area Wise and Party Wise imports.

## What changed

- Product matching now uses indexed candidate lookup instead of comparing every imported row with every Stock & Sales row.
- Repeated product names are matched once and reused from an in-memory cache.
- Area Wise and Party Wise matching runs in small batches and yields control back to the browser between batches.
- Party Wise PDF processing updates progress page by page.
- Import buttons are disabled while processing to prevent duplicate imports.
- Re-importing the same filename and report date replaces the prior copy instead of continuously increasing browser storage.
- Large unmatched lists render only the first 200 rows in the Admin panel; all saved results can be downloaded as CSV.
- Existing V11 product-name matching behavior is preserved.

Replace `app.js`, refresh with Ctrl+F5, and import Sales, Stock & Return before Area Wise or Party Wise.
