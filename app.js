const DB_KEY='arbyPharmaPortal_v3';
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+Math.random().toString(16).slice(2);

const seedData={
  companies:[],
  users:[{id:'admin-1',name:'Super Admin',email:'admin@arby.local',password:'admin123',role:'admin',companyId:null,approved:true,active:true}],
  stock:[],
  imports:[],
  reportMeta:{distributor:'ARBY ENTERPRISES, HYDERABAD',from:'01/07/2025',to:'27/07/2026',printedOn:'27/07/2026'}
};
let db=loadDB(); let currentUser=null; let selectedReportId=null;
function loadDB(){
  try{
    const loaded=JSON.parse(localStorage.getItem(DB_KEY))||structuredClone(seedData);
    loaded.imports=loaded.imports||[]; loaded.stock=loaded.stock||[]; loaded.companies=loaded.companies||[]; loaded.users=loaded.users||[]; loaded.companies.forEach(c=>{if(typeof c.active!=='boolean')c.active=true;});
    // Migrate data created by older prototype versions into a dated report.
    if(loaded.stock.length && !loaded.imports.length){
      loaded.imports.push({id:uid(),filename:'Imported stock report',date:new Date().toISOString(),reportDate:toIsoDate(loaded.reportMeta?.printedOn)||new Date().toISOString().slice(0,10),meta:loaded.reportMeta||seedData.reportMeta,groups:0,rows:loaded.stock.length});
    }
    const fallback=loaded.imports[0];
    loaded.imports.forEach(i=>{i.id=i.id||uid();i.meta=i.meta||loaded.reportMeta||seedData.reportMeta;i.reportDate=i.reportDate||toIsoDate(i.meta?.printedOn)||String(i.date||'').slice(0,10);});
    if(fallback)loaded.stock.forEach(r=>{if(!r.importId)r.importId=fallback.id;});
    loaded.stock=loaded.stock.map(r=>({...r,item:cleanImportedItem(r.item)})).filter(r=>r.item&&!isPdfNoiseText(r.item));
    return loaded;
  }catch{return structuredClone(seedData)}
}
function toIsoDate(value){
  if(!value)return'';
  const m=String(value).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
}
function displayDate(value){
  const iso=toIsoDate(value)||String(value||'').slice(0,10);
  if(!iso)return'-'; const [y,m,d]=iso.split('-'); return d&&m&&y?`${d}/${m}/${y}`:value;
}
async function loadBundledStock(){
  if(db.stock.length)return;
  try{
    const payload=await fetch('stock-data.json').then(r=>{if(!r.ok)throw new Error('stock-data.json not found');return r.json()});
    const companyMap=new Map();
    const importId=uid();
    payload.records.forEach(r=>{
      const name=r.company.trim().toUpperCase();
      if(!companyMap.has(name)){const c={id:uid(),name,active:true};companyMap.set(name,c);db.companies.push(c)}
      db.stock.push({id:uid(),importId,companyId:companyMap.get(name).id,group:r.group,...r});
    });
    db.stock.forEach(r=>delete r.company);
    db.reportMeta=payload.meta||db.reportMeta;
    db.imports.push({id:importId,filename:'stock_return_sale.pdf',date:new Date().toISOString(),reportDate:toIsoDate(db.reportMeta.printedOn)||new Date().toISOString().slice(0,10),meta:{...db.reportMeta},groups:new Set(db.stock.map(r=>r.companyId+'|'+r.group)).size,rows:db.stock.length});
    saveDB();
  }catch(err){console.warn(err);}
}
function saveDB(){localStorage.setItem(DB_KEY,JSON.stringify(db));}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
function companyName(id){return db.companies.find(c=>c.id===id)?.name||'Unknown Company'}
function number(v){return Number(v||0)}
function money(v){return number(v).toLocaleString('en-US',{maximumFractionDigits:2})}

