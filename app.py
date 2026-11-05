from flask import Flask, render_template, request, jsonify, send_file
from collections import defaultdict
from zipfile import ZipFile, ZIP_DEFLATED
from pathlib import PurePath
import csv
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024

RULES = {
    'Education': ['p2p tomas moro', 'tomas moro', 'tomás moro', 'tuition', 'school fees', 'school tuition'],
    'Groceries': ['supermarket', 'grocery', 'whole foods', 'trader joe', 'kroger', 'safeway', 'gran aki', 'gran akí'],
    'Food Delivery': ['doordash', 'door dash', 'uber eats', 'ubereats', 'grubhub', 'postmates', 'rappi', 'pedidosya', 'pedidos ya', 'deliveroo', 'just eat', 'glovo'],
    'Dining': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'burger', 'pizza', 'plenisimo'],
    'Shopping': ['old navy', 'h&m', 'zara', 'etsy', 'fashion', 'shein'],
    'Travel': ['airlines', 'airways', 'flight', 'hotel', 'airbnb', 'booking.com', 'expedia'],
    'Gas': ['gas station', 'shell oil', 'chevron', 'exxon', 'mobil fuel', 'sunoco', 'bp fuel', 'petroecuador', 'primax', 'terpel', 'petrol station', 'fuel'],
    'Transportation': ['uber trip', 'lyft', 'taxi', 'parking', 'toll', 'metro', 'bus fare', 'train ticket'],
    'Subscriptions': ['netflix', 'spotify', 'youtube premium', 'google one', 'google storage', 'google drive', 'canva', 'adobe', 'icloud', 'dropbox', 'openai', 'chatgpt', 'prime membership', 'apple.com/bill'],
    'Health': ['clinic', 'hospital', 'pharmacy', 'doctor', 'dental', 'medical', 'clinica', 'clínica'],
    'Utilities': ['electric', 'water bill', 'internet', 'phone bill', 'verizon', 'comcast'],
    'Entertainment': ['cinema', 'movie', 'theater', 'concert', 'ticketmaster'],
}
PAYMENT_TERMS = ['payment received', 'online payment', 'autopay payment', 'thank you for your payment', 'payment - thank you']
REFUND_TERMS = ['refund', 'return credit', 'merchant credit', 'credit adjustment', 'reversal']

def normalize(s):
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

def parse_amount(value):
    s = str(value or '').strip().replace('$', '').replace(',', '').replace(' ', '')
    if not s:
        return None
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]
    try:
        return Decimal(s)
    except InvalidOperation:
        return None

def categorize(description):
    desc = description.lower()
    for category, keywords in RULES.items():
        if any(keyword in desc for keyword in keywords):
            return category
    return 'Other / Review'

def normalize_date(raw):
    raw = (raw or '').strip()
    for fmt in ('%m/%d/%Y', '%m/%d/%y', '%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return raw

def parse_csv(raw):
    text = raw.decode('utf-8-sig', errors='replace')
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError('The CSV is empty.')
    sample = '\n'.join(lines[:8])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ','
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ValueError('No CSV headers were found.')
    columns = {normalize(c): c for c in reader.fieldnames if c}
    def col(*names):
        return next((columns[normalize(n)] for n in names if normalize(n) in columns), None)
    date_col = col('Date', 'Transaction Date', 'Posted Date', 'Posting Date')
    desc_col = col('Description', 'Merchant', 'Payee', 'Details')
    amount_col = col('Amount', 'Transaction Amount')
    debit_col = col('Debit', 'Charges')
    credit_col = col('Credit', 'Payments')
    if not desc_col or not (amount_col or debit_col):
        raise ValueError('Expected Description and Amount (or Debit/Credit). Found: ' + ', '.join(reader.fieldnames))
    result = []
    for row in reader:
        desc = (row.get(desc_col) or '').strip()
        if not desc:
            continue
        if amount_col:
            amount = parse_amount(row.get(amount_col))
        else:
            amount = (parse_amount(row.get(debit_col)) or Decimal(0)) - (parse_amount(row.get(credit_col)) or Decimal(0))
        if amount is None or amount == 0:
            continue
        lowered = desc.lower()
        kind = ('Payment' if any(x in lowered for x in PAYMENT_TERMS)
                else 'Refund / Credit' if any(x in lowered for x in REFUND_TERMS)
                else 'Purchase' if amount > 0 else 'Credit / Review')
        result.append({
            'date': normalize_date(row.get(date_col)) if date_col else '',
            'description': desc,
            'amount': float(amount),
            'category': categorize(desc) if kind == 'Purchase' else 'Other / Review',
            'type': kind,
        })
    return result

@app.get('/')
def index():
    return render_template('index.html')

@app.post('/api/analyze')
def analyze():
    uploaded = request.files.get('file')
    if not uploaded or not uploaded.filename.lower().endswith('.csv'):
        return jsonify(error='Select a CSV statement.'), 400
    try:
        return jsonify(transactions=parse_csv(uploaded.read()))
    except Exception as exc:
        return jsonify(error=str(exc)), 400


@app.post('/api/export-categories')
def export_categories():
    """Download one ZIP with a separate CSV for every expense category."""
    rows = request.get_json(silent=True)
    if not isinstance(rows, list) or len(rows) > 100000:
        return jsonify(error='Expected a list of transactions (maximum 100,000).'), 400
    groups = defaultdict(list)
    for item in rows:
        if not isinstance(item, dict):
            return jsonify(error='Invalid transaction record.'), 400
        kind = str(item.get('type', 'Purchase'))
        category = str(item.get('category', 'Other / Review')) if kind == 'Purchase' else 'Non-purchase transactions'
        groups[category].append(item)
    output = io.BytesIO()
    used = set()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for category, records in sorted(groups.items()):
            name = re.sub(r'[^a-zA-Z0-9_-]+', '_', category).strip('_')[:70] or 'Other'
            filename = name + '.csv'
            suffix = 2
            while filename.lower() in used:
                filename = f'{name}_{suffix}.csv'
                suffix += 1
            used.add(filename.lower())
            buffer = io.StringIO()
            writer = csv.writer(buffer)
            writer.writerow(['Date', 'Description', 'Amount', 'Transaction Type', 'Category'])
            for item in records:
                writer.writerow([item.get('date', ''), item.get('description', ''),
                                 item.get('amount', ''), item.get('type', ''),
                                 item.get('category', '')])
            archive.writestr(filename, '\ufeff' + buffer.getvalue())
    output.seek(0)
    return send_file(output, mimetype='application/zip', as_attachment=True,
                     download_name='expense_categories.zip')

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
