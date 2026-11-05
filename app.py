from flask import Flask, render_template, request, jsonify
import pandas as pd
import io
import re

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
RULES = {
    'Groceries': ['supermarket', 'grocery', 'whole foods', 'trader joe', 'walmart grocery', 'costco', 'kroger', 'safeway', 'gran aki', 'gran akí'],
    'Dining': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'burger', 'pizza', 'doordash', 'ubereats', 'uber eats', 'grubhub', 'plenisimo'],
    'Shopping': ['amazon', 'old navy', 'h&m', 'zara', 'etsy', 'target', 'fashion', 'mercado libre', 'shein'],
    'Travel': ['airlines', 'airways', 'flight', 'hotel', 'airbnb', 'booking.com', 'expedia', 'delta air', 'american air'],
    'Transport': ['uber trip', 'lyft', 'gas station', 'shell oil', 'chevron', 'exxon', 'parking', 'toll'],
    'Subscriptions': ['netflix', 'spotify', 'youtube premium', 'google one', 'google storage', 'canva', 'adobe', 'icloud', 'dropbox', 'openai'],
    'Health': ['clinic', 'hospital', 'pharmacy', 'doctor', 'dental', 'medical', 'clinica', 'clínica'],
    'Utilities': ['electric', 'water bill', 'internet', 'phone bill', 'verizon', 'at&t', 'comcast'],
    'Entertainment': ['cinema', 'movie', 'theater', 'concert', 'ticketmaster', 'steam games'],
}

def normalize(s):
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

def category_for(desc):
    s = str(desc).lower()
    for category, keywords in RULES.items():
        if any(term in s for term in keywords):
            return category
    return 'Other / Review'

def parse_csv(raw):
    text = raw.decode('utf-8-sig', errors='replace')
    df = pd.read_csv(io.StringIO(text), sep=None, engine='python', dtype=str, on_bad_lines='skip')
    df.columns = [str(x).strip() for x in df.columns]
    cols = {normalize(c): c for c in df.columns}
    def choose(names):
        for name in names:
            if normalize(name) in cols:
                return cols[normalize(name)]
        return None
    date = choose(['Date', 'Transaction Date', 'Posted Date', 'Posting Date'])
    desc = choose(['Description', 'Merchant', 'Payee', 'Details', 'Name'])
    amount = choose(['Amount', 'Transaction Amount', 'Charge Amount'])
    debit = choose(['Debit', 'Charges'])
    credit = choose(['Credit', 'Payments'])
    if not desc or not (amount or debit):
        raise ValueError('Missing required Description and Amount (or Debit/Credit) columns. Found: ' + ', '.join(df.columns))
    def money(series):
        s = series.fillna('').astype(str).str.replace(r'[$,\s]', '', regex=True).str.replace(r'^\((.*)\)$', r'-\1', regex=True)
        return pd.to_numeric(s, errors='coerce').fillna(0)
    values = money(df[amount]) if amount else money(df[debit]) - (money(df[credit]) if credit else 0)
    descriptions = df[desc].fillna('').astype(str).str.strip()
    dates = pd.to_datetime(df[date], errors='coerce') if date else pd.Series(pd.NaT, index=df.index)
    return [
        {'date': d.strftime('%Y-%m-%d') if pd.notna(d) else '', 'description': name, 'amount': round(float(value), 2), 'category': category_for(name)}
        for d, name, value in zip(dates, descriptions, values) if name and value != 0
    ]

@app.route('/')
def index():
    return render_template('index.html')

@app.post('/api/analyze')
def analyze():
    file = request.files.get('file')
    if not file or not file.filename.lower().endswith('.csv'):
        return jsonify(error='Please upload a .csv statement.'), 400
    try:
        return jsonify(transactions=parse_csv(file.read()))
    except Exception as exc:
        return jsonify(error=str(exc)), 400

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
