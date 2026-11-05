let tx=[];
const cats=['Groceries','Dining','Shopping','Travel','Transport','Subscriptions','Health','Utilities','Entertainment','Other / Review'],rates={
  Dining:.25,Shopping:.20,Subscriptions:.25,Entertainment:.20,Travel:.10
}
;
const el=id=>document.getElementById(id),usd=n=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:'USD'
}
).format(n),safe=s=>String(s).replaceAll('&','&amp;
').replaceAll('<','&lt;
').replaceAll('>','&gt;
').replaceAll('"','&quot;
').replaceAll("'",'&#39;
');
el('upload').onclick=async()=>{
  let file=el('file').files[0];
el('error').textContent='';
if(!file){
  el('error').textContent='Select a CSV first';
return
}
let fd=new FormData();
fd.append('file',file);
try{
  let response=await fetch('/api/analyze',{
  method:'POST',body:fd
}
),data=await response.json();
if(!response.ok)throw Error(data.error);
tx=data.transactions;
el('dashboard').style.display='block';
el('filter').innerHTML='<option value="">All</option>'+cats.map(c=>'<option>'+safe(c)+'</option>').join('');
render()
}
catch(e){
  el('error').textContent=e.message
}

}
;
el('reverse').onchange=render;
el('filter').onchange=table;
el('search').oninput=table;
function expenses(){
  let sign=el('reverse').checked?-1:1;
return tx.map((t,i)=>({
  ...t,i,expense:t.amount*sign
}
)).filter(t=>t.expense>0)
}

function render(){
  let rows=expenses(),totals={
}
;
for(let t of rows)totals[t.category]=(totals[t.category]||0)+t.expense;
let entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
el('total').textContent=usd(rows.reduce((s,t)=>s+t.expense,0));
el('count').textContent=rows.length;
el('savings').textContent=usd(entries.reduce((s,[c,a])=>s+a*(rates[c]||0),0));
let layout={
  paper_bgcolor:'#151f31',plot_bgcolor:'#151f31',font:{
  color:'#d9e3f0'
}
,margin:{
  l:45,r:20,t:15,b:50
}

}
;
if(window.Plotly){
  Plotly.react('pie',[{
  type:'pie',labels:entries.map(e=>e[0]),values:entries.map(e=>e[1]),hole:.45
}
],{
  ...layout,showlegend:true,legend:{
  orientation:'h',y:-.1
}

}
,{
  responsive:true,displayModeBar:false
}
);
let months={
}
;
for(let t of rows){
  let month=t.date?t.date.slice(0,7):'Undated';
months[month]=(months[month]||0)+t.expense
}
let keys=Object.keys(months).sort();
Plotly.react('monthly',[{
  type:'bar',x:keys,y:keys.map(k=>months[k]),marker:{
  color:'#65b6ff'
}

}
],{
  ...layout,yaxis:{
  title:'USD',gridcolor:'#29374b'
}

}
,{
  responsive:true,displayModeBar:false
}
)
}
else{
  el('pie').textContent='Charts require internet access';
el('monthly').textContent='Charts require internet access'
}

let tips=entries.filter(([c])=>rates[c]).map(([c,a])=>({
  c,a,s:a*rates[c]
}
)).sort((a,b)=>b.s-a.s);
el('tips').innerHTML=tips.length?tips.map(x=>'<div class="tip"><b>'+safe(x.c)+'</b>: '+usd(x.a)+' spent. Reduce by '+Math.round(rates[x.c]*100)+'% to potentially save <b>'+usd(x.s)+'</b>.</div>').join(''):'No discretionary categories identified. Review uncategorized transactions.';
table()
}

function table(){
  let term=el('search').value.toLowerCase(),filter=el('filter').value;
el('tbody').innerHTML=expenses().filter(t=>(!filter||t.category===filter)&&t.description.toLowerCase().includes(term)).map(t=>'<tr><td>'+safe(t.date)+'</td><td>'+safe(t.description)+'</td><td>'+usd(t.expense)+'</td><td><select data-i="'+t.i+'">'+cats.map(c=>'<option '+(c===t.category?'selected':'')+'>'+safe(c)+'</option>').join('')+'</select></td></tr>').join('');
document.querySelectorAll('#tbody select').forEach(s=>s.onchange=()=>{
  tx[+s.dataset.i].category=s.value;
render()
}
)
}

el('export').onclick=()=>{
  let data=[['Date','Description','Amount','Category'],...tx.map(t=>[t.date,t.description,t.amount,t.category])];
let csv=data.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
let url=URL.createObjectURL(new Blob([csv],{
  type:'text/csv'
}
)),a=document.createElement('a');
a.href=url;
a.download='categorized_transactions.csv';
a.click();
URL.revokeObjectURL(url)
}
;