function cleanImportedItem(value){
  return String(value||'')
    .replace(/Software Company:\s*DevoTech[\s\S]*?(?=(?:facebook\.com\/DevoTechPK)?$)/ig,'')
    .replace(/Software Company:[\s\S]*$/ig,'')
    .replace(/Mobile#\s*\+?92\s*321\s*3019606[\s\S]*$/ig,'')
    .replace(/email:\s*devotechpk@gmail\.com[\s\S]*$/ig,'')
    .replace(/facebook\.com\/DevoTechPK/ig,'')
    .replace(/\s+/g,' ')
    .trim();
}
function isPdfNoiseText(value){
  const t=String(value||'').trim();
  return /^(Software Company:|Mobile#|email:|facebook\.com\/DevoTechPK)/i.test(t)
    || /Software Company:\s*DevoTech/i.test(t)
    || /devotechpk@gmail\.com/i.test(t);
}

function showView(name){$$('.view').forEach(v=>v.classList.remove('active-view'));$(`#view-${name}`).classList.add('active-view');$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='signup')renderCompanySelect();if(name==='admin')renderAdmin();if(name==='employee')renderEmployee();}
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));

$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const email=$('#loginEmail').value.trim().toLowerCase(),pass=$('#loginPassword').value;const user=db.users.find(u=>u.email.toLowerCase()===email&&u.password===pass);if(!user)return toast('Invalid email or password');if(!user.approved)return toast('Account is waiting for admin approval');if(!user.active)return toast('Account is deactivated');if(user.role==='employee'&&db.companies.find(c=>c.id===user.companyId)?.active===false)return toast('Company is deactivated');currentUser=user;$('#publicNav').classList.add('hidden');$('#privateNav').classList.remove('hidden');$('#loggedUserLabel').textContent=`${user.name} • ${user.role==='admin'?'Super Admin':companyName(user.companyId)}`;showView(user.role==='admin'?'admin':'employee');});
$('#logoutBtn').addEventListener('click',()=>{currentUser=null;$('#privateNav').classList.add('hidden');$('#publicNav').classList.remove('hidden');showView('login');toast('Logged out');});

function renderCompanySelect(){const s=$('#signupCompany');s.innerHTML='<option value="">Select company</option>'+db.companies.filter(c=>c.active!==false).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');}
$('#signupForm').addEventListener('submit',e=>{e.preventDefault();const email=$('#signupEmail').value.trim().toLowerCase();if(db.users.some(u=>u.email.toLowerCase()===email))return toast('Email already exists');db.users.push({id:uid(),name:$('#signupName').value.trim(),email,password:$('#signupPassword').value,role:'employee',companyId:$('#signupCompany').value,approved:false,active:false});saveDB();e.target.reset();toast('Account created. Waiting for Super Admin approval.');showView('login');});

$$('.tab').forEach(tab=>tab.addEventListener('click',()=>{$$('.tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');$$('.tab-panel').forEach(p=>p.classList.remove('active'));$('#'+tab.dataset.tab).classList.add('active');if(tab.dataset.tab==='admin-data')requestAnimationFrame(initTopScrollbars);}));

$('#companyForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#companyName').value.trim().toUpperCase();if(!name)return;if(db.companies.some(c=>c.name===name))return toast('Company already exists');db.companies.push({id:uid(),name,active:true});saveDB();e.target.reset();renderAdmin();toast('Company added');});

