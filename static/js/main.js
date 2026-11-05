'use strict';

let transactions = [];
const selectedTransactions = new Set();
const categories = ['Education', 'Groceries', 'Dining', 'Food Delivery', 'Shopping', 'Travel', 'Gas', 'Transportation', 'Subscriptions', 'Health', 'Utilities', 'Entertainment', 'Other / Review'];
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
        selectedTransactions.clear();
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
        font: { color: '#d9e3f0' }, margin: { l: 85, r: 25, t: 20, b: 55 }, automargin: true
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
        }], { ...chartLayout, yaxis: { title: { text: 'USD', standoff: 22 }, automargin: true, gridcolor: '#29374b' } },
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

function filteredPurchases() {
    const search = $('search').value.toLowerCase();
    const filter = $('filter').value;
    return purchases().filter(row =>
        (!filter || row.category === filter) && row.description.toLowerCase().includes(search));
}

function updateSelectionControls(rows = filteredPurchases()) {
    const visibleIds = rows.map(row => row.index);
    const selectedVisible = visibleIds.filter(index => selectedTransactions.has(index)).length;
    $('selectAll').checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    $('selectAll').indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    $('selectedCount').textContent = selectedTransactions.size + ' selected';
    $('bulkApply').disabled = selectedTransactions.size === 0;
    $('clearSelection').disabled = selectedTransactions.size === 0;
}

function renderTable() {
    const rows = filteredPurchases();
    $('tbody').innerHTML = rows.map(row => '<tr><td><input type="checkbox" class="row-select" data-index="' +
        row.index + '"' + (selectedTransactions.has(row.index) ? ' checked' : '') +
        ' aria-label="Select transaction"></td><td>' + escapeHtml(row.date) +
        '</td><td>' + escapeHtml(row.description) +
        '</td><td>' + money(row.expense) +
        '</td><td><select class="category-select" data-index="' + row.index + '">' +
        categories.map(category => '<option value="' + escapeHtml(category) + '"' +
        (category === row.category ? ' selected' : '') + '>' +
        escapeHtml(category) + '</option>').join('') +
        '</select></td></tr>').join('');

    document.querySelectorAll('#tbody .row-select').forEach(box => {
        box.addEventListener('change', () => {
            const index = Number(box.dataset.index);
            if (box.checked) selectedTransactions.add(index);
            else selectedTransactions.delete(index);
            updateSelectionControls(rows);
        });
    });

    document.querySelectorAll('#tbody .category-select').forEach(select => {
        select.addEventListener('change', () => {
            const transaction = transactions[Number(select.dataset.index)];
            transaction.category = select.value;
            rememberMerchant(transaction);
            render();
        });
    });
    updateSelectionControls(rows);
}

function rememberMerchant(transaction) {
    try {
        const remembered = savedCategories();
        remembered[merchantKey(transaction.description)] = transaction.category;
        localStorage.setItem(preferenceKey, JSON.stringify(remembered));
    } catch { /* Storage unavailable; changes remain in current session. */ }
}

$('selectAll').addEventListener('change', event => {
    for (const row of filteredPurchases()) {
        if (event.target.checked) selectedTransactions.add(row.index);
        else selectedTransactions.delete(row.index);
    }
    renderTable();
});

$('clearSelection').addEventListener('click', () => {
    selectedTransactions.clear();
    renderTable();
});

$('bulkCategory').innerHTML = categories.map(category =>
    '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>').join('');

$('bulkApply').addEventListener('click', () => {
    if (!selectedTransactions.size) return;
    const category = $('bulkCategory').value;
    for (const index of selectedTransactions) {
        const transaction = transactions[index];
        if (transaction && transaction.type === 'Purchase') {
            transaction.category = category;
            rememberMerchant(transaction);
        }
    }
    selectedTransactions.clear();
    render();
});

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

$('exportCategories').addEventListener('click', async () => {
    if (!transactions.length) return;
    const button = $('exportCategories');
    button.disabled = true;
    $('error').textContent = '';
    try {
        const response = await fetch('/api/export-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactions)
        });
        if (!response.ok) throw new Error('Could not export category CSV files.');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = 'expense_categories.zip';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        $('error').textContent = error.message;
    } finally {
        button.disabled = false;
    }
});
