'use strict';

let transactions = [];
let sortState = {key:'date',direction:'desc'};
const reportSessionKey = 'expense-analyzer-session-v1';
const cardsStorageKey = 'expense-analyzer-cards-v2';
const activeCardKey = 'expense-analyzer-active-card-v2';
let activeCard = '';
let storageWarningShown = false;
function getCards(){
 try {const data=JSON.parse(localStorage.getItem(cardsStorageKey)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}
 catch {return {};}
}
function snapshot(){return {transactions,card:$('cardName').value,reverse:$('reverse').checked,filter:$('filter').value,search:$('search').value,sortState,selected:[...selectedTransactions]};}
function saveReport(){
 if(!activeCard||!transactions.length)return;
 try {
  const cards=getCards();cards[activeCard]=snapshot();
  localStorage.setItem(cardsStorageKey,JSON.stringify(cards));
  localStorage.setItem(activeCardKey,activeCard);
 }catch(e){
  if(!storageWarningShown){$('error').textContent='Browser storage is unavailable or full. Export a CSV backup; changes may not survive a refresh.';storageWarningShown=true;}
 }
}
function initializeFilter(){
 $('filter').innerHTML='<option value="">All</option>'+categories.map(category=>'<option value="'+escapeHtml(category)+'">'+escapeHtml(category)+'</option>').join('');
}
function refreshCardPicker(){
 const cards=getCards();
 $('savedCards').innerHTML='<option value="">Select saved card</option>';
 for(const key of Object.keys(cards).sort()){
  const option=document.createElement('option');option.value=key;option.textContent=key;$('savedCards').appendChild(option);
 }
 $('savedCards').value=activeCard&&cards[activeCard]?activeCard:'';
 $('removeCard').disabled=!activeCard||!cards[activeCard];
}
function showReport(saved){
 if(!saved||!Array.isArray(saved.transactions)||!saved.transactions.length)return false;
 transactions=saved.transactions;
 $('cardName').value=saved.card||activeCard;
 $('reverse').checked=!!saved.reverse;
 initializeFilter();
 $('filter').value=categories.includes(saved.filter)?saved.filter:'';
 $('search').value=saved.search||'';
 sortState={key:'date',direction:'desc'};
 if(['date','description','expense','category'].includes(saved.sortState?.key))sortState={key:saved.sortState.key,direction:saved.sortState.direction==='asc'?'asc':'desc'};
 selectedTransactions.clear();
 for(const index of saved.selected||[])if(Number.isInteger(index)&&index>=0&&index<transactions.length)selectedTransactions.add(index);
 $('dashboard').style.display='block';
 render();return true;
}
function restoreReport(){
 try {
  let cards=getCards();
  if(!Object.keys(cards).length){
   const legacy=JSON.parse(sessionStorage.getItem(reportSessionKey)||'null');
   if(legacy&&Array.isArray(legacy.transactions)&&legacy.transactions.length){
    const name=String(legacy.card||'Recovered card').trim();cards[name]=legacy;
    localStorage.setItem(cardsStorageKey,JSON.stringify(cards));
    localStorage.setItem(activeCardKey,name);
   }
  }
  const previous=localStorage.getItem(activeCardKey);
  activeCard=cards[previous]?previous:Object.keys(cards)[0]||'';
  refreshCardPicker();
  if(activeCard)showReport(cards[activeCard]);
 }catch(e){$('error').textContent='Could not restore saved cards. Browser storage may be disabled.';}
}
function resetToNewCard(){
 activeCard='';transactions=[];selectedTransactions.clear();
 $('dashboard').style.display='none';$('file').value='';$('cardName').value='';$('reverse').checked=false;
 $('search').value='';initializeFilter();sortState={key:'date',direction:'desc'};
 try{localStorage.removeItem(activeCardKey);}catch{}
 refreshCardPicker();
}
function exportPrefix(rows = transactions){
 const card=($('cardName').value.trim()||'Unknown_Card').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'Unknown_Card';
 const dates=rows.map(t=>t.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
 const range=dates.length?(dates[0]===dates[dates.length-1]?dates[0]:dates[0]+'_to_'+dates[dates.length-1]):'Undated';
 return card+'_'+range;
}
function exportLabel(){
 const category = $('filter').value;
 return (category || 'All_Transactions')
   .replace(/[^a-zA-Z0-9_-]+/g, '_')
   .replace(/^_+|_+$/g, '')
   .slice(0, 70) || 'All_Transactions';
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
    return transactions.map((transaction, index) => ({
        ...transaction, index, expense: Number(transaction.amount) * sign
    })).filter(transaction =>
        Number.isFinite(transaction.expense) && transaction.expense > 0 &&
        !['Payment', 'Refund / Credit'].includes(transaction.type)
    );
}

$('upload').addEventListener('click', async () => {
    const file = $('file').files[0];
    $('error').textContent = '';
    if (!file) { $('error').textContent = 'Select a CSV first.'; return; }

    try {
        const cardName=$('cardName').value.trim();
        if (!cardName) throw Error('Enter the credit card name to label your exports.');
        if (getCards()[cardName] && !window.confirm('Replace the saved report for '+cardName+'? This will overwrite its previous transactions.')) return;
        const payload = { transactions: await window.pythonAnalyzer.parseStatement(await file.text()) };

        const remembered = savedCategories();
        selectedTransactions.clear();
        transactions = payload.transactions.map(transaction => ({
            ...transaction,
            category: transaction.type === 'Purchase'
                ? (remembered[merchantKey(transaction.description)] || transaction.category)
                : transaction.category
        }));
        $('dashboard').style.display = 'block';
        initializeFilter();
        $('search').value='';
        sortState={key:'date',direction:'desc'};
        activeCard=cardName;
        render();
        saveReport();refreshCardPicker();
    } catch (error) {
        $('error').textContent = error.message;
    }
});

$('reverse').addEventListener('change', () => {render();saveReport();});
$('filter').addEventListener('change', () => {renderTable();saveReport();});
$('resetFilter').addEventListener('click', () => openCategory(''));
$('jumpToBottom').addEventListener('click',()=> $('transactionBottom').scrollIntoView({behavior:'smooth',block:'end'}));
$('backToTransactions').addEventListener('click',()=> $('transactionsHeading').scrollIntoView({behavior:'smooth',block:'start'}));
$('bottomExport').addEventListener('click',()=> $('export').click());
$('bottomExportCategories').addEventListener('click',()=> $('exportCategories').click());
function openCategory(category) {
 $('filter').value = category;
 $('search').value = '';
 renderTable();
 saveReport();
 $('transactionsHeading').scrollIntoView({behavior:'smooth',block:'start'});
}
$('search').addEventListener('input', () => {renderTable();saveReport();});
$('addCard').addEventListener('click',()=>{resetToNewCard();$('cardName').focus();$('error').textContent='Enter a new card name and upload its CSV statement.';});
$('savedCards').addEventListener('change',()=>{
 const name=$('savedCards').value;
 if(!name)return;
 saveReport();
 const cards=getCards();activeCard=name;
 try{localStorage.setItem(activeCardKey,name);}catch{}
 showReport(cards[name]);refreshCardPicker();$('error').textContent='';
});
$('removeCard').addEventListener('click',()=>{
 if(!activeCard)return;
 if(!window.confirm('Permanently remove saved expense card "'+activeCard+'" from this browser? Export a backup first if needed.'))return;
 const cards=getCards();delete cards[activeCard];
 try{localStorage.setItem(cardsStorageKey,JSON.stringify(cards));}catch(e){$('error').textContent='Could not remove card from browser storage.';return;}
 resetToNewCard();
 const next=Object.keys(cards)[0];
 if(next){activeCard=next;try{localStorage.setItem(activeCardKey,next);}catch{}showReport(cards[next]);refreshCardPicker();}
 $('error').textContent='Saved expense card removed.';
});
document.querySelectorAll('.sort-header').forEach(button=>button.addEventListener('click',()=>{
 const key=button.dataset.sort;
 sortState=sortState.key===key?{key,direction:sortState.direction==='asc'?'desc':'asc'}:{key,direction:key==='date'||key==='expense'?'desc':'asc'};
 renderTable();saveReport();
}));

function render() {
    const rows = purchases();
    const totals = {};
    for (const row of rows) totals[row.category] = (totals[row.category] || 0) + row.expense;
    const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    $('total').textContent = money(rows.reduce((sum, row) => sum + row.expense, 0));
    $('count').textContent = rows.length;
    $('savings').textContent = money(ordered.reduce((sum, [category, amount]) =>
        sum + amount * (reductionTargets[category] || 0), 0));

    $('categoryButtons').innerHTML = ordered.map(([category, amount]) => '<button type="button" class="category-button" data-category="' + escapeHtml(category) + '">' + escapeHtml(category) + ' · ' + money(amount) + '</button>').join('');
    document.querySelectorAll('.category-button').forEach(button => button.addEventListener('click', () => openCategory(button.dataset.category)));

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

        const pieElement = $('pie');
        if (typeof pieElement.removeAllListeners === 'function') pieElement.removeAllListeners('plotly_click');
        if (typeof pieElement.on === 'function') pieElement.on('plotly_click', event => {
            const category = event.points?.[0]?.label;
            if (category && categories.includes(category)) openCategory(category);
        });

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
    const rows=purchases().filter(row =>
        (!filter || row.category === filter) && row.description.toLowerCase().includes(search));
    const {key,direction}=sortState;
    rows.sort((a,b)=>{
      const cmp=key==='expense'?a.expense-b.expense:String(a[key]||'').localeCompare(String(b[key]||''),undefined,{numeric:true,sensitivity:'base'});
      return (direction==='asc'?cmp:-cmp)||a.index-b.index;
    });
    return rows;
}

function updateSelectionControls(rows = filteredPurchases()) {
    const visibleIds = rows.map(row => row.index);
    const selectedVisible = visibleIds.filter(index => selectedTransactions.has(index)).length;
    $('selectAll').checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    $('selectAll').indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    $('selectedCount').textContent = selectedTransactions.size ? selectedTransactions.size + ' selected' : 'Select transactions below to change their category';
    $('bulkCategoryLabel').hidden = selectedTransactions.size === 0;
    $('bulkApply').disabled = selectedTransactions.size === 0;
    $('bulkApply').hidden = selectedTransactions.size === 0;
    $('clearSelection').disabled = selectedTransactions.size === 0;
    $('clearSelection').hidden = selectedTransactions.size === 0;
}

function renderTable() {
    const rows = filteredPurchases();
    $('transactionsHeading').textContent = $('filter').value ? 'Transactions — ' + $('filter').value : 'Transactions';
    $('transactionCount').textContent = 'Total: ' + rows.length;
    const visibleSum = rows.reduce((sum,row)=>sum+Number(row.expense || 0),0);
    $('tableTotal').textContent = money(visibleSum);
    $('bottomTotal').textContent = money(visibleSum);
    $('bottomCount').textContent = 'Total: ' + rows.length;
    $('tableTotalLabel').textContent = 'Visible total ('+rows.length+')';
    document.querySelectorAll('.sort-header').forEach(button=>{
      const active=button.dataset.sort===sortState.key;
      button.querySelector('.sort-indicator').textContent=active?(sortState.direction==='asc'?'↑':'↓'):'↕';
      button.setAttribute('aria-sort',active?(sortState.direction==='asc'?'ascending':'descending'):'none');
    });
    $('resetFilter').disabled = !$('filter').value && !$('search').value;
    $('export').textContent = $('filter').value || $('search').value ? 'Export visible transactions' : 'Export all transactions';
    $('export').disabled = !rows.length && !!($('filter').value || $('search').value);
    $('bottomExport').textContent = $('export').textContent;
    $('bottomExport').disabled = $('export').disabled;
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
            saveReport();
        });
    });

    document.querySelectorAll('#tbody .category-select').forEach(select => {
        select.addEventListener('change', () => {
            const transaction = transactions[Number(select.dataset.index)];
            transaction.category = select.value;
            rememberMerchant(transaction);
            render();saveReport();
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
    renderTable();saveReport();
});

$('clearSelection').addEventListener('click', () => {
    selectedTransactions.clear();
    renderTable();saveReport();
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
    render();saveReport();
});


$('export').addEventListener('click',()=>{
 if(!transactions.length)return;
 const rows = ($('filter').value || $('search').value) ? filteredPurchases() : transactions;
 if(!rows.length){$('error').textContent='No transactions match the current filter.';return;}
 const records=[['Date','Description','Amount','Transaction Type','Category'],...rows.map(t=>[t.date,t.description,t.amount,t.type,t.category])];
 saveBlob(new Blob([toCsv(records)],{type:'text/csv;charset=utf-8'}),exportPrefix(rows)+'_'+exportLabel()+'.csv');
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

restoreReport();
