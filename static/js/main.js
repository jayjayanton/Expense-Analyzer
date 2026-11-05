'use strict';

let transactions = [];
const categories = ['Groceries', 'Dining', 'Food Delivery', 'Shopping', 'Travel', 'Gas', 'Transportation', 'Subscriptions', 'Health', 'Utilities', 'Entertainment', 'Other / Review'];
const reductionTargets = { Dining: 0.25, 'Food Delivery': 0.30, Shopping: 0.20, Subscriptions: 0.25, Entertainment: 0.20, Travel: 0.10 };
const $ = id => document.getElementById(id);
const money = amount => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const preferenceKey = 'expense-analyzer-merchants-v1';

function merchantKey(description) {
    return String(description).trim().toLowerCase().replace(/\s+/g, ' ');
}

function savedCategories() {
    try { return JSON.parse(localStorage.getItem(preferenceKey) || '{}'); }
    catch { return {}; }
}

function purchases() {
    const sign = $('reverse').checked ? -1 : 1;
    return transactions.map((transaction, index) => ({ ...transaction, index, expense: transaction.amount * sign }))
        .filter(transaction => transaction.type === 'Purchase' && transaction.expense > 0);
}

$('upload').addEventListener('click', async () => {
    const file = $('file').files[0];
    $('error').textContent = '';
    if (!file) { $('error').textContent = 'Select a CSV first.'; return; }

    const form = new FormData();
    form.append('file', file);
    try {
        const response = await fetch('/api/analyze', { method: 'POST', body: form });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not analyze statement.');

        const remembered = savedCategories();
        transactions = payload.transactions.map(transaction => ({
            ...transaction,
            category: transaction.type === 'Purchase'
                ? (remembered[merchantKey(transaction.description)] || transaction.category)
                : transaction.category
        }));
        $('dashboard').style.display = 'block';
        $('filter').innerHTML = '<option value="">All</option>' + categories.map(category =>
            '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>').join('');
        render();
    } catch (error) {
        $('error').textContent = error.message;
    }
});

$('reverse').addEventListener('change', render);
$('filter').addEventListener('change', renderTable);
$('search').addEventListener('input', renderTable);

function render() {
    const rows = purchases();
    const totals = {};
    for (const row of rows) totals[row.category] = (totals[row.category] || 0) + row.expense;
    const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    $('total').textContent = money(rows.reduce((sum, row) => sum + row.expense, 0));
    $('count').textContent = rows.length;
    $('savings').textContent = money(ordered.reduce((sum, [category, amount]) =>
        sum + amount * (reductionTargets[category] || 0), 0));

    const chartLayout = {
        paper_bgcolor: '#151f31', plot_bgcolor: '#151f31',
        font: { color: '#d9e3f0' }, margin: { l: 45, r: 20, t: 15, b: 50 }
    };
    if (window.Plotly) {
        Plotly.react('pie', [{
            type: 'pie', labels: ordered.map(item => item[0]),
            values: ordered.map(item => item[1]), hole: 0.45
        }], { ...chartLayout, showlegend: true, legend: { orientation: 'h', y: -0.1 } },
        { responsive: true, displayModeBar: false });

        const months = {};
        for (const row of rows) {
            const month = row.date ? row.date.slice(0, 7) : 'Undated';
            months[month] = (months[month] || 0) + row.expense;
        }
        const monthKeys = Object.keys(months).sort();
        Plotly.react('monthly', [{
            type: 'bar', x: monthKeys, y: monthKeys.map(key => months[key]),
            marker: { color: '#65b6ff' }
        }], { ...chartLayout, yaxis: { title: 'USD', gridcolor: '#29374b' } },
        { responsive: true, displayModeBar: false });
    } else {
        $('pie').textContent = 'Charts require access to the Plotly CDN.';
        $('monthly').textContent = 'Charts require access to the Plotly CDN.';
    }

    const suggestions = ordered.filter(([category]) => reductionTargets[category])
        .map(([category, amount]) => ({
            category, amount, savings: amount * reductionTargets[category]
        })).sort((a, b) => b.savings - a.savings);

    $('tips').innerHTML = suggestions.length
        ? suggestions.map(item => '<div class="tip"><b>' + escapeHtml(item.category) +
          '</b>: ' + money(item.amount) + ' spent. A ' +
          Math.round(reductionTargets[item.category] * 100) +
          '% reduction could save <b>' + money(item.savings) + '</b>.</div>').join('')
        : '<p>No discretionary spending suggestions yet. Review uncategorized purchases.</p>';

    const reviewCount = rows.filter(row => row.category === 'Other / Review').length;
    if (reviewCount) $('tips').insertAdjacentHTML('afterbegin',
        '<div class="tip"><b>' + reviewCount +
        ' purchases need category review.</b> Assign them below for more reliable recommendations.</div>');

    renderTable();
}

function renderTable() {
    const search = $('search').value.toLowerCase();
    const filter = $('filter').value;
    const rows = purchases().filter(row =>
        (!filter || row.category === filter) && row.description.toLowerCase().includes(search));

    $('tbody').innerHTML = rows.map(row => '<tr><td>' + escapeHtml(row.date) +
        '</td><td>' + escapeHtml(row.description) +
        '</td><td>' + money(row.expense) +
        '</td><td><select data-index="' + row.index + '">' +
        categories.map(category => '<option value="' + escapeHtml(category) + '"' +
        (category === row.category ? ' selected' : '') + '>' +
        escapeHtml(category) + '</option>').join('') +
        '</select></td></tr>').join('');

    document.querySelectorAll('#tbody select').forEach(select => {
        select.addEventListener('change', () => {
            const transaction = transactions[Number(select.dataset.index)];
            transaction.category = select.value;
            try {
                const remembered = savedCategories();
                remembered[merchantKey(transaction.description)] = select.value;
                localStorage.setItem(preferenceKey, JSON.stringify(remembered));
            } catch { /* Storage unavailable: category still applies to this session. */ }
            render();
        });
    });
}

$('export').addEventListener('click', () => {
    const records = [
        ['Date', 'Description', 'Amount', 'Transaction Type', 'Category'],
        ...transactions.map(row => [row.date, row.description, row.amount, row.type, row.category])
    ];
    const csv = records.map(record => record.map(value =>
        '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'categorized_transactions.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
