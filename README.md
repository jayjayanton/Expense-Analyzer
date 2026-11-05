# Expense Analyzer

A local Python/Flask app for American Express CSV statements. Interactive Plotly charts, editable expense categories, monthly totals, and scenario-based savings suggestions.

## Run

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 and upload your American Express CSV.

Expected columns: `Description` and `Amount` (or `Debit`/`Credit`); optional `Date`. Purchases are normally positive, refunds/payments negative. Toggle reverse signs for opposite conventions.

Uploaded statements are processed in memory, not persisted. Plotly loads from a CDN. Savings suggestions are illustrative, not financial advice. Do not deploy publicly without authentication and security review.

**Never commit financial statements or personal data.**
