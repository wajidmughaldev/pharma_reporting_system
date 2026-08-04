# Tawakal Enterprises Reporting Demo - V27

V27 keeps the complete CPR reporting and certificate workflow and improves monthly file management inside the existing upload-status cards.

## CPR Reporting

- Upload the original text-based Computerized Payment Receipt (CPR-IT) PDF.
- Automatically detect CPR number, filing month/year, payment date, tax year, RTO/LTO, payment section, withholding-agent details, and taxpayer count.
- Extract every taxpayer row using the exact source columns:
  - Sr.
  - NTN / CNIC
  - Tax Office
  - Status
  - Taxpayer's/Business Name & Address
  - Payment Section / NAM Code
  - Amount against which tax is being withheld
  - Tax Amount
- Track all 12 Pakistani fiscal-year months from July through June as Uploaded, Deactivated, or Not Uploaded.
- Manage every uploaded month directly from its status card using compact icons for records preview, original PDF preview, download, activate/deactivate, and delete.
- The separate Extracted CPR Files list has been removed.
- Preview and filter records on the same Admin page.
- Preview/download the extracted CPR report as a portrait PDF.
- Preview/download the original uploaded PDF from browser IndexedDB.
- Activate, deactivate, replace, and delete monthly CPR files.

## CPR Certificate

- Select a fiscal year and taxpayer/business.
- Aggregate that taxpayer's monthly records from July through June.
- Generate the same certificate structure as the supplied certificate reference:
  - Tawakal Enterprises Channel-II letterhead
  - Pharmaceutical Distributors heading
  - Fiscal-year period
  - NTN/CNIC, taxpayer/business name, and address
  - CPR No., Tax Paid, Total Tax, and Month table
  - Final totals and stamp area
- Certificate PDF is portrait A4.

## Verification

The supplied June 2026 CPR sample was used to validate the extraction logic:

- 86 pages processed
- 1,232 serial numbers found
- 1,232 NTN/CNIC values extracted
- All 1,232 amount and tax values extracted
- Sample NTN 41408-6248354-9 produced Tax Paid 405 and Total Tax 80,968, matching the supplied certificate reference.


## V27 certificate update
- Removed the decorative stamp from the CPR certificate preview and PDF.
- Preview and downloaded PDF now use the same shared certificate table rows and totals.
- Certificate PDF remains A4 portrait.


V27 update: Download Certificate now captures the same certificate sheet used by Preview, preserving the exact letterhead, spacing, table, monthly rows, totals, and portrait layout. The stamp remains removed.


## V27 certificate download fix
- Fixed the false "Certificate data is not available" message when the preview was already available.
- The certificate PDF is now created directly from the exact preview sheet without requiring the external jsPDF library.
- A built-in image-to-PDF generator preserves the same A4 portrait layout even when CDN scripts are unavailable.

## V28 Group Report PDF
- Group Report Preview PDF and Download PDF now use a full table layout.
- SSR Summary is rendered as a table.
- Each item includes separate Area Wise and Party Wise detail tables.
- Output remains portrait (A3 portrait for readability).
