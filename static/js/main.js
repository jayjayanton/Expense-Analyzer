'use strict';

let transactions = [];

const RULES = {
 Education:['p2p tomas moro','tomas moro','tomás moro','tuition','school fees','school tuition'],
 Groceries:['supermarket','grocery','whole foods','trader joe','kroger','safeway','gran aki','gran akí'],
 'Food Delivery':['doordash','door dash','uber eats','ubereats','grubhub','postmates','rappi','pedidosya','pedidos ya','deliveroo','just eat','glovo'],
 Dining:['restaurant','cafe','coffee','starbucks','mcdonald','burger','pizza','plenisimo'],
 Shopping:['old navy','h&m','zara','etsy','fashion','shein'],
 Travel:['airlines','airways','flight','hotel','airbnb','booking.com','expedia'],
 Gas:['gas station','shell oil','chevron','exxon','mobil fuel','sunoco','bp fuel','petroecuador','primax','terpel','petrol station','fuel'],
 Transportation:['uber trip','lyft','taxi','parking','toll','metro','bus fare','train ticket'],
 Subscriptions:['netflix','spotify','youtube premium','google one','google storage','google drive','canva','adobe','icloud','dropbox','openai','chatgpt','prime membership','apple.com/bill'],
 Health:['clinic','hospital','pharmacy','doctor','dental','medical','clinica','clínica'],
 Utilities:['electric','water bill','internet','phone bill','verizon','comcast'],
 Entertainment:['cinema','movie','theater','concert','ticketmaster']
};
const PAYMENT_TERMS=['payment received','online payment','autopay payment','thank you for your payment','payment - thank you'];
const REFUND_TERMS=['refund','return credit','merchant credit','credit adjustment','reversal'];
function csvRows(text) {
 const lines=[]; let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 const header=text.split(/\r?\n/).find(x=>x.trim())||'';
 const delimiters=[',',';','\t']; const count=d=>{let q=false,n=0;for(const ch of header){if(ch==='"')q=!q;else if(ch===d&&!q)n++;}return n;};
 const delimiter=delimiters.sort((a,b)=>count(b)-count(a))[0];
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===delimiter&&!quoted){row.push(cell);cell='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))lines.push(row);row=[];cell='';}
  else cell+=ch;
 }
 if(quoted)throw Error('CSV has an unclosed quoted field.');
 row.push(cell);if(row.some(v=>v.trim()))lines.push(row);
 return lines;
}
function normalizeHeader(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function parseAmount(v){
 let s=String(v||'').trim().replace(/[$,\s]/g,'');
 if(s.startsWith('(')&&s.endsWith(')'))s='-'+s.slice(1,-1);
 if(!s||!/^[+-]?\d*(?:\.\d+)?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function normalizeDate(v){
 const s=String(v||'').trim();
 let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
 if(m)return validDate(+m[1],+m[2],+m[3])?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):s;
 m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
 if(m){let y=+m[3];if(y<100)y+=y>=69?1900:2000;
  let month=+m[1],day=+m[2];if(month>12&&day<=12)[month,day]=[day,month];
  if(validDate(y,month,day))return [y,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
 }
 return s;
}
function validDate(y,m,d){const x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;}
function parseStatement(text){
 const lines=csvRows(text);if(lines.length<2)throw Error('The CSV is empty or has no transactions.');
 const headers=lines.shift().map(normalizeHeader);
 const col=(...names)=>names.map(normalizeHeader).map(n=>headers.indexOf(n)).find(i=>i>=0)??-1;
 const date=col('Date','Transaction Date','Posted Date','Posting Date'),desc=col('Description','Merchant','Payee','Details'),amount=col('Amount','Transaction Amount'),debit=col('Debit','Charges'),credit=col('Credit','Payments');
 if(desc<0||(amount<0&&debit<0))throw Error('Expected Description and Amount (or Debit/Credit). Found: '+headers.join(', '));
 const result=[];
 for(const cells of lines){const description=String(cells[desc]||'').trim();if(!description)continue;
  const value=amount>=0?parseAmount(cells[amount]):(parseAmount(cells[debit])||0)-(parseAmount(cells[credit])||0);
  if(value===null||value===0)continue;
  const lower=description.toLowerCase();
  const type=PAYMENT_TERMS.some(t=>lower.includes(t))?'Payment':REFUND_TERMS.some(t=>lower.includes(t))?'Refund / Credit':value>0?'Purchase':'Credit / Review';
  const category=type==='Purchase'?(Object.entries(RULES).find(([,words])=>words.some(w=>lower.includes(w)))||['Other / Review'])[0]:'Other / Review';
  result.push({date:date>=0?normalizeDate(cells[date]):'',description,amount:value,category,type});
 }
 if(!result.length)throw Error('No valid transactions were found.');
 return result;
}
function exportPrefix(){
 const card=($('cardName').value.trim()||'Unknown_Card').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'Unknown_Card';
 const dates=transactions.map(t=>t.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
 const range=dates.length?(dates[0].slice(0,7)===dates[dates.length-1].slice(0,7)?dates[0].slice(0,7):dates[0].slice(0,7)+'_to_'+dates[dates.length-1].slice(0,7)):'Undated';
 return card+'_'+range;
}
function toCsv(records){
 return '\uFEFF'+records.map(record=>record.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

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

    try {
        if (!$('cardName').value.trim()) throw Error('Enter the credit card name to label your exports.');
        const payload = { transactions: parseStatement(await file.text()) };

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


$('export').addEventListener('click',()=>{
 if(!transactions.length)return;
 const records=[['Date','Description','Amount','Transaction Type','Category'],...transactions.map(t=>[t.date,t.description,t.amount,t.type,t.category])];
 saveBlob(new Blob([toCsv(records)],{type:'text/csv;charset=utf-8'}),exportPrefix()+'_categorized_transactions.csv');
});
$('exportCategories').addEventListener('click',async()=>{
 if(!transactions.length)return;
 $('error').textContent='';
 if(!window.JSZip){$('error').textContent='ZIP library unavailable. Check your internet connection.';return;}
 const groups={};
 for(const t of transactions){const name=t.type==='Purchase'?t.category:'Non-purchase transactions';(groups[name]??=[]).push(t);}
 const zip=new JSZip(),prefix=exportPrefix();
 for(const [category,items] of Object.entries(groups)){
  const name=category.replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'Other';
  zip.file(prefix+'_'+name+'.csv',toCsv([['Date','Description','Amount','Transaction Type','Category'],...items.map(t=>[t.date,t.description,t.amount,t.type,t.category])]));
 }
 const blob=await zip.generateAsync({type:'blob'});
 saveBlob(blob,prefix+'_expense_categories.zip');
});
