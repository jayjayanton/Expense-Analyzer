# Expense Analyzer — Python + JavaScript

A browser-based hybrid expense analyzer using **Python through Pyodide** for CSV parsing, date normalization, and categorization, plus **JavaScript** for UI, Plotly charts, bulk editing, and JSZip exports. No Flask server, API, or paid hosting is required.

## Deploy

Use GitHub Pages with the `main` branch and `/ (root)` folder. The entry point is `index.html`. Pyodide, Plotly, and JSZip load from CDNs; an internet connection is needed on initial load. Pyodide downloads a Python runtime, so first analysis may take several seconds, especially on phones. The Python source is fetched from the same GitHub Pages site.

## Architecture

- `python/analyzer.py`: actual Python expense parsing, category rules, Decimal amounts, date handling; exports JSON via `analyze_json`.
- `static/js/python-bridge.js`: initializes Pyodide and calls Python functions from JavaScript.
- `static/js/main.js`: dashboard, interactive charts, merchant preferences, category changes, exports.
- `index.html`: browser entry point.

Choose a CSV statement and enter a **card nickname** (never a full card number). All financial statement data stays in the browser; there are no uploads to a backend. Export filenames include card nickname and transaction month(s), e.g. `Amex_Gold_2026-10_categorized_transactions.csv` or `BFSFCU_2026-10_to_2026-11_expense_categories.zip`. Category CSVs inside the ZIP carry the same prefix.

CSV columns: Description and Amount (or Debit/Credit), with optional Date. Review signs and category classifications before relying on totals. Merchant preferences persist in browser localStorage. Never commit financial statements or card numbers.

The old `app.py` Flask implementation remains only as a legacy reference and is not used by GitHub Pages.
