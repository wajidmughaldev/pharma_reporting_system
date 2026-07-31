# Tawakal Enterprises Reporting Demo - V21

This build continues V20 and changes PDF Preview / Download to follow the dashboard report layout instead of the imported/source-file visual layout.

## PDF output format

- Stock: same dashboard grouping, multi-row stock table header, rows and totals.
- Area Wise: same dashboard matrix with ITEM, visible non-empty area columns, TTL QTY, TTL AMT and G TTL AMT.
- Party Wise: same dashboard Invoice/Return/Party info row, item rows, invoice totals and Grand Total.
- PDF report headings follow the dashboard report heading and company badge information.
- All PDFs are portrait.
- Stock uses portrait A3 because of the large number of columns.
- Area Wise uses portrait A4 or A3 based on the number of visible area columns.
- Party Wise uses portrait A4.

No re-import of existing reports is required.
