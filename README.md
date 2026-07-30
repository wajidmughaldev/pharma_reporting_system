# Pharma Demo Area & Party Wise V11

This version changes company matching in both Area Wise and Party Wise imports.

A unique product-name match is accepted without comparing TP. Trailing report labels such as `TOTAL` are removed before matching. Strong unique name matches at 90% or above are also accepted without TP. TP is used only when a strong name match still points to more than one company, or when the name match is lower confidence / based on genuine extra form or pack differences.

After replacing `app.js`, refresh with Ctrl+F5 and re-import the reports.
