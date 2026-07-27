# ARBY Pharma Localhost Prototype

## Included features
- Super Admin login
- Admin-created companies
- Employee signup with company dropdown
- Admin approval, activation and deactivation
- PDF upload and browser-side text extraction
- Automatic company detection from headings like `Group: NAME (COMPANY)`
- Automatic creation of missing companies
- Company-restricted employee stock dashboard
- Filters, totals, CSV export and PDF export
- LocalStorage-based persistence

## Run it
Because PDF.js uses browser modules, open the project through a local web server rather than double-clicking the HTML file.

### Option 1: Python
1. Open a terminal inside this folder.
2. Run:
   `python -m http.server 8080`
3. Open:
   `http://localhost:8080`

### Option 2: VS Code
Use the Live Server extension and open `index.html`.

## Demo Super Admin
- Email: `admin@arby.local`
- Password: `admin123`

## Test workflow
1. Login as Super Admin.
2. Open **Companies** and add a company if needed.
3. Logout and open **Employee Signup**.
4. Create an employee and select a company.
5. Login as Super Admin again.
6. Open **Employees**, approve the account and keep it active.
7. Open **PDF Import**, choose the stock PDF, and click **Extract & Import**.
8. Logout and login using the employee account.
9. Confirm that only the assigned company records are visible.
10. Test search, group filter, stock status, minimum quantities, sorting, CSV and PDF export.

## Important prototype note
The import logic uses text extraction and heuristics. It works best on text-based PDFs with consistent columns. A production version should use a backend parser, validation screen, duplicate detection, import logs and database transactions.

## Reset demo data
Open browser developer tools and remove the LocalStorage key:
`arbyPharmaPortal_v1`
Then refresh the page.

## Updated stock report

- The bundled `stock-data.json` contains the extracted data from all 65 pages of the supplied stock PDF.
- It currently includes 1,904 product rows, 39 detected companies, and 106 company/group combinations.
- Employee reports use the same grouped columns as the source PDF: Sale, Return, Net Sale, and Closing.
- The table font and row spacing have been increased for easier reading.

Important: run through localhost so `stock-data.json` can load correctly. If you tested an older build, this update uses a new LocalStorage database version automatically.


## PDF export
The app uses jsPDF when available. If the CDN is unavailable, the Download PDF button opens the browser print dialog; choose **Save as PDF**. This prevents the `window.jspdf is undefined` error when working offline.

## Version 5 updates

- Every PDF upload is stored as a separate dated report instead of replacing or mixing with previous uploads.
- Employees see report cards for their assigned company, with the latest report first.
- Clicking a report card opens only that report's stock data.
- Added From date and To date filters for the report cards.
- Added a synchronized horizontal scrollbar above every stock table, while retaining the normal bottom scrollbar.
- Older LocalStorage data is migrated automatically into one dated report.

For a completely clean test, use the Admin reset option or clear the browser LocalStorage key `arbyPharmaPortal_v2` once.

## Version 6 changes
- Companies can be activated, deactivated, or permanently deleted.
- Bulk select, bulk deactivate, and bulk delete are available in Company Management.
- Destructive actions use an in-app confirmation dialog.
- Deleting a company also removes its linked employee accounts and stock rows.
- The Admin Stock Data table has a synchronized horizontal scrollbar directly below the “All stock records” heading.


## Version 7 PDF import fix

- The bundled stock-data.json is intentionally empty.
- PDF import now reads text positions and table columns instead of joining the entire page into one text line.
- Each product row is converted into structured JSON and saved in LocalStorage.
- Wrapped product names and repeated values across page breaks are handled.
- Duplicate continuation rows are removed.
- This version uses a new LocalStorage key so incorrectly parsed data from an older version does not reappear.

Test with `NEW REPORT.pdf` through localhost. Internet access is required while importing because PDF.js is loaded from CDN.
