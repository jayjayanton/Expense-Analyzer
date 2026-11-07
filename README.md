# Expense Analyzer

Static browser-based expense analyzer. No Python, Flask, server, API, or paid hosting required.

Open `index.html` or publish the root directory using GitHub Pages (main branch, /root).

Choose a CSV statement and enter the credit card name. All transactions are parsed in the browser; no statements are uploaded to a server. Exports are named `Card_YYYY-MM_categorized_transactions.csv` and `Card_YYYY-MM_expense_categories.zip`, or `Card_YYYY-MM_to_YYYY-MM_...` for multi-month statements. Category CSVs inside the ZIP have the same prefix.

Accepts Description and Amount (or Debit/Credit), with optional Date. Review transaction categories and sign conventions before relying on totals. Category preferences are stored in your browser's localStorage. Plotly and JSZip load from public CDNs and need an internet connection.

**Never commit actual statements or card numbers.** Enter a card nickname only.