function renderAdmin(){
  const pending=db.users.filter(u=>u.role==='employee'&&!u.approved).length;
  $('#adminStats').innerHTML=[['Companies',db.companies.length],['Employees',db.users.filter(u=>u.role==='employee').length],['Pending',pending],['Stock Rows',db.stock.length]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#companyList').innerHTML=db.companies.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<div class="company-card ${c.active===false?'company-inactive':''}"><label class="company-check"><input type="checkbox" data-company-select="${c.id}"><span></span></label><div class="company-info"><div><strong>${c.name}</strong> <span class="badge ${c.active===false?'inactive':'active'}">${c.active===false?'Inactive':'Active'}</span></div><div class="muted">${db.stock.filter(r=>r.companyId===c.id).length} stock rows • ${db.users.filter(u=>u.companyId===c.id).length} employees</div></div><div class="row-actions"><button class="btn btn-outline" data-toggle-company="${c.id}">${c.active===false?'Activate':'Deactivate'}</button><button class="btn btn-danger" data-delete-company="${c.id}">Delete</button></div></div>`).join('')||'<p class="muted">No companies.</p>';
  $('#employeeList').innerHTML=db.users.filter(u=>u.role==='employee').map(u=>`<div class="employee-card"><div><strong>${u.name}</strong> <span class="badge ${!u.approved?'pending':u.active?'active':'inactive'}">${!u.approved?'Pending':u.active?'Active':'Inactive'}</span><div class="muted">${u.email} • ${companyName(u.companyId)}</div></div><div class="row-actions">${!u.approved?`<button class="btn btn-success" data-approve="${u.id}">Approve</button>`:''}<button class="btn btn-outline" data-toggle-user="${u.id}">${u.active?'Deactivate':'Activate'}</button><button class="btn btn-danger" data-delete-user="${u.id}">Delete</button></div></div>`).join('')||'<p class="muted">No employee accounts.</p>';
  $('#adminTableWrap').innerHTML=renderTable(db.stock,true); requestAnimationFrame(initTopScrollbars);
}

document.addEventListener('click',e=>{
  const id=e.target.dataset.deleteCompany;if(id){const c=db.companies.find(x=>x.id===id);if(c)openConfirm({title:'Delete company',message:`Delete ${c.name}? This will permanently remove its employees and all stock records.`,confirmText:'Delete company',danger:true,onConfirm:()=>deleteCompanies([id])});}
  const tc=e.target.dataset.toggleCompany;if(tc){const c=db.companies.find(x=>x.id===tc);if(c){c.active=c.active===false;db.users.filter(u=>u.companyId===tc).forEach(u=>{if(c.active===false)u.active=false;});saveDB();renderAdmin();renderCompanySelect();toast(c.active?'Company activated':'Company deactivated');}}
  const aid=e.target.dataset.approve;if(aid){const u=db.users.find(x=>x.id===aid);u.approved=true;u.active=true;saveDB();renderAdmin();toast('Employee approved');}
  const tid=e.target.dataset.toggleUser;if(tid){const u=db.users.find(x=>x.id===tid);u.active=!u.active;if(!u.approved)u.approved=true;saveDB();renderAdmin();toast(u.active?'Employee activated':'Employee deactivated');}
  const did=e.target.dataset.deleteUser;if(did){db.users=db.users.filter(u=>u.id!==did);saveDB();renderAdmin();}
});


function selectedCompanyIds(){return $$('[data-company-select]:checked').map(x=>x.dataset.companySelect);}
function deleteCompanies(ids){const set=new Set(ids);db.companies=db.companies.filter(c=>!set.has(c.id));db.users=db.users.filter(u=>!set.has(u.companyId));db.stock=db.stock.filter(r=>!set.has(r.companyId));saveDB();closeConfirm();renderAdmin();renderCompanySelect();toast(`${ids.length} compan${ids.length===1?'y':'ies'} deleted`);}
function openConfirm({title,message,confirmText='Confirm',danger=false,onConfirm}){const modal=$('#confirmModal');$('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;const btn=$('#confirmAction');btn.textContent=confirmText;btn.className=`btn ${danger?'btn-danger':'btn-primary'}`;btn.onclick=onConfirm;modal.classList.add('show');modal.setAttribute('aria-hidden','false');}
function closeConfirm(){const modal=$('#confirmModal');modal.classList.remove('show');modal.setAttribute('aria-hidden','true');}
$('#confirmCancel').addEventListener('click',closeConfirm);$('#confirmModal').addEventListener('click',e=>{if(e.target.id==='confirmModal')closeConfirm();});
$('#selectAllCompanies').addEventListener('change',e=>{$$('[data-company-select]').forEach(x=>x.checked=e.target.checked);});
$('#bulkDeactivateCompanies').addEventListener('click',()=>{const ids=selectedCompanyIds();if(!ids.length)return toast('Select at least one company');openConfirm({title:'Deactivate companies',message:`Deactivate ${ids.length} selected compan${ids.length===1?'y':'ies'}? Their employees will no longer be able to log in.`,confirmText:'Deactivate',onConfirm:()=>{const set=new Set(ids);db.companies.forEach(c=>{if(set.has(c.id))c.active=false;});db.users.forEach(u=>{if(set.has(u.companyId))u.active=false;});saveDB();closeConfirm();renderAdmin();renderCompanySelect();toast('Selected companies deactivated');}});});
$('#bulkDeleteCompanies').addEventListener('click',()=>{const ids=selectedCompanyIds();if(!ids.length)return toast('Select at least one company');openConfirm({title:'Delete companies',message:`Permanently delete ${ids.length} selected compan${ids.length===1?'y':'ies'} together with their employees and stock records? This cannot be undone.`,confirmText:'Delete selected',danger:true,onConfirm:()=>deleteCompanies(ids)});});

const cols=[['item','ITEM'],['rate','RATE'],['open','OPEN'],['received','RCVD'],['total','TOTAL'],['transferred','TRANSFERRED'],['lastMonth','LAST MONTH'],['saleQty','SALE QTY'],['saleBonus','SALE BONUS'],['returnQty','RETURN QTY'],['returnBonus','RETURN BONUS'],['netSaleQty','NET SALE QTY'],['netSaleBonus','NET SALE BONUS'],['netSaleAmount','NET SALE AMOUNT'],['closingQty','CLOSING QTY'],['closingAmount','CLOSING AMT']];
function tableHead(showCompany=false){
  const prefix=showCompany?'<th rowspan="3">COMPANY</th><th rowspan="3">GROUP</th>':'';
  return `<thead><tr>${prefix}<th rowspan="3" class="item-head">ITEM</th><th rowspan="3">RATE</th><th rowspan="3">OPEN</th><th rowspan="3">RCVD</th><th rowspan="3">TOTAL</th><th rowspan="3">TRANS<br>FERRED</th><th colspan="3">SALE</th><th colspan="2">RETURN</th><th colspan="3">NET SALE</th><th colspan="2">CLOSING</th></tr><tr><th rowspan="2">LAST<br>MONTH</th><th rowspan="2">QTY</th><th rowspan="2">BONUS</th><th rowspan="2">QTY</th><th rowspan="2">BONUS</th><th rowspan="2">QTY</th><th rowspan="2">BONUS</th><th rowspan="2">AMOUNT</th><th rowspan="2">QTY</th><th rowspan="2">AMT</th></tr><tr></tr></thead>`;
}
function renderTable(rows,showCompany=false){
  const cleanRows=rows.map(r=>({...r,item:cleanImportedItem(r.item)})).filter(r=>r.item&&!isPdfNoiseText(r.item));
  const totals=cleanRows.reduce((a,r)=>{cols.slice(1).forEach(([k])=>a[k]=(a[k]||0)+number(r[k]));return a},{});
  let body='';
  if(showCompany){
    for(let i=0;i<cleanRows.length;){
      const companyId=cleanRows[i].companyId;
      let j=i+1;
      while(j<cleanRows.length&&cleanRows[j].companyId===companyId)j++;
      for(let k=i;k<j;k++){
        const r=cleanRows[k];
        body+=`<tr>${k===i?`<td rowspan="${j-i}" class="merged-company-cell">${companyName(companyId)}</td>`:''}<td>${r.group||''}</td>${cols.map(([key])=>`<td class="${key==='item'?'item-cell':''}">${key==='item'?(r[key]??''):money(r[key])}</td>`).join('')}</tr>`;
      }
      i=j;
    }
  }else{
    body=cleanRows.map(r=>`<tr>${cols.map(([k])=>`<td class="${k==='item'?'item-cell':''}">${k==='item'?(r[k]??''):money(r[k])}</td>`).join('')}</tr>`).join('');
  }
  const totalPrefix=showCompany?'<td colspan="2">TOTAL</td>':'';
  return `<div class="table-scroll-shell"><div class="table-scroll-top"><div class="table-scroll-top-inner"></div></div><div class="table-wrap"><table class="data-table">${tableHead(showCompany)}<tbody>${body}<tr class="total-row">${totalPrefix}<td>TOTAL</td><td>—</td>${cols.slice(2).map(([k])=>`<td>${money(totals[k])}</td>`).join('')}</tr></tbody></table></div></div>`;
}

function renderGroupedReport(rows){
  if(!rows.length)return '<div class="empty-state">No stock records match the selected filters.</div>';
  const groups=[...new Set(rows.map(r=>r.group))].sort((a,b)=>a.localeCompare(b));
  return groups.map(group=>{const part=rows.filter(r=>r.group===group);return `<section class="group-report"><div class="group-title">Group: ${group} (${companyName(currentUser.companyId)})</div>${renderTable(part,false)}</section>`}).join('');
}

function employeeReports(){
  if(!currentUser)return[];
  const ids=new Set(db.stock.filter(r=>r.companyId===currentUser.companyId).map(r=>r.importId));
  return db.imports.filter(i=>ids.has(i.id)).sort((a,b)=>String(b.reportDate||b.date).localeCompare(String(a.reportDate||a.date))||String(b.date).localeCompare(String(a.date)));
}
function getSelectedReport(){return db.imports.find(i=>i.id===selectedReportId)||employeeReports()[0]||null;}
function getEmployeeRows(){
  if(!currentUser)return[];
  let rows=db.stock.filter(r=>r.companyId===currentUser.companyId&&(!selectedReportId||r.importId===selectedReportId));
  const q=$('#filterSearch').value.trim().toLowerCase(),g=$('#filterGroup').value,status=$('#filterStatus').value,minSale=Number($('#filterMinSale').value||-Infinity),minClosing=Number($('#filterMinClosing').value||-Infinity);
  rows=rows.filter(r=>(!q||r.item.toLowerCase().includes(q))&&(!g||r.group===g)&&number(r.netSaleQty)>=minSale&&number(r.closingQty)>=minClosing&&(!status||(status==='positive'&&number(r.closingQty)>0)||(status==='zero'&&number(r.closingQty)===0)||(status==='negative'&&number(r.closingQty)<0)));
  const sort=$('#filterSort').value;rows.sort((a,b)=>sort==='saleDesc'?b.netSaleQty-a.netSaleQty:sort==='closingDesc'?b.closingQty-a.closingQty:sort==='amountDesc'?b.netSaleAmount-a.netSaleAmount:a.item.localeCompare(b.item));return rows;
}
function renderReportCards(){
  const from=$('#reportDateFrom').value,to=$('#reportDateTo').value;
  const reports=employeeReports().filter(r=>(!from||r.reportDate>=from)&&(!to||r.reportDate<=to));
  $('#employeeReportCards').innerHTML=reports.map(r=>{
    const count=db.stock.filter(x=>x.importId===r.id&&x.companyId===currentUser.companyId).length;
    const meta=r.meta||{};
    return `<button class="report-card ${r.id===selectedReportId?'active':''}" data-report-id="${r.id}"><div class="report-date">${displayDate(r.reportDate||r.date)}</div><div class="report-range">${meta.from||'-'} to ${meta.to||'-'} • ${count} products</div><div class="report-file">${r.filename||'Stock report'}</div></button>`;
  }).join('')||'<div class="empty-state">No reports found for the selected dates.</div>';
}
function renderEmployee(){
  if(!currentUser)return;
  const reports=employeeReports();
  if(!selectedReportId||!reports.some(r=>r.id===selectedReportId))selectedReportId=reports[0]?.id||null;
  const company=companyName(currentUser.companyId);$('#employeeCompanyTitle').textContent=company;$('#reportCompanyBadge').textContent=company;
  renderReportCards(); refreshReportContext();
}
function refreshReportContext(){
  const report=getSelectedReport(),m=report?.meta||db.reportMeta||{};
  $('#reportMeta').textContent=`From: ${m.from||'-'} To ${m.to||'-'}    Institution Sales: No`;
  document.querySelector('.report-heading h3').textContent=m.distributor||'ARBY ENTERPRISES, HYDERABAD';
  const all=db.stock.filter(r=>r.companyId===currentUser.companyId&&(!selectedReportId||r.importId===selectedReportId));
  const old=$('#filterGroup').value;const groups=[...new Set(all.map(r=>r.group))].sort();$('#filterGroup').innerHTML='<option value="">All groups</option>'+groups.map(g=>`<option>${g}</option>`).join('');if(groups.includes(old))$('#filterGroup').value=old;
  updateEmployeeTable();
}
function updateEmployeeTable(){
  const rows=getEmployeeRows();const totals=rows.reduce((a,r)=>({sale:a.sale+number(r.netSaleQty),closing:a.closing+number(r.closingQty),amount:a.amount+number(r.netSaleAmount)}),{sale:0,closing:0,amount:0});
  $('#employeeStats').innerHTML=[['Products',rows.length],['Net Sale Qty',money(totals.sale)],['Closing Qty',money(totals.closing)],['Net Sale Amount',money(totals.amount)]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#employeeTableWrap').innerHTML=renderGroupedReport(rows);initTopScrollbars();
}
function initTopScrollbars(){
  $$('.table-scroll-shell').forEach(shell=>{const top=shell.querySelector('.table-scroll-top'),wrap=shell.querySelector('.table-wrap'),inner=shell.querySelector('.table-scroll-top-inner'),table=wrap?.querySelector('table');if(!top||!wrap||!inner||!table)return;inner.style.width=table.scrollWidth+'px';let lock=false;top.onscroll=()=>{if(lock)return;lock=true;wrap.scrollLeft=top.scrollLeft;lock=false};wrap.onscroll=()=>{if(lock)return;lock=true;top.scrollLeft=wrap.scrollLeft;lock=false};});
}
['filterSearch','filterGroup','filterStatus','filterMinSale','filterMinClosing','filterSort'].forEach(id=>$('#'+id).addEventListener('input',updateEmployeeTable));
$('#reportDateFrom').addEventListener('input',renderReportCards);$('#reportDateTo').addEventListener('input',renderReportCards);
$('#resetReportDates').addEventListener('click',()=>{$('#reportDateFrom').value='';$('#reportDateTo').value='';renderReportCards();});
document.addEventListener('click',e=>{const card=e.target.closest('[data-report-id]');if(card){selectedReportId=card.dataset.reportId;renderReportCards();refreshReportContext();window.scrollTo({top:document.querySelector('.filter-panel').offsetTop-75,behavior:'smooth'});}});
$('#resetFilters').addEventListener('click',()=>{['filterSearch','filterGroup','filterStatus','filterMinSale','filterMinClosing'].forEach(id=>$('#'+id).value='');$('#filterSort').value='item';updateEmployeeTable();});
$('#exportCsv').addEventListener('click',()=>{const rows=getEmployeeRows();const report=getSelectedReport();const headers=['Report Date','Company','Group',...cols.map(c=>c[1])];const data=rows.map(r=>[displayDate(report?.reportDate),companyName(r.companyId),r.group,...cols.map(([k])=>r[k])]);const csv=[headers,...data].map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');downloadBlob(csv,'text/csv',`${companyName(currentUser.companyId)}-${report?.reportDate||'stock'}.csv`);});
$('#exportPdf').addEventListener('click',()=>{
  const rows=getEmployeeRows();if(!rows.length)return toast('No records available to export');const report=getSelectedReport();const jsPDF=window.jspdf?.jsPDF;
  if(jsPDF&&typeof jsPDF==='function'){try{const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});doc.setFontSize(15);doc.text('SALES, STOCK & RETURN REPORT',40,35);doc.setFontSize(10);doc.text(`${companyName(currentUser.companyId)} • ${displayDate(report?.reportDate)}`,40,52);if(typeof doc.autoTable==='function'){doc.autoTable({startY:65,head:[['Group',...cols.map(c=>c[1])]],body:rows.map(r=>[r.group,...cols.map(([k])=>r[k])]),styles:{fontSize:5,cellPadding:2},headStyles:{fillColor:[31,95,153]},theme:'grid'});doc.save(`${companyName(currentUser.companyId)}-${report?.reportDate||'stock-report'}.pdf`);return;}}catch(err){console.warn('jsPDF export failed; using browser print fallback.',err);}}
  printEmployeeReport();
});
function printEmployeeReport(){const report=document.querySelector('#view-employee .report-panel');if(!report)return toast('Report is not available');const popup=window.open('','_blank','width=1400,height=900');if(!popup)return toast('Allow pop-ups to export the PDF');popup.document.write(`<!doctype html><html><head><title>${companyName(currentUser.companyId)} - Stock Report</title><style>*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:18px;color:#111}.panel{border:0;padding:0}.report-heading{display:flex;justify-content:space-between;border-bottom:1px solid #222;padding-bottom:10px;margin-bottom:14px}.official-report-title h3{font-size:20px;margin:0 0 3px}.official-report-title h4{font-size:18px;text-decoration:underline;margin:0 0 5px}.official-report-title p{font-size:12px;font-weight:700;margin:0}.group-title{text-align:center;font-size:15px;font-weight:700;margin:16px 0 6px}.table-scroll-top{display:none}.table-wrap{overflow:visible}.data-table{border-collapse:collapse;width:100%;font-size:8px}.data-table th,.data-table td{border:1px solid #777;padding:3px 2px;text-align:center;white-space:nowrap}.data-table th{background:#f3f3f3}.data-table .item-cell{text-align:left}.total-row{font-weight:700}@page{size:A4 landscape;margin:8mm}@media print{body{margin:0}}</style></head><body>${report.innerHTML}</body></html>`);popup.document.close();popup.focus();setTimeout(()=>popup.print(),300);}
function downloadBlob(content,type,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}

$('#extractPdfBtn').addEventListener('click',async()=>{
  const file=$('#pdfFile').files[0];if(!file)return toast('Select a PDF first');
  const progress=$('#importProgress');progress.textContent='Loading PDF engine...';
  try{
    const pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const bytes=new Uint8Array(await file.arrayBuffer());
    const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    const pages=[];
    for(let i=1;i<=pdf.numPages;i++){
      progress.textContent=`Reading page ${i} of ${pdf.numPages}...`;
      const page=await pdf.getPage(i);
      const viewport=page.getViewport({scale:1});
      const tc=await page.getTextContent();
      pages.push({pageNumber:i,height:viewport.height,items:tc.items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5],width:x.width||0}))});
    }
    progress.textContent='Converting table rows to JSON...';
    const summary=importPdfPages(pages,file.name);
    progress.textContent='Import complete.';
    $('#importSummary').innerHTML=`<div class="demo-box"><strong>${summary.companiesAdded}</strong> new companies detected<br><strong>${summary.rowsAdded}</strong> stock rows imported<br><strong>${summary.groupsDetected}</strong> groups detected</div>`;
    renderAdmin();toast('PDF processed successfully');
  }catch(err){console.error(err);progress.textContent='Import failed. Use a text-based PDF and open this project through localhost.';toast('Could not extract PDF');}
});

function pageLines(page){
  const words=page.items.filter(i=>String(i.str||'').trim()).map(i=>({...i,text:String(i.str).trim(),top:page.height-i.y})).sort((a,b)=>a.top-b.top||a.x-b.x);
  const lines=[];
  for(const w of words){
    let line=lines.findLast?.(l=>Math.abs(l.top-w.top)<=1.8);
    if(!line){line={top:w.top,words:[]};lines.push(line);}
    line.words.push(w);
  }
  lines.forEach(l=>{l.words.sort((a,b)=>a.x-b.x);l.text=l.words.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim();});
  return lines.sort((a,b)=>a.top-b.top);
}
function numericText(v){return /^-?\d[\d,]*(?:\.\d+)?$/.test(String(v||'').trim());}
function numValue(v){const n=Number(String(v||'').replaceAll(',',''));return Number.isFinite(n)?n:0;}
function firstNumber(words,minX,maxX){const w=words.find(w=>w.x>=minX&&w.x<maxX&&numericText(w.text));return w?numValue(w.text):0;}
function parseGroupLine(text){const m=String(text).match(/Group:\s*(.*?)\s*\((.*)\)\s*$/i);return m?{group:m[1].trim(),company:m[2].trim().toUpperCase()}:null;}
function extractRowsFromPage(page){
  const lines=pageLines(page),allText=lines.map(l=>l.text).join('\n');
  const groups=lines.map(l=>({top:l.top,...(parseGroupLine(l.text)||{})})).filter(g=>g.group&&g.company);
  const rows=[];
  for(let gi=0;gi<groups.length;gi++){
    const g=groups[gi],endTop=groups[gi+1]?.top??page.height;
    const sectionLines=lines.filter(l=>l.top>g.top+15&&l.top<endTop-1&&!isPdfNoiseText(l.text));
    const starts=sectionLines.filter(l=>{
      const hasRate=l.words.some(w=>w.x>=109&&w.x<137&&numericText(w.text));
      const item=l.words.filter(w=>w.x<109).map(w=>w.text).join(' ').trim();
      return hasRate&&item&& !/^(TOTAL|ITEM)$/i.test(item);
    });
    for(let ri=0;ri<starts.length;ri++){
      const st=starts[ri],nextTop=starts[ri+1]?.top??endTop;
      const band=sectionLines.filter(l=>l.top>=st.top-1&&l.top<nextTop-1);
      const words=band.flatMap(l=>l.words);
      const item=cleanImportedItem(band.filter(l=>!isPdfNoiseText(l.text)).flatMap(l=>l.words.filter(w=>w.x<109&&!isPdfNoiseText(w.text))).map(w=>w.text).join(' '));
      if(!item||/^(TOTAL|ITEM)$/i.test(item)||isPdfNoiseText(item))continue;
      const row={
        group:g.group,company:g.company,item,
        rate:firstNumber(words,109,137),open:firstNumber(words,137,164),received:firstNumber(words,164,190),total:firstNumber(words,190,217),
        transferred:firstNumber(words,217,245),lastMonth:firstNumber(words,245,296),saleQty:firstNumber(words,296,325),saleBonus:firstNumber(words,325,352),
        returnQty:firstNumber(words,352,379),returnBonus:firstNumber(words,379,406),netSaleQty:firstNumber(words,406,433),netSaleBonus:firstNumber(words,433,460),
        netSaleAmount:firstNumber(words,460,499),closingQty:firstNumber(words,499,527),closingAmount:firstNumber(words,527,570)
      };
      if(row.rate>0)rows.push(row);
    }
  }
  return {lines,allText,groups,rows};
}
function importPdfPages(pages,filename){
  const parsed=pages.map(extractRowsFromPage);
  const fullText=parsed.map(p=>p.allText).join('\n');
  const printed=(fullText.match(/Printed\s*On\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[])[1]||new Date().toLocaleDateString('en-GB');
  const range=fullText.match(/From\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\s*To\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[];
  const distributor=(fullText.match(/([A-Z][A-Z .,&'-]+(?:ENTERPRISES|DISTRIBUTORS?)[A-Z .,&'-]*)\s+SALES,\s*STOCK/i)||[])[1]?.trim()||'ARBY ENTERPRISES, HYDERABAD';
  const meta={distributor,from:range[1]||'-',to:range[2]||'-',printedOn:printed};
  const importId=uid(),reportDate=toIsoDate(printed)||toIsoDate(meta.to)||new Date().toISOString().slice(0,10);
  let companiesAdded=0;
  const companyMap=new Map(db.companies.map(c=>[c.name,c]));
  const rawRows=parsed.flatMap(p=>p.rows);
  const dedup=new Map();
  for(const r of rawRows){
    const key=[r.company,r.group,r.item,r.rate].join('|').toUpperCase();
    const score=Object.values(r).filter(v=>typeof v==='number'&&v!==0).length;
    const old=dedup.get(key);
    if(!old||score>old.score)dedup.set(key,{row:r,score});
  }
  let rowsAdded=0;
  for(const {row:r} of dedup.values()){
    let company=companyMap.get(r.company);
    if(!company){company={id:uid(),name:r.company,active:true};db.companies.push(company);companyMap.set(r.company,company);companiesAdded++;}
    db.stock.push({id:uid(),importId,companyId:company.id,group:r.group,item:r.item,rate:r.rate,open:r.open,received:r.received,total:r.total,transferred:r.transferred,lastMonth:r.lastMonth,saleQty:r.saleQty,saleBonus:r.saleBonus,returnQty:r.returnQty,returnBonus:r.returnBonus,netSaleQty:r.netSaleQty,netSaleBonus:r.netSaleBonus,netSaleAmount:r.netSaleAmount,closingQty:r.closingQty,closingAmount:r.closingAmount});
    rowsAdded++;
  }
  const groupsDetected=new Set(rawRows.map(r=>`${r.company}|${r.group}`)).size;
  db.reportMeta=meta;db.imports.push({id:importId,filename,date:new Date().toISOString(),reportDate,meta,groups:groupsDetected,rows:rowsAdded});saveDB();
  return{companiesAdded,rowsAdded,groupsDetected};
}

await loadBundledStock();renderCompanySelect();saveDB();showView('login');
