const DB_KEY='arbyPharmaPortal_v3';
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+Math.random().toString(16).slice(2);

const seedData={
  companies:[],
  users:[{id:'admin-1',name:'Super Admin',email:'admin@arby.local',password:'admin123',role:'admin',companyId:null,approved:true,active:true}],
  stock:[],
  imports:[],
  areaWiseRows:[],
  areaWiseImports:[],
  partyWiseRows:[],
  partyWiseImports:[],
  reportMeta:{distributor:'ARBY ENTERPRISES, HYDERABAD',from:'01/07/2025',to:'27/07/2026',printedOn:'27/07/2026'}
};
let db=await loadDB(); let currentUser=null; let selectedReportId=null; let selectedAreaReportId=null; let selectedPartyReportId=null; let employeeReportMode='stock';
async function loadDB(){
  try{
    let raw=localStorage.getItem(DB_KEY);
    if(raw?.startsWith('gz:'))raw=await decompressStoredText(raw.slice(3));
    const loaded=JSON.parse(raw)||structuredClone(seedData);
    loaded.imports=loaded.imports||[]; loaded.stock=loaded.stock||[]; loaded.areaWiseImports=loaded.areaWiseImports||[]; loaded.areaWiseRows=loaded.areaWiseRows||[]; loaded.partyWiseImports=loaded.partyWiseImports||[]; loaded.partyWiseRows=loaded.partyWiseRows||[]; loaded.companies=loaded.companies||[]; loaded.users=loaded.users||[]; loaded.companies.forEach(c=>{if(typeof c.active!=='boolean')c.active=true;});
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
let saveRevision=0;
function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary);}
function base64ToBytes(value){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
async function compressStoredText(text){if(!('CompressionStream' in window))return null;const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));}
async function decompressStoredText(value){if(!('DecompressionStream' in window))throw new Error('Compressed demo data is not supported in this browser');const stream=new Blob([base64ToBytes(value)]).stream().pipeThrough(new DecompressionStream('gzip'));return new Response(stream).text();}
async function saveDB(){
  const revision=++saveRevision;const json=JSON.stringify(db);let payload=json;
  try{const compressed=await compressStoredText(json);if(compressed)payload='gz:'+compressed;}catch(err){console.warn('Compression unavailable; saving plain demo data.',err);}
  if(revision!==saveRevision)return;
  try{localStorage.setItem(DB_KEY,payload);}catch(err){console.error(err);toast('Browser storage is full. Remove an older demo import and try again.');}
}
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

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function normalizeProductName(value){
  return String(value||'')
    .replace(/\(\s*TP\s*:\s*-?[\d,.]+\s*\)\s*$/i,'')
    .replace(/[^A-Z0-9]+/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();
}
function extractAreaTp(value){
  const m=String(value||'').match(/\(\s*TP\s*:\s*(-?[\d,.]+)\s*\)\s*$/i);
  return m?numValue(m[1]):0;
}
function cleanAreaItem(value){
  return String(value||'').replace(/\s*\(\s*TP\s*:\s*-?[\d,.]+\s*\)\s*$/i,'').replace(/\s+/g,' ').trim();
}

function uploadExtension(file){
  const name=String(file?.name||'').toLowerCase();
  return name.includes('.')?name.split('.').pop():'';
}
function isPdfUpload(file){return uploadExtension(file)==='pdf'||file?.type==='application/pdf';}
function isCsvUpload(file){return uploadExtension(file)==='csv'||/csv/i.test(String(file?.type||''));}
function isExcelUpload(file){return ['xlsx','xls'].includes(uploadExtension(file));}
function detectDelimitedSeparator(text){
  const sample=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim()).slice(0,12);
  const candidates=[',','\t',';','|'];
  const count=(line,delimiter)=>{let total=0,inQuotes=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQuotes&&line[i+1]==='"')i++;else inQuotes=!inQuotes;}else if(ch===delimiter&&!inQuotes)total++;}return total;};
  let best=',',bestScore=-1;
  for(const delimiter of candidates){const scores=sample.map(line=>count(line,delimiter));const score=scores.reduce((a,v)=>a+v,0);if(score>bestScore){best=delimiter;bestScore=score;}}
  return best;
}
function parseDelimitedText(text){
  const source=String(text||'').replace(/^\uFEFF/,''),delimiter=detectDelimitedSeparator(source);
  const rows=[];let row=[],cell='',inQuotes=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"'){
      if(inQuotes&&source[i+1]==='"'){cell+='"';i++;}
      else inQuotes=!inQuotes;
      continue;
    }
    if(ch===delimiter&&!inQuotes){row.push(cell.trim());cell='';continue;}
    if((ch==='\n'||ch==='\r')&&!inQuotes){
      if(ch==='\r'&&source[i+1]==='\n')i++;
      row.push(cell.trim());cell='';
      if(row.some(v=>String(v).trim()!==''))rows.push(row);
      row=[];continue;
    }
    cell+=ch;
  }
  row.push(cell.trim());if(row.some(v=>String(v).trim()!==''))rows.push(row);
  return rows;
}
async function readCsvMatrix(file){return parseDelimitedText(await file.text());}
function normalizedColumnName(value){return String(value||'').toUpperCase().replace(/&/g,' AND ').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function findCsvColumn(header,aliases){
  const normalized=header.map(normalizedColumnName);
  for(const alias of aliases){const exact=normalized.indexOf(normalizedColumnName(alias));if(exact>=0)return exact;}
  for(const alias of aliases){const key=normalizedColumnName(alias);const partial=normalized.findIndex(v=>v.includes(key)||key.includes(v));if(partial>=0)return partial;}
  return -1;
}
function matrixText(matrix){return matrix.flat().filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(String).join(' ');}
function reportMetaFromText(text,defaultDistributor){
  const source=String(text||'').replace(/\s+/g,' ');
  const printed=(source.match(/Printed\s*On\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[])[1]||new Date().toLocaleDateString('en-GB');
  const range=source.match(/From\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\s*To\s*:?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[];
  return{distributor:defaultDistributor,from:range[1]||'-',to:range[2]||'-',printedOn:printed};
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
  $('#adminStats').innerHTML=[['Companies',db.companies.length],['Employees',db.users.filter(u=>u.role==='employee').length],['Pending',pending],['Stock Rows',db.stock.length],['Area Wise Rows',db.areaWiseRows.length],['Party Wise Rows',db.partyWiseRows.length]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#companyList').innerHTML=db.companies.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<div class="company-card ${c.active===false?'company-inactive':''}"><label class="company-check"><input type="checkbox" data-company-select="${c.id}"><span></span></label><div class="company-info"><div><strong>${escapeHtml(c.name)}</strong> <span class="badge ${c.active===false?'inactive':'active'}">${c.active===false?'Inactive':'Active'}</span></div><div class="muted">${db.stock.filter(r=>r.companyId===c.id).length} stock rows • ${db.areaWiseRows.filter(r=>r.companyId===c.id).length} area-wise rows • ${db.partyWiseRows.filter(r=>r.companyId===c.id).length} party-wise rows • ${db.users.filter(u=>u.companyId===c.id).length} employees</div></div><div class="row-actions"><button class="btn btn-outline" data-toggle-company="${c.id}">${c.active===false?'Activate':'Deactivate'}</button><button class="btn btn-danger" data-delete-company="${c.id}">Delete</button></div></div>`).join('')||'<p class="muted">No companies.</p>';
  $('#employeeList').innerHTML=db.users.filter(u=>u.role==='employee').map(u=>`<div class="employee-card"><div><strong>${escapeHtml(u.name)}</strong> <span class="badge ${!u.approved?'pending':u.active?'active':'inactive'}">${!u.approved?'Pending':u.active?'Active':'Inactive'}</span><div class="muted">${escapeHtml(u.email)} • ${escapeHtml(companyName(u.companyId))}</div></div><div class="row-actions">${!u.approved?`<button class="btn btn-success" data-approve="${u.id}">Approve</button>`:''}<button class="btn btn-outline" data-toggle-user="${u.id}">${u.active?'Deactivate':'Activate'}</button><button class="btn btn-danger" data-delete-user="${u.id}">Delete</button></div></div>`).join('')||'<p class="muted">No employee accounts.</p>';
  $('#adminTableWrap').innerHTML=renderTable(db.stock,true);
  renderAreaWiseAdminImports();
  renderPartyWiseAdminImports();
  requestAnimationFrame(initTopScrollbars);
}

document.addEventListener('click',e=>{
  const id=e.target.dataset.deleteCompany;if(id){const c=db.companies.find(x=>x.id===id);if(c)openConfirm({title:'Delete company',message:`Delete ${c.name}? This will permanently remove its employees and all stock records.`,confirmText:'Delete company',danger:true,onConfirm:()=>deleteCompanies([id])});}
  const tc=e.target.dataset.toggleCompany;if(tc){const c=db.companies.find(x=>x.id===tc);if(c){c.active=c.active===false;db.users.filter(u=>u.companyId===tc).forEach(u=>{if(c.active===false)u.active=false;});saveDB();renderAdmin();renderCompanySelect();toast(c.active?'Company activated':'Company deactivated');}}
  const aid=e.target.dataset.approve;if(aid){const u=db.users.find(x=>x.id===aid);u.approved=true;u.active=true;saveDB();renderAdmin();toast('Employee approved');}
  const tid=e.target.dataset.toggleUser;if(tid){const u=db.users.find(x=>x.id===tid);u.active=!u.active;if(!u.approved)u.approved=true;saveDB();renderAdmin();toast(u.active?'Employee activated':'Employee deactivated');}
  const did=e.target.dataset.deleteUser;if(did){db.users=db.users.filter(u=>u.id!==did);saveDB();renderAdmin();}
});


function selectedCompanyIds(){return $$('[data-company-select]:checked').map(x=>x.dataset.companySelect);}
function deleteCompanies(ids){const set=new Set(ids);db.companies=db.companies.filter(c=>!set.has(c.id));db.users=db.users.filter(u=>!set.has(u.companyId));db.stock=db.stock.filter(r=>!set.has(r.companyId));db.areaWiseRows=db.areaWiseRows.filter(r=>!set.has(r.companyId));db.partyWiseRows=db.partyWiseRows.filter(r=>!set.has(r.companyId));saveDB();closeConfirm();renderAdmin();renderCompanySelect();toast(`${ids.length} compan${ids.length===1?'y':'ies'} deleted`);}
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
  const areaReports=employeeAreaReports();
  if(!selectedAreaReportId||!areaReports.some(r=>r.id===selectedAreaReportId))selectedAreaReportId=areaReports[0]?.id||null;
  const partyReports=employeePartyReports();
  if(!selectedPartyReportId||!partyReports.some(r=>r.id===selectedPartyReportId))selectedPartyReportId=partyReports[0]?.id||null;
  const company=companyName(currentUser.companyId);
  $('#employeeCompanyTitle').textContent=company;
  $('#reportCompanyBadge').textContent=company;
  $('#areaReportCompanyBadge').textContent=company;
  $('#partyReportCompanyBadge').textContent=company;
  renderReportCards();
  refreshReportContext();
  renderAreaReportCards();
  refreshAreaReportContext(false);
  renderPartyReportCards();
  refreshPartyReportContext(false);
  setEmployeeReportMode(employeeReportMode);
}
function refreshReportContext(){
  const report=getSelectedReport(),m=report?.meta||db.reportMeta||{};
  $('#reportMeta').textContent=`From: ${m.from||'-'} To ${m.to||'-'}    Institution Sales: No`;
  $('#stockReportDistributor').textContent=m.distributor||'ARBY ENTERPRISES, HYDERABAD';
  const all=db.stock.filter(r=>r.companyId===currentUser.companyId&&(!selectedReportId||r.importId===selectedReportId));
  const old=$('#filterGroup').value;const groups=[...new Set(all.map(r=>r.group))].sort();$('#filterGroup').innerHTML='<option value="">All groups</option>'+groups.map(g=>`<option>${g}</option>`).join('');if(groups.includes(old))$('#filterGroup').value=old;
  updateEmployeeTable();
}
function updateEmployeeTable(){
  const rows=getEmployeeRows();const totals=rows.reduce((a,r)=>({sale:a.sale+number(r.netSaleQty),closing:a.closing+number(r.closingQty),amount:a.amount+number(r.netSaleAmount)}),{sale:0,closing:0,amount:0});
  if(employeeReportMode==='stock')$('#employeeStats').innerHTML=[['Products',rows.length],['Net Sale Qty',money(totals.sale)],['Closing Qty',money(totals.closing)],['Net Sale Amount',money(totals.amount)]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
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
function safeReportFileName(value){
  return String(value||'report').replace(/[^A-Z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||'report';
}
function openTextPreview(title,text){
  const popup=window.open('','_blank','width=1100,height=850');
  if(!popup)return toast('Allow pop-ups to preview the TXT report');
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;background:#fff;border-bottom:1px solid #d1d5db;padding:12px 18px;font-weight:700}.content{padding:20px}.sheet{max-width:1100px;margin:auto;background:#fff;border:1px solid #d1d5db;padding:22px;white-space:pre;overflow:auto;font:13px/1.5 "Courier New",monospace}</style></head><body><div class="toolbar">TXT Preview — ${escapeHtml(title)}</div><div class="content"><pre class="sheet">${escapeHtml(text)}</pre></div></body></html>`);
  popup.document.close();popup.focus();
}
function openPdfPreview(doc){
  if(!doc)return false;
  const url=doc.output('bloburl');
  const popup=window.open(url,'_blank');
  if(!popup){toast('Allow pop-ups to preview the PDF report');return false;}
  popup.focus();return true;
}
function stockTxtReport(){
  const report=getSelectedReport(),rows=getEmployeeRows(),m=report?.meta||db.reportMeta||{};
  if(!rows.length)return null;
  const lines=[
    m.distributor||'ARBY ENTERPRISES, HYDERABAD',
    'SALES, STOCK & RETURN REPORT',
    `COMPANY: ${companyName(currentUser.companyId)}`,
    `FROM: ${m.from||'-'}   TO: ${m.to||'-'}   REPORT DATE: ${displayDate(report?.reportDate)}`,
    '',
    ['GROUP',...cols.map(c=>c[1])].join('\t')
  ];
  rows.forEach(r=>lines.push([r.group,...cols.map(([k])=>r[k]??'')].join('\t')));
  return lines.join('\n');
}
function buildStockPdfDoc(){
  const rows=getEmployeeRows(),report=getSelectedReport(),m=report?.meta||db.reportMeta||{},jsPDF=window.jspdf?.jsPDF;
  if(!rows.length){toast('No records available');return null;}
  if(!jsPDF||typeof jsPDF!=='function'){toast('PDF engine is not available');return null;}
  try{
    const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
    doc.setFontSize(15);doc.text('SALES, STOCK & RETURN REPORT',40,34);
    doc.setFontSize(9);doc.text(`${companyName(currentUser.companyId)} • ${displayDate(report?.reportDate)} • ${m.from||'-'} to ${m.to||'-'}`,40,50);
    if(typeof doc.autoTable!=='function')return null;
    doc.autoTable({startY:62,head:[['Group',...cols.map(c=>c[1])]],body:rows.map(r=>[r.group,...cols.map(([k])=>r[k])]),styles:{fontSize:3.6,cellPadding:1.2,overflow:'linebreak'},headStyles:{fillColor:[31,95,153]},theme:'grid',horizontalPageBreak:true,horizontalPageBreakRepeat:[0,1],margin:{left:18,right:18}});
    return doc;
  }catch(err){console.error(err);toast('Could not create PDF');return null;}
}
$('#previewStockTxt').addEventListener('click',()=>{const text=stockTxtReport();if(!text)return toast('No records available');openTextPreview(`${companyName(currentUser.companyId)} Stock Report`,text);});
$('#downloadStockTxt').addEventListener('click',()=>{const text=stockTxtReport();if(!text)return toast('No records available');const report=getSelectedReport();downloadBlob(text,'text/plain;charset=utf-8',`${safeReportFileName(companyName(currentUser.companyId))}-${report?.reportDate||'stock-report'}.txt`);});
$('#previewStockPdf').addEventListener('click',()=>openPdfPreview(buildStockPdfDoc()));
$('#downloadStockPdf').addEventListener('click',()=>{const doc=buildStockPdfDoc();if(doc){const report=getSelectedReport();doc.save(`${safeReportFileName(companyName(currentUser.companyId))}-${report?.reportDate||'stock-report'}.pdf`);}});
function downloadBlob(content,type,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}


function setEmployeeReportMode(mode){
  employeeReportMode=['stock','area','party'].includes(mode)?mode:'stock';
  $$('.report-mode-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.employeeReport===employeeReportMode));
  $('#employeeStockReporting').classList.toggle('active',employeeReportMode==='stock');
  $('#employeeAreaReporting').classList.toggle('active',employeeReportMode==='area');
  $('#employeePartyReporting').classList.toggle('active',employeeReportMode==='party');
  if(employeeReportMode==='area')updateAreaEmployeeTable();
  else if(employeeReportMode==='party')updatePartyEmployeeTable();
  else updateEmployeeTable();
  requestAnimationFrame(initTopScrollbars);
}
$$('.report-mode-btn').forEach(btn=>btn.addEventListener('click',()=>setEmployeeReportMode(btn.dataset.employeeReport)));

function employeeAreaReports(){
  if(!currentUser)return[];
  const ids=new Set(db.areaWiseRows.filter(r=>r.companyId===currentUser.companyId).map(r=>r.importId));
  return db.areaWiseImports.filter(i=>ids.has(i.id)).sort((a,b)=>String(b.reportDate||b.date).localeCompare(String(a.reportDate||a.date))||String(b.date).localeCompare(String(a.date)));
}
function getSelectedAreaReport(){return db.areaWiseImports.find(i=>i.id===selectedAreaReportId)||employeeAreaReports()[0]||null;}
function getEmployeeAreaRows(){
  if(!currentUser)return[];
  let rows=db.areaWiseRows.filter(r=>r.companyId===currentUser.companyId&&(!selectedAreaReportId||r.importId===selectedAreaReportId));
  const q=$('#areaFilterSearch').value.trim().toLowerCase();
  const area=$('#areaFilterCode').value;
  const minQty=Number($('#areaFilterMinQty').value||-Infinity);
  rows=rows.filter(r=>(!q||r.item.toLowerCase().includes(q))&&number(r.totalQty)>=minQty&&(!area||number(r.areas?.[area])!==0));
  const sort=$('#areaFilterSort').value;
  rows.sort((a,b)=>sort==='qtyDesc'?number(b.totalQty)-number(a.totalQty):sort==='amountDesc'?number(b.totalAmount)-number(a.totalAmount):sort==='tpDesc'?number(b.tp)-number(a.tp):a.item.localeCompare(b.item));
  return rows;
}
function renderAreaReportCards(){
  const from=$('#areaReportDateFrom').value,to=$('#areaReportDateTo').value;
  const reports=employeeAreaReports().filter(r=>(!from||r.reportDate>=from)&&(!to||r.reportDate<=to));
  $('#employeeAreaReportCards').innerHTML=reports.map(r=>{
    const count=db.areaWiseRows.filter(x=>x.importId===r.id&&x.companyId===currentUser.companyId).length;
    const meta=r.meta||{};
    return `<button class="report-card ${r.id===selectedAreaReportId?'active':''}" data-area-report-id="${r.id}"><div class="report-date">${displayDate(r.reportDate||r.date)}</div><div class="report-range">${escapeHtml(meta.from||'-')} to ${escapeHtml(meta.to||'-')} • ${count} products</div><div class="report-file">${escapeHtml(r.filename||'Area wise report')}</div></button>`;
  }).join('')||'<div class="empty-state">No area-wise report is available for your company.</div>';
}
function getAreaRowsForReport(reportId){
  if(!currentUser)return[];
  return db.areaWiseRows.filter(r=>r.companyId===currentUser.companyId&&(!reportId||r.importId===reportId));
}
function getNonEmptyAreaCodes(report,rows){
  const codes=report?.areaCodes||[];
  return codes.filter(code=>rows.some(r=>number(r.areas?.[code])!==0));
}
function refreshAreaReportContext(updateTable=true){
  const report=getSelectedAreaReport(),m=report?.meta||{};
  $('#areaReportDistributor').textContent=m.distributor||'TAWAKAL ENTERPRISES CHANNEL-II';
  $('#areaReportMeta').textContent=`From: ${m.from||'-'} To ${m.to||'-'}    Station: ${m.station||'BOTH'}    Institution Sales: ${m.institutionSale||'NO'}`;
  const old=$('#areaFilterCode').value;
  const reportRows=getAreaRowsForReport(report?.id);
  const areas=getNonEmptyAreaCodes(report,reportRows);
  $('#areaFilterCode').innerHTML='<option value="">All areas</option>'+areas.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  if(areas.includes(old))$('#areaFilterCode').value=old;
  if(updateTable)updateAreaEmployeeTable();
}
function areaDisplayColumns(report,rows=[]){
  const selected=$('#areaFilterCode').value;
  if(selected)return [selected];
  return getNonEmptyAreaCodes(report,rows);
}
function renderAreaWiseTable(rows,report){
  if(!report)return '<div class="empty-state">No area-wise report is available for your company.</div>';
  if(!rows.length)return '<div class="empty-state">No area-wise records match the selected filters.</div>';
  const areas=areaDisplayColumns(report,rows);
  const totals={qty:0,amount:0,areaAmounts:{}};
  rows.forEach(r=>{
    totals.qty+=number(r.totalQty);totals.amount+=number(r.totalAmount);
    areas.forEach(a=>totals.areaAmounts[a]=(totals.areaAmounts[a]||0)+(number(r.areas?.[a])*number(r.tp)));
  });
  const head=`<thead><tr><th class="area-item-head">ITEM</th>${areas.map(a=>`<th>${escapeHtml(a)}</th>`).join('')}<th>TTL QTY</th><th>TTL AMT</th></tr></thead>`;
  const body=rows.map(r=>`<tr><td class="item-cell">${escapeHtml(`${r.item} (TP: ${number(r.tp).toFixed(2)})`)}</td>${areas.map(a=>`<td>${number(r.areas?.[a])===0?'':money(r.areas[a])}</td>`).join('')}<td>${money(r.totalQty)}</td><td>${money(r.totalAmount)}</td></tr>`).join('');
  const totalRow=`<tr class="total-row area-grand-total"><td>G TTL AMT</td>${areas.map(a=>`<td>${money(totals.areaAmounts[a]||0)}</td>`).join('')}<td>${money(totals.amount)}</td><td>${money(totals.amount)}</td></tr>`;
  return `<div class="table-scroll-shell"><div class="table-scroll-top"><div class="table-scroll-top-inner"></div></div><div class="table-wrap"><table class="data-table area-data-table">${head}<tbody>${body}${totalRow}</tbody></table></div></div>`;
}
function updateAreaEmployeeTable(){
  const report=getSelectedAreaReport();
  const rows=getEmployeeAreaRows();
  const visibleAreas=areaDisplayColumns(report,rows);
  const totals=rows.reduce((a,r)=>({qty:a.qty+number(r.totalQty),amount:a.amount+number(r.totalAmount)}),{qty:0,amount:0});
  if(employeeReportMode==='area')$('#employeeStats').innerHTML=[['Products',rows.length],['Areas',visibleAreas.length],['Total Qty',money(totals.qty)],['Total Amount',money(totals.amount)]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#employeeAreaTableWrap').innerHTML=renderAreaWiseTable(rows,report);
  initTopScrollbars();
}
['areaFilterSearch','areaFilterCode','areaFilterMinQty','areaFilterSort'].forEach(id=>$('#'+id).addEventListener('input',updateAreaEmployeeTable));
$('#areaReportDateFrom').addEventListener('input',renderAreaReportCards);
$('#areaReportDateTo').addEventListener('input',renderAreaReportCards);
$('#resetAreaReportDates').addEventListener('click',()=>{$('#areaReportDateFrom').value='';$('#areaReportDateTo').value='';renderAreaReportCards();});
$('#resetAreaFilters').addEventListener('click',()=>{$('#areaFilterSearch').value='';$('#areaFilterCode').value='';$('#areaFilterMinQty').value='';$('#areaFilterSort').value='item';updateAreaEmployeeTable();});
document.addEventListener('click',e=>{const card=e.target.closest('[data-area-report-id]');if(card){selectedAreaReportId=card.dataset.areaReportId;renderAreaReportCards();refreshAreaReportContext();window.scrollTo({top:document.querySelector('#employeeAreaReporting .filter-panel').offsetTop-75,behavior:'smooth'});}});

function areaExportRows(){const report=getSelectedAreaReport(),rows=getEmployeeAreaRows();return{report,rows,areas:areaDisplayColumns(report,rows)};}
function areaTxtReport(){
  const {report,rows,areas}=areaExportRows();
  if(!rows.length)return null;
  const m=report?.meta||{};
  const lines=[
    m.distributor||'TAWAKAL ENTERPRISES CHANNEL-II',
    'ITEM SALES STATISTICS (AREA WISE)',
    `COMPANY: ${companyName(currentUser.companyId)}`,
    `FROM: ${m.from||'-'}   TO: ${m.to||'-'}   REPORT DATE: ${displayDate(report?.reportDate)}`,
    '',
    ['ITEM',...areas,'TTL QTY','TTL AMT'].join('\t')
  ];
  rows.forEach(r=>lines.push([`${r.item} (TP: ${number(r.tp).toFixed(2)})`,...areas.map(a=>number(r.areas?.[a])||''),money(r.totalQty),money(r.totalAmount)].join('\t')));
  const areaAmounts=areas.map(a=>money(rows.reduce((sum,r)=>sum+(number(r.areas?.[a])*number(r.tp)),0)));
  const totalAmount=money(rows.reduce((sum,r)=>sum+number(r.totalAmount),0));
  lines.push(['G TTL AMT',...areaAmounts,totalAmount,totalAmount].join('\t'));
  return lines.join('\n');
}
function buildAreaPdfDoc(){
  const {report,rows,areas}=areaExportRows(),jsPDF=window.jspdf?.jsPDF;
  if(!rows.length){toast('No records available');return null;}
  if(!jsPDF||typeof jsPDF!=='function'){toast('PDF engine is not available');return null;}
  try{
    const doc=new jsPDF({orientation:'portrait',unit:'pt',format:areas.length>12?'a3':'a4'});
    doc.setFontSize(15);doc.text('ITEM SALES STATISTICS (AREA WISE)',40,34);
    doc.setFontSize(9);doc.text(`${companyName(currentUser.companyId)} • ${displayDate(report?.reportDate)}`,40,50);
    if(typeof doc.autoTable!=='function')return null;
    const totalAmount=rows.reduce((sum,r)=>sum+number(r.totalAmount),0);
    doc.autoTable({
      startY:62,
      head:[['ITEM',...areas,'TTL QTY','TTL AMT']],
      body:[
        ...rows.map(r=>[`${r.item} (TP: ${number(r.tp).toFixed(2)})`,...areas.map(a=>number(r.areas?.[a])||''),money(r.totalQty),money(r.totalAmount)]),
        ['G TTL AMT',...areas.map(a=>money(rows.reduce((sum,r)=>sum+(number(r.areas?.[a])*number(r.tp)),0))),money(totalAmount),money(totalAmount)]
      ],
      styles:{fontSize:areas.length>20?3.4:5.8,cellPadding:1.4,overflow:'linebreak'},
      headStyles:{fillColor:[31,95,153]},
      theme:'grid',horizontalPageBreak:true,horizontalPageBreakRepeat:[0],margin:{left:18,right:18}
    });
    return doc;
  }catch(err){console.error(err);toast('Could not create PDF');return null;}
}
$('#previewAreaTxt').addEventListener('click',()=>{const text=areaTxtReport();if(!text)return toast('No records available');openTextPreview(`${companyName(currentUser.companyId)} Area Wise Report`,text);});
$('#downloadAreaTxt').addEventListener('click',()=>{const text=areaTxtReport();if(!text)return toast('No records available');const report=getSelectedAreaReport();downloadBlob(text,'text/plain;charset=utf-8',`${safeReportFileName(companyName(currentUser.companyId))}-${report?.reportDate||'area-wise-report'}.txt`);});
$('#previewAreaPdf').addEventListener('click',()=>openPdfPreview(buildAreaPdfDoc()));
$('#downloadAreaPdf').addEventListener('click',()=>{const doc=buildAreaPdfDoc();if(doc){const report=getSelectedAreaReport();doc.save(`${safeReportFileName(companyName(currentUser.companyId))}-${report?.reportDate||'area-wise-report'}.pdf`);}});

const OPTIONAL_PRODUCT_FORM_TOKENS=new Set([
  'TAB','CAP','SYP','SUSP','INJ','VIAL','AMP','SACHET','SCT','CRM','OINT','DROP',
  'SOL','GEL','LOTION','LOZ','SPRAY','PWD','SHAMPOO','SYRINGE','SUPP','SUPPOSITORY'
]);
const TRAILING_PRODUCT_NOISE_TOKENS=new Set(['TOTAL','TTL']);
const PRODUCT_TOKEN_ALIASES=new Map([
  ['TABLET','TAB'],['TABLETS','TAB'],['TABS','TAB'],['TBL','TAB'],['TBLT','TAB'],
  ['CAPSULE','CAP'],['CAPSULES','CAP'],['CAPS','CAP'],
  ['SYRUP','SYP'],['SYR','SYP'],['SIRUP','SYP'],['SYP','SYP'],
  ['SUSPENSION','SUSP'],['SUSPN','SUSP'],['SUS','SUSP'],
  ['INJECTION','INJ'],['INJECTIONS','INJ'],['INJ','INJ'],
  ['VIALS','VIAL'],['AMPOULE','AMP'],['AMPOULES','AMP'],['AMPS','AMP'],
  ['SACHETS','SACHET'],['SACH','SACHET'],['DROPS','DROP'],['DRP','DROP'],
  ['LOZENGE','LOZ'],['LOZENGES','LOZ'],['CREAM','CRM'],['CREME','CRM'],
  ['OINTMENT','OINT'],['SOLUTION','SOL'],['POWDER','PWD'],['SPRAYS','SPRAY'],
  ['GRAM','G'],['GRAMS','G'],['GMS','G'],['GM','G'],
  ['MILLIGRAM','MG'],['MILLIGRAMS','MG'],['MGS','MG'],
  ['MICROGRAM','MCG'],['MICROGRAMS','MCG'],
  ['MILLILITER','ML'],['MILLILITERS','ML'],['MILLILITRE','ML'],['MILLILITRES','ML'],['MLS','ML'],
  ['INTERNATIONALUNIT','IU'],['INTERNATIONALUNITS','IU'],
  ['PIECES','S'],['PIECE','S'],['PCS','S'],['PC','S'],
  ['PACKS','PACK'],['PKS','PACK'],['PK','PACK']
]);
function normalizeProductToken(token){
  let value=String(token||'').toUpperCase().trim();
  value=PRODUCT_TOKEN_ALIASES.get(value)||value;
  // Correct common extraction confusions only inside measurement/pack tokens.
  // Example: 12OML (letter O) becomes 120ML; I20ML becomes 120ML.
  if(/^[0-9IO]+(?:\.\d+)?(?:MG|MCG|ML|G|IU|S)$/.test(value)){
    value=value.replace(/I/g,'1').replace(/O/g,'0');
  }
  return value;
}
function mergedProductTokens(value){
  const raw=normalizeProductName(value).split(' ').filter(Boolean),tokens=[];
  for(let i=0;i<raw.length;i++){
    let current=normalizeProductToken(raw[i]);
    let next=normalizeProductToken(raw[i+1]);
    let next2=normalizeProductToken(raw[i+2]);
    let next3=normalizeProductToken(raw[i+3]);

    // Merge measurements split by PDF/Excel extraction: 120 ML -> 120ML.
    if(/^\d+(?:\.\d+)?$/.test(current)&&/^(?:MG|MCG|G|ML|IU|S)$/.test(next||'')){
      tokens.push(`${current}${next}`);i++;continue;
    }
    // Merge pack expressions split into separate cells/tokens: 2 X 10 S -> 2X10S.
    if(/^\d+$/.test(current)&&next==='X'&&/^\d+$/.test(next2)&&next3==='S'){
      tokens.push(`${current}X${next2}S`);i+=3;continue;
    }
    if(/^\d+$/.test(current)&&next==='X'&&/^\d+S$/.test(next2||'')){
      tokens.push(`${current}X${next2}`);i+=2;continue;
    }
    tokens.push(current);
  }
  // Collapse adjacent duplicate tokens sometimes produced when a PDF line is read twice.
  const cleaned=tokens.filter((token,index)=>index===0||token!==tokens[index-1]);
  // Some Stock & Sales PDF rows append report labels to the item, e.g.
  // "AZOLAC LF 400G TOTAL". These labels are not part of the product name.
  while(cleaned.length&&TRAILING_PRODUCT_NOISE_TOKENS.has(cleaned.at(-1)))cleaned.pop();
  return cleaned;
}
function canonicalProductName(value){
  return mergedProductTokens(value).join(' ');
}
function compactProductName(value){
  return canonicalProductName(value).replace(/\s+/g,'');
}
function tokenBagProductName(value){
  return [...mergedProductTokens(value)].sort().join('|');
}
function optionalPackToken(token){
  return /^\d+(?:\.\d+)?S$/.test(token)
    || /^\d+(?:\.\d+)?(?:PK|PACK)$/.test(token)
    || /^\d+X\d+(?:\.\d+)?S$/.test(token)
    || /^NP\d+$/.test(token);
}
function productCoreTokens(value){
  return mergedProductTokens(value).filter(token=>!OPTIONAL_PRODUCT_FORM_TOKENS.has(token)&&!optionalPackToken(token));
}
function coreBagProductName(value){
  return [...productCoreTokens(value)].sort().join('|');
}
function productNameTokenVariants(value){
  const tokens=mergedProductTokens(value),variants=[tokens];
  const looksLikeProduct=parts=>parts.some(token=>OPTIONAL_PRODUCT_FORM_TOKENS.has(token)||/^\d+(?:\.\d+)?(?:MG|MCG|G|ML|IU|S)$/.test(token));
  // Some stock PDFs accidentally include the row serial number inside the ITEM column.
  if(tokens.length>=4&&/^\d{1,4}$/.test(tokens[0])&&looksLikeProduct(tokens.slice(1)))variants.push(tokens.slice(1));
  // A repeated standalone serial can also be appended at the end by a wrapped PDF row.
  if(tokens.length>=4&&/^\d{1,4}$/.test(tokens.at(-1))&&looksLikeProduct(tokens.slice(0,-1)))variants.push(tokens.slice(0,-1));
  const unique=new Map();
  variants.forEach(parts=>{const key=parts.join(' ');if(key)unique.set(key,parts);});
  return [...unique.values()];
}
function productNameVariants(value){return productNameTokenVariants(value).map(tokens=>tokens.join(' '));}
function compactProductVariants(value){return productNameTokenVariants(value).map(tokens=>tokens.join(''));}
function tokenBagProductVariants(value){return productNameTokenVariants(value).map(tokens=>[...tokens].sort().join('|'));}
function coreBagProductVariants(value){
  return productNameTokenVariants(value).map(tokens=>tokens.filter(token=>!OPTIONAL_PRODUCT_FORM_TOKENS.has(token)&&!optionalPackToken(token)).sort().join('|')).filter(Boolean);
}
function candidatesForKeys(map,keys){
  const found=[];
  for(const key of new Set(keys||[]))for(const candidate of map.get(key)?.values?.()||[])found.push(candidate);
  return uniqueCompanyCandidates(found);
}
function productStrengthTokens(value){
  return productCoreTokens(value).filter(token=>/^\d+(?:\.\d+)?(?:MG|MCG|G|ML|IU)$/.test(token));
}
function sameTokenSet(left,right){
  const a=[...new Set(left)].sort(),b=[...new Set(right)].sort();
  return a.length===b.length&&a.every((token,index)=>token===b[index]);
}
function lcsLength(left,right){
  const dp=Array(right.length+1).fill(0);
  for(const token of left){
    let previous=0;
    for(let j=1;j<=right.length;j++){
      const saved=dp[j];
      dp[j]=token===right[j-1]?previous+1:Math.max(dp[j],dp[j-1]);
      previous=saved;
    }
  }
  return dp[right.length];
}
function levenshteinDistance(leftValue,rightValue){
  const left=String(leftValue||''),right=String(rightValue||'');
  const previous=Array.from({length:right.length+1},(_,i)=>i);
  for(let i=1;i<=left.length;i++){
    let diagonal=previous[0];previous[0]=i;
    for(let j=1;j<=right.length;j++){
      const saved=previous[j];
      previous[j]=Math.min(previous[j]+1,previous[j-1]+1,diagonal+(left[i-1]===right[j-1]?0:1));
      diagonal=saved;
    }
  }
  return previous[right.length];
}
function characterSimilarity(leftValue,rightValue){
  const left=compactProductName(leftValue),right=compactProductName(rightValue);
  const maxLength=Math.max(left.length,right.length)||1;
  return Math.max(0,100-(levenshteinDistance(left,right)/maxLength*100));
}
function compareProductNames(leftValue,rightValue){
  const left=productCoreTokens(leftValue),right=productCoreTokens(rightValue);
  if(!left.length||!right.length)return{score:0,common:0,reason:'Product name is empty after normalization.'};
  const leftStrength=productStrengthTokens(leftValue),rightStrength=productStrengthTokens(rightValue);
  if(leftStrength.length&&rightStrength.length&&!sameTokenSet(leftStrength,rightStrength)){
    return{score:0,common:0,reason:'The medicine strength, volume, or dosage is different.'};
  }
  const leftSet=new Set(left),rightSet=new Set(right);
  const common=[...leftSet].filter(token=>rightSet.has(token)).length;
  const shorter=Math.min(leftSet.size,rightSet.size)||1;
  const coverage=common/shorter;
  const ordered=lcsLength(left,right)/Math.min(left.length,right.length);
  const charScore=characterSimilarity(leftValue,rightValue)/100;
  let prefix=0;
  while(prefix<Math.min(left.length,right.length)&&left[prefix]===right[prefix])prefix++;
  const prefixCoverage=prefix/Math.min(left.length,right.length);
  let score=(coverage*45)+(ordered*25)+(prefixCoverage*10)+(charScore*20);
  if(left[0]!==right[0]&&charScore<0.92)score-=18;
  if((leftStrength.length===0)!==(rightStrength.length===0))score-=8;
  score=Math.max(0,Math.min(100,Math.round(score*10)/10));
  const requiredCommon=Math.min(2,Math.min(left.length,right.length));
  if(common<requiredCommon)return{score,common,reason:`Only ${common} important name word${common===1?'':'s'} matched.`};
  return{score,common,reason:''};
}
function productTpMatches(left,right){
  const a=Math.abs(number(left)),b=Math.abs(number(right));
  if(a===0||b===0)return false;
  return Math.abs(a-b)<=0.10;
}
function uniqueCompanyCandidates(candidates){
  const companies=new Map();
  for(const candidate of candidates||[]){
    const current=companies.get(candidate.companyId);
    if(!current||number(candidate.score)>number(current.score))companies.set(candidate.companyId,candidate);
  }
  return [...companies.values()];
}
function resolveExactCandidateSet(candidates,inputTp,matchType,label){
  const matches=uniqueCompanyCandidates(candidates);
  if(matches.length===1)return{status:'matched',...matches[0],similarity:100,matchType};
  if(matches.length>1){
    if(inputTp<=0)return{status:'ambiguous',similarity:100,reason:`${label} belongs to more than one company and TP is missing.`};
    const priced=uniqueCompanyCandidates(matches.filter(candidate=>productTpMatches(inputTp,candidate.rate)));
    if(priced.length===1)return{status:'matched',...priced[0],similarity:100,matchType:`${matchType}-tp-disambiguated`};
    if(priced.length>1)return{status:'ambiguous',similarity:100,reason:`${label} and TP belong to more than one company.`};
    return{status:'ambiguous',similarity:100,reason:`${label} belongs to more than one company, but TP ${inputTp.toFixed(2)} did not identify one company.`};
  }
  return null;
}
function buildAreaProductIndex(){
  const byName=new Map(),byCompactName=new Map(),byTokenBag=new Map(),byCoreBag=new Map(),candidateMap=new Map();
  const add=(map,key,candidate)=>{
    if(!key)return;
    if(!map.has(key))map.set(key,new Map());
    const companyKey=candidate.companyId;
    const current=map.get(key).get(companyKey);
    if(!current||(!current.rate&&candidate.rate))map.get(key).set(companyKey,candidate);
  };
  for(const r of db.stock){
    const item=cleanImportedItem(r.item),name=canonicalProductName(item),compactName=compactProductName(item),tokenBag=tokenBagProductName(item),coreBag=coreBagProductName(item);
    if(!name||!r.companyId)continue;
    const candidate={companyId:r.companyId,group:r.group||'',item:item||'',rate:number(r.rate),name,compactName,tokenBag,coreBag};
    const candidateKey=`${r.companyId}|${name}|${number(r.rate).toFixed(2)}`;
    candidateMap.set(candidateKey,candidate);
    productNameVariants(item).forEach(key=>add(byName,key,candidate));
    compactProductVariants(item).forEach(key=>add(byCompactName,key,candidate));
    tokenBagProductVariants(item).forEach(key=>add(byTokenBag,key,candidate));
    coreBagProductVariants(item).forEach(key=>add(byCoreBag,key,candidate));
  }
  return{byName,byCompactName,byTokenBag,byCoreBag,candidates:[...candidateMap.values()]};
}
function resolveAreaCompany(item,tp,index){
  const name=canonicalProductName(item),inputTp=Math.abs(number(tp));
  if(!name)return{status:'unmatched',reason:'The item name is empty after normalization.'};

  // 1) Truly identical names: company is selected by name alone. TP is not required.
  const exact=resolveExactCandidateSet(candidatesForKeys(index.byName,productNameVariants(item)),inputTp,'exact-canonical-name','The exact item name');
  if(exact)return exact;

  // 2) Same letters/numbers with harmless spacing differences.
  const compact=resolveExactCandidateSet(candidatesForKeys(index.byCompactName,compactProductVariants(item)),inputTp,'exact-compact-name','The same compact item name');
  if(compact)return compact;

  // 3) Same complete words in a different order. Example: SYP 120ML vs 120ML SYP.
  const tokenBag=resolveExactCandidateSet(candidatesForKeys(index.byTokenBag,tokenBagProductVariants(item)),inputTp,'exact-token-set-name','The same complete item words');
  if(tokenBag)return tokenBag;

  // 4) Near-identical extraction: same token count and strength, with only a tiny typo.
  // This is treated like the same name only when one company is clearly better than all others.
  const inputTokens=mergedProductTokens(item),inputStrength=productStrengthTokens(item);
  const nearExact=(index.candidates||[]).map(candidate=>{
    const candidateTokens=mergedProductTokens(candidate.item);
    const charScore=characterSimilarity(item,candidate.item);
    const strengthsOkay=!inputStrength.length||!productStrengthTokens(candidate.item).length||sameTokenSet(inputStrength,productStrengthTokens(candidate.item));
    return{...candidate,charScore,tokenCountOkay:inputTokens.length===candidateTokens.length,strengthsOkay};
  }).filter(candidate=>candidate.tokenCountOkay&&candidate.strengthsOkay&&candidate.charScore>=96)
    .sort((a,b)=>b.charScore-a.charScore);
  if(nearExact.length){
    const bestScore=nearExact[0].charScore;
    const finalists=uniqueCompanyCandidates(nearExact.filter(candidate=>candidate.charScore>=bestScore-0.5));
    if(finalists.length===1)return{status:'matched',...finalists[0],similarity:Math.round(bestScore*10)/10,matchType:'near-exact-extraction-name'};
    if(finalists.length>1){
      const priced=uniqueCompanyCandidates(finalists.filter(candidate=>productTpMatches(inputTp,candidate.rate)));
      if(priced.length===1)return{status:'matched',...priced[0],similarity:Math.round(bestScore*10)/10,matchType:'near-exact-extraction-name-tp-disambiguated'};
      return{status:'ambiguous',similarity:Math.round(bestScore*10)/10,reason:'A near-identical item name was found under more than one company.'};
    }
  }

  // 5) A strong, unique name match is enough even when TP differs.
  // TP is used only to disambiguate when the same strong name points to multiple companies.
  const strongNameMatches=(index.candidates||[]).map(candidate=>{
    const comparison=compareProductNames(item,candidate.item);
    return{...candidate,...comparison};
  }).filter(candidate=>candidate.score>=90)
    .sort((a,b)=>b.score-a.score);
  if(strongNameMatches.length){
    const bestScore=strongNameMatches[0].score;
    const finalists=uniqueCompanyCandidates(strongNameMatches.filter(candidate=>candidate.score>=bestScore-1));
    if(finalists.length===1){
      return{status:'matched',...finalists[0],similarity:bestScore,matchType:'strong-unique-name-no-tp'};
    }
    if(finalists.length>1){
      const priced=uniqueCompanyCandidates(finalists.filter(candidate=>productTpMatches(inputTp,candidate.rate)));
      if(priced.length===1)return{status:'matched',...priced[0],similarity:bestScore,matchType:'strong-name-tp-disambiguated'};
      return{status:'ambiguous',similarity:bestScore,reason:`The item name matched more than one company at about ${bestScore.toFixed(1)}%.`};
    }
  }

  // 6) Names that differ only by form/pack suffixes use TP for confirmation.
  const coreMatches=candidatesForKeys(index.byCoreBag,coreBagProductVariants(item));
  if(coreMatches.length){
    if(inputTp<=0)return{status:'unmatched',similarity:100,reason:'The core item name matched, but extra form/pack words were different and TP was missing.'};
    const priced=uniqueCompanyCandidates(coreMatches.filter(candidate=>productTpMatches(inputTp,candidate.rate)));
    if(priced.length===1)return{status:'matched',...priced[0],similarity:100,matchType:'core-name-extra-suffix-and-tp'};
    if(priced.length>1)return{status:'ambiguous',similarity:100,reason:'The core item name and TP matched more than one company.'};
    const closest=[...coreMatches].sort((a,b)=>Math.abs(inputTp-a.rate)-Math.abs(inputTp-b.rate))[0];
    return{status:'unmatched',similarity:100,reason:`The core name matched, but TP ${inputTp.toFixed(2)} did not match${closest?` the Stock & Sales TP ${number(closest.rate).toFixed(2)} for ${closest.item}`:''}.`};
  }

  // 7) Broader fuzzy fallback: TP is mandatory because the name similarity is below 90%.
  const compared=(index.candidates||[]).map(candidate=>{
    const comparison=compareProductNames(item,candidate.item);
    return{...candidate,...comparison};
  }).filter(candidate=>candidate.score>=72);

  if(!compared.length){
    const best=(index.candidates||[]).map(candidate=>({...candidate,...compareProductNames(item,candidate.item)})).sort((a,b)=>b.score-a.score)[0];
    const detail=best?.score?` Closest Stock & Sales item: ${best.item} (${best.score.toFixed(1)}%).`:' The item was not found in the imported Stock & Sales rows.';
    return{status:'unmatched',reason:`No Stock & Sales item reached the required name similarity.${detail}`};
  }
  if(inputTp<=0){
    const best=[...compared].sort((a,b)=>b.score-a.score)[0];
    return{status:'unmatched',similarity:best.score,reason:`The closest name was ${best.item} (${best.score.toFixed(1)}%), but TP was missing for confirmation.`};
  }
  const priced=compared.filter(candidate=>productTpMatches(inputTp,candidate.rate));
  if(!priced.length){
    const best=[...compared].sort((a,b)=>b.score-a.score)[0];
    const closest=[...compared].sort((a,b)=>Math.abs(inputTp-a.rate)-Math.abs(inputTp-b.rate))[0];
    return{status:'unmatched',similarity:best.score,reason:`Closest name: ${best.item} (${best.score.toFixed(1)}%). TP ${inputTp.toFixed(2)} did not match${closest?` Stock & Sales TP ${number(closest.rate).toFixed(2)}`:''}.`};
  }
  const bestScore=Math.max(...priced.map(candidate=>candidate.score));
  const finalists=uniqueCompanyCandidates(priced.filter(candidate=>candidate.score>=bestScore-2));
  if(finalists.length===1)return{status:'matched',...finalists[0],similarity:finalists[0].score,matchType:'fuzzy-name-and-tp'};
  return{status:'ambiguous',similarity:bestScore,reason:`More than one company matched the item name at about ${bestScore.toFixed(1)}% with the same TP.`};
}

function importAreaWiseMatrix(matrix,filename){
  const headerIndex=matrix.findIndex(row=>String(row?.[0]||'').trim().toUpperCase()==='ITEM'&&row.some(v=>String(v||'').trim().toUpperCase()==='TTL QTY'));
  if(headerIndex<0)throw new Error('ITEM / TTL QTY header row was not found');
  const header=matrix[headerIndex].map(v=>String(v??'').trim());
  const totalQtyIndex=header.findIndex(v=>v.toUpperCase()==='TTL QTY');
  const totalAmountIndex=header.findIndex(v=>v.toUpperCase()==='TTL AMT');
  if(totalQtyIndex<0||totalAmountIndex<0)throw new Error('TTL QTY or TTL AMT column was not found');
  const areaColumns=header.map((name,index)=>({name,index})).filter(c=>c.index>0&&c.index<totalQtyIndex&&c.name);
  const areaCodes=areaColumns.map(c=>c.name);
  const topText=matrix.slice(0,headerIndex).flat().filter(Boolean).map(String).join(' ');
  const distributor=String(matrix[0]?.[0]||'TAWAKAL ENTERPRISES CHANNEL-II').trim();
  const range=topText.match(/FROM\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\s*TO\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[];
  const station=(topText.match(/STATION\s*:\s*([^\s]+(?:\s+[^\s]+)?)(?=\s+INSTITUTION|$)/i)||[])[1]?.trim()||'BOTH';
  const institutionSale=(topText.match(/INSTITUTION\s+SALE\s*:\s*([^\s]+)/i)||[])[1]?.trim()||'NO';
  const valueBy=(topText.match(/VALUE\s+BY\s*:\s*(.*?)(?=Software By:|$)/i)||[])[1]?.trim()||'ITEMS TP';
  const meta={distributor,from:range[1]||'-',to:range[2]||'-',station,institutionSale,valueBy};
  const importId=uid(),reportDate=toIsoDate(meta.to)||new Date().toISOString().slice(0,10);
  const productIndex=buildAreaProductIndex();
  const newRows=[];const unmatchedItems=[];const ambiguousItems=[];let parsedRows=0;
  for(let ri=headerIndex+1;ri<matrix.length;ri++){
    const row=matrix[ri]||[];const rawItem=String(row[0]||'').trim();
    if(!rawItem||/^G\s*TTL\s*AMT$/i.test(rawItem)||/^(GRAND\s+)?TOTAL$/i.test(rawItem))continue;
    const item=cleanAreaItem(rawItem),tp=extractAreaTp(rawItem);if(!item)continue;parsedRows++;
    const areas={};
    for(const c of areaColumns){const val=numValue(row[c.index]);if(val!==0)areas[c.name]=val;}
    const totalQty=Number.isFinite(Number(row[totalQtyIndex]))?numValue(row[totalQtyIndex]):Object.values(areas).reduce((a,v)=>a+number(v),0);
    const totalAmount=Number.isFinite(Number(row[totalAmountIndex]))?numValue(row[totalAmountIndex]):totalQty*tp;
    const resolved=resolveAreaCompany(item,tp,productIndex);
    if(resolved.status==='matched')newRows.push({id:uid(),importId,companyId:resolved.companyId,group:resolved.group,item,tp,areas,totalQty,totalAmount,matchType:resolved.matchType||'matched',matchSimilarity:resolved.similarity??100,matchedStockItem:resolved.item||''});
    else if(resolved.status==='ambiguous')ambiguousItems.push({
      item,tp,totalQty,totalAmount,
      reason:resolved.reason||'The item matches more than one company in Sales, Stock & Return data.'
    });
    else unmatchedItems.push({
      item,tp,totalQty,totalAmount,
      reason:resolved.reason||'No matching item was found in Sales, Stock & Return data.'
    });
  }
  const dedup=new Map();
  for(const r of newRows){const key=`${r.companyId}|${normalizeProductName(r.item)}|${number(r.tp).toFixed(2)}`;dedup.set(key,r);}
  const matchedRows=[...dedup.values()];
  db.areaWiseRows.push(...matchedRows);
  db.areaWiseImports.push({id:importId,filename,date:new Date().toISOString(),reportDate,meta,areaCodes,rows:parsedRows,matchedRows:matchedRows.length,unmatchedRows:unmatchedItems.length,ambiguousRows:ambiguousItems.length,unmatchedItems,ambiguousItems});
  saveDB();
  return{parsedRows,matchedRows:matchedRows.length,unmatchedRows:unmatchedItems.length,ambiguousRows:ambiguousItems.length,areas:areaCodes.length};
}
function areaImportIssueRecord(issue,status){
  if(issue&&typeof issue==='object')return{
    item:String(issue.item||'Unknown item'),
    tp:issue.tp,
    totalQty:issue.totalQty,
    totalAmount:issue.totalAmount,
    reason:String(issue.reason||'')
  };
  return{
    item:String(issue||'Unknown item'),
    tp:null,
    totalQty:null,
    totalAmount:null,
    reason:status==='ambiguous'
      ?'The item matches more than one company in Sales, Stock & Return data.'
      :'No matching item was found in Sales, Stock & Return data.'
  };
}
function areaIssueValue(value){
  return value===null||value===undefined||value===''?'-':money(value);
}
function renderAreaImportIssues(report,status){
  const isAmbiguous=status==='ambiguous';
  const count=Number(isAmbiguous?report.ambiguousRows:report.unmatchedRows)||0;
  if(!count)return'';
  const key=isAmbiguous?'ambiguousItems':'unmatchedItems';
  const saved=Array.isArray(report[key])?report[key]:[];
  const title=isAmbiguous?'Ambiguous':'Unmatched';
  const statusClass=isAmbiguous?'ambiguous':'unmatched';
  const rows=saved.map((issue,index)=>{
    const record=areaImportIssueRecord(issue,status);
    return `<tr><td>${index+1}</td><td class="issue-item-name">${escapeHtml(record.item)}</td><td>${areaIssueValue(record.tp)}</td><td>${areaIssueValue(record.totalQty)}</td><td>${areaIssueValue(record.totalAmount)}</td><td class="issue-reason">${escapeHtml(record.reason)}</td></tr>`;
  }).join('');
  const availabilityNote=saved.length<count
    ?`<div class="import-issue-note">This older import saved ${saved.length} of ${count} result details. Re-import the Area Wise file to store and display the complete list.</div>`
    :'';
  const emptyNote=!saved.length
    ?'<div class="import-issue-note">Details were not saved for this older import. Re-import the Area Wise file to display them.</div>'
    :'';
  return `<details class="import-issue-details ${statusClass}"><summary>View ${count} ${title.toLowerCase()} result${count===1?'':'s'}</summary>${availabilityNote}${emptyNote}${saved.length?`<div class="import-issue-table-wrap"><table class="import-issue-table"><thead><tr><th>#</th><th>Item</th><th>TP</th><th>TTL QTY</th><th>TTL AMT</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}</details>`;
}
function renderAreaWiseAdminImports(){
  const wrap=$('#areaWiseAdminImports');if(!wrap)return;
  const reports=[...db.areaWiseImports].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  wrap.innerHTML=reports.map(r=>`<div class="area-import-card area-import-card-stacked"><div class="area-import-summary-row"><div><strong>${escapeHtml(r.filename||'Area wise report')}</strong><div class="muted">${displayDate(r.reportDate||r.date)} • ${r.areaCodes?.length||0} areas • ${r.matchedRows??0} company-matched rows</div></div><div class="area-import-counts"><span class="badge active">Matched ${r.matchedRows??0}</span><span class="badge pending">Unmatched ${r.unmatchedRows??0}</span><span class="badge inactive">Ambiguous ${r.ambiguousRows??0}</span></div></div>${renderAreaImportIssues(r,'unmatched')}${renderAreaImportIssues(r,'ambiguous')}</div>`).join('')||'<p class="muted">No area-wise report has been imported.</p>';
}


/* Party-wise reporting */
function employeePartyReports(){
  if(!currentUser)return[];
  const ids=new Set(db.partyWiseRows.filter(r=>r.companyId===currentUser.companyId).map(r=>r.importId));
  return db.partyWiseImports.filter(i=>ids.has(i.id)).sort((a,b)=>String(b.reportDate||b.date).localeCompare(String(a.reportDate||a.date))||String(b.date).localeCompare(String(a.date)));
}
function getSelectedPartyReport(){return db.partyWiseImports.find(i=>i.id===selectedPartyReportId)||employeePartyReports()[0]||null;}
function partyKey(row){return `${row.partyCode||''}|${row.partyName||''}`;}
function partyLabel(row){return `${row.partyCode?`(${row.partyCode}) `:''}${row.partyName||'Unknown Party'}`.trim();}
function getEmployeePartyRows(){
  if(!currentUser)return[];
  let rows=db.partyWiseRows.filter(r=>r.companyId===currentUser.companyId&&(!selectedPartyReportId||r.importId===selectedPartyReportId));
  const q=$('#partyFilterSearch').value.trim().toLowerCase();
  const area=$('#partyFilterArea').value;
  const party=$('#partyFilterParty').value;
  const minQty=Number($('#partyFilterMinQty').value||-Infinity);
  rows=rows.filter(r=>(!q||r.item.toLowerCase().includes(q)||partyLabel(r).toLowerCase().includes(q))&&(!area||r.area===area)&&(!party||partyKey(r)===party)&&number(r.qty)>=minQty);
  return rows.sort((a,b)=>String(a.area).localeCompare(String(b.area))||partyLabel(a).localeCompare(partyLabel(b))||String(a.item).localeCompare(String(b.item)));
}
function renderPartyReportCards(){
  const from=$('#partyReportDateFrom').value,to=$('#partyReportDateTo').value;
  const reports=employeePartyReports().filter(r=>(!from||r.reportDate>=from)&&(!to||r.reportDate<=to));
  $('#employeePartyReportCards').innerHTML=reports.map(r=>{
    const rows=db.partyWiseRows.filter(x=>x.importId===r.id&&x.companyId===currentUser.companyId);
    const parties=new Set(rows.map(partyKey)).size;
    return `<button class="report-card ${r.id===selectedPartyReportId?'active':''}" data-party-report-id="${r.id}"><div class="report-date">${displayDate(r.reportDate||r.date)}</div><div class="report-range">${escapeHtml(r.meta?.from||'-')} to ${escapeHtml(r.meta?.to||'-')} • ${parties} parties</div><div class="report-file">${escapeHtml(r.filename||'Party wise report')}</div></button>`;
  }).join('')||'<div class="empty-state">No party-wise report is available for your company.</div>';
}
function refreshPartyReportContext(updateTable=true){
  const report=getSelectedPartyReport(),m=report?.meta||{};
  $('#partyReportDistributor').textContent=m.distributor||'TAWAKAL ENTERPRISES CHANNEL-II';
  $('#partyReportMeta').textContent=`From: ${m.from||'-'} To ${m.to||'-'}    Printed On: ${m.printedOn||'-'}`;
  const all=db.partyWiseRows.filter(r=>r.companyId===currentUser.companyId&&(!selectedPartyReportId||r.importId===selectedPartyReportId));
  const oldArea=$('#partyFilterArea').value,oldParty=$('#partyFilterParty').value;
  const areas=[...new Set(all.map(r=>r.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  $('#partyFilterArea').innerHTML='<option value="">All areas</option>'+areas.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  if(areas.includes(oldArea))$('#partyFilterArea').value=oldArea;
  const parties=[...new Map(all.map(r=>[partyKey(r),partyLabel(r)])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  $('#partyFilterParty').innerHTML='<option value="">All parties</option>'+parties.map(([key,label])=>`<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join('');
  if(parties.some(([key])=>key===oldParty))$('#partyFilterParty').value=oldParty;
  if(updateTable)updatePartyEmployeeTable();
}
function renderPartyWiseTable(rows,report){
  if(!report)return '<div class="empty-state">No party-wise report is available for your company.</div>';
  if(!rows.length)return '<div class="empty-state">No party-wise records match the selected filters.</div>';
  const grouped=new Map();
  rows.forEach(r=>{const key=`${r.area||''}|||${partyKey(r)}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);});
  const reportTotals=rows.reduce((a,r)=>({qty:a.qty+number(r.qty),bonus:a.bonus+number(r.bonus),tpAmount:a.tpAmount+number(r.tpAmount),netAmount:a.netAmount+number(r.netAmount)}),{qty:0,bonus:0,tpAmount:0,netAmount:0});
  const head=`<thead><tr><th rowspan="2">S#</th><th rowspan="2" class="party-item-head">ITEM</th><th rowspan="2">QTY</th><th rowspan="2">BONUS</th><th rowspan="2">BATCH</th><th rowspan="2">TP</th><th rowspan="2">ST</th><th colspan="2">DISCOUNT</th><th colspan="2">AMOUNT</th></tr><tr><th>%</th><th>AMT</th><th>TP</th><th>NET</th></tr></thead>`;
  let body='';let groupIndex=0;
  for(const part of grouped.values()){
    groupIndex++;
    const first=part[0],totals=part.reduce((a,r)=>({qty:a.qty+number(r.qty),bonus:a.bonus+number(r.bonus),tpAmount:a.tpAmount+number(r.tpAmount),netAmount:a.netAmount+number(r.netAmount)}),{qty:0,bonus:0,tpAmount:0,netAmount:0});
    body+=`<tr class="party-info-row"><td colspan="11"><strong>Invoice# &amp; Date:</strong> — &nbsp;&nbsp; <strong>Return# &amp; Date:</strong> — &nbsp;&nbsp; <strong>Party:</strong> ${escapeHtml(partyLabel(first))}</td></tr>`;
    part.forEach((r,i)=>{body+=`<tr><td>${i+1}</td><td class="item-cell">${escapeHtml(r.item)}</td><td>${money(r.qty)}</td><td>${money(r.bonus)}</td><td></td><td>${money(r.unitTp)}</td><td>—</td><td>—</td><td>—</td><td>${money(r.tpAmount)}</td><td>${money(r.netAmount)}</td></tr>`;});
    body+=`<tr class="party-total-row"><td colspan="2">Invoice#: — Total</td><td>${money(totals.qty)}</td><td>${money(totals.bonus)}</td><td colspan="4"></td><td>—</td><td>${money(totals.tpAmount)}</td><td>${money(totals.netAmount)}</td></tr>`;
  }
  body+=`<tr class="party-grand-total"><td colspan="2">Grand Total</td><td>${money(reportTotals.qty)}</td><td>${money(reportTotals.bonus)}</td><td colspan="4"></td><td>—</td><td>${money(reportTotals.tpAmount)}</td><td>${money(reportTotals.netAmount)}</td></tr>`;
  return `<div class="table-scroll-shell"><div class="table-scroll-top"><div class="table-scroll-top-inner"></div></div><div class="table-wrap"><table class="data-table party-data-table">${head}<tbody>${body}</tbody></table></div></div>`;
}
function updatePartyEmployeeTable(){
  const report=getSelectedPartyReport(),rows=getEmployeePartyRows();
  const totals=rows.reduce((a,r)=>({qty:a.qty+number(r.qty),amount:a.amount+number(r.netAmount)}),{qty:0,amount:0});
  const parties=new Set(rows.map(partyKey)).size;
  if(employeeReportMode==='party')$('#employeeStats').innerHTML=[['Products',rows.length],['Parties',parties],['Total Qty',money(totals.qty)],['Net Amount',money(totals.amount)]].map(([l,v])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#employeePartyTableWrap').innerHTML=renderPartyWiseTable(rows,report);initTopScrollbars();
}
['partyFilterSearch','partyFilterArea','partyFilterParty','partyFilterMinQty'].forEach(id=>$('#'+id).addEventListener('input',()=>{if(id==='partyFilterArea')refreshPartyReportContext(false);updatePartyEmployeeTable();}));
$('#partyReportDateFrom').addEventListener('input',renderPartyReportCards);
$('#partyReportDateTo').addEventListener('input',renderPartyReportCards);
$('#resetPartyReportDates').addEventListener('click',()=>{$('#partyReportDateFrom').value='';$('#partyReportDateTo').value='';renderPartyReportCards();});
$('#resetPartyFilters').addEventListener('click',()=>{$('#partyFilterSearch').value='';$('#partyFilterArea').value='';$('#partyFilterParty').value='';$('#partyFilterMinQty').value='';refreshPartyReportContext();});
document.addEventListener('click',e=>{const card=e.target.closest('[data-party-report-id]');if(card){selectedPartyReportId=card.dataset.partyReportId;renderPartyReportCards();refreshPartyReportContext();window.scrollTo({top:document.querySelector('#employeePartyReporting .filter-panel').offsetTop-75,behavior:'smooth'});}});
function partyTxtReport(){
  const report=getSelectedPartyReport(),rows=getEmployeePartyRows();
  if(!rows.length)return null;
  const m=report?.meta||{};
  const lines=[
    m.distributor||'TAWAKAL ENTERPRISES CHANNEL-II',
    'PARTY WISE SALES REPORT',
    `COMPANY: ${companyName(currentUser.companyId)}`,
    `FROM: ${m.from||'-'}   TO: ${m.to||'-'}   REPORT DATE: ${displayDate(report?.reportDate)}`,
    ''
  ];
  const grouped=new Map();
  rows.forEach(r=>{const key=`${r.area||''}|||${partyKey(r)}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);});
  let grand={qty:0,bonus:0,tpAmount:0,netAmount:0};
  for(const part of grouped.values()){
    const first=part[0];
    lines.push(`AREA: ${first.area||'-'}`);
    lines.push(`PARTY: ${partyLabel(first)}`);
    lines.push(['S#','ITEM','QTY','BONUS','BATCH','TP','ST','DISC %','DISC AMT','TP AMOUNT','NET'].join('\t'));
    const totals={qty:0,bonus:0,tpAmount:0,netAmount:0};
    part.forEach((r,i)=>{
      totals.qty+=number(r.qty);totals.bonus+=number(r.bonus);totals.tpAmount+=number(r.tpAmount);totals.netAmount+=number(r.netAmount);
      lines.push([i+1,r.item,money(r.qty),money(r.bonus),'',money(r.unitTp),'','','',money(r.tpAmount),money(r.netAmount)].join('\t'));
    });
    grand.qty+=totals.qty;grand.bonus+=totals.bonus;grand.tpAmount+=totals.tpAmount;grand.netAmount+=totals.netAmount;
    lines.push(['','PARTY TOTAL',money(totals.qty),money(totals.bonus),'','','','','',money(totals.tpAmount),money(totals.netAmount)].join('\t'));
    lines.push('');
  }
  lines.push(['','GRAND TOTAL',money(grand.qty),money(grand.bonus),'','','','','',money(grand.tpAmount),money(grand.netAmount)].join('\t'));
  return lines.join('\n');
}
function buildPartyPdfDoc(){
  const report=getSelectedPartyReport(),rows=getEmployeePartyRows(),jsPDF=window.jspdf?.jsPDF;
  if(!rows.length){toast('No records available');return null;}
  if(!jsPDF||typeof jsPDF!=='function'){toast('PDF engine is not available');return null;}
  try{
    const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
    doc.setFontSize(15);doc.text('PARTY WISE SALES REPORT',28,30);
    doc.setFontSize(8);doc.text(`${companyName(currentUser.companyId)} • ${displayDate(report?.reportDate)}`,28,44);
    if(typeof doc.autoTable!=='function')return null;
    const grouped=new Map();
    rows.forEach(r=>{const key=`${r.area||''}|||${partyKey(r)}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);});
    const body=[];let grand={qty:0,bonus:0,tpAmount:0,netAmount:0};
    for(const part of grouped.values()){
      const first=part[0],totals={qty:0,bonus:0,tpAmount:0,netAmount:0};
      body.push([{content:`Area: ${first.area||'-'}    Party: ${partyLabel(first)}`,colSpan:11,styles:{fontStyle:'bold',halign:'left',fillColor:[245,245,245]}}]);
      part.forEach((r,i)=>{
        totals.qty+=number(r.qty);totals.bonus+=number(r.bonus);totals.tpAmount+=number(r.tpAmount);totals.netAmount+=number(r.netAmount);
        body.push([i+1,r.item,money(r.qty),money(r.bonus),'',money(r.unitTp),'','','',money(r.tpAmount),money(r.netAmount)]);
      });
      grand.qty+=totals.qty;grand.bonus+=totals.bonus;grand.tpAmount+=totals.tpAmount;grand.netAmount+=totals.netAmount;
      body.push([{content:'Party Total',colSpan:2,styles:{fontStyle:'bold'}},money(totals.qty),money(totals.bonus),{content:'',colSpan:5},money(totals.tpAmount),money(totals.netAmount)]);
    }
    body.push([{content:'Grand Total',colSpan:2,styles:{fontStyle:'bold',fillColor:[235,235,235]}},money(grand.qty),money(grand.bonus),{content:'',colSpan:5,styles:{fillColor:[235,235,235]}},money(grand.tpAmount),money(grand.netAmount)]);
    doc.autoTable({
      startY:54,
      head:[['S#','ITEM','QTY','BONUS','BATCH','TP','ST','DISC %','DISC AMT','TP AMOUNT','NET']],
      body,
      styles:{fontSize:4.1,cellPadding:1.2,overflow:'linebreak'},
      headStyles:{fillColor:[31,95,153]},
      theme:'grid',margin:{left:18,right:18},
      columnStyles:{1:{cellWidth:135,halign:'left'}}
    });
    return doc;
  }catch(err){console.error(err);toast('Could not create PDF');return null;}
}
$('#previewPartyTxt').addEventListener('click',()=>{const text=partyTxtReport();if(!text)return toast('No records available');openTextPreview(`${companyName(currentUser.companyId)} Party Wise Report`,text);});
$('#downloadPartyTxt').addEventListener('click',()=>{const text=partyTxtReport();if(!text)return toast('No records available');const report=getSelectedPartyReport();downloadBlob(text,'text/plain;charset=utf-8',`${safeReportFileName(companyName(currentUser.companyId))}-${report?.reportDate||'party-wise-report'}.txt`);});
$('#previewPartyPdf').addEventListener('click',()=>openPdfPreview(buildPartyPdfDoc()));
$('#downloadPartyPdf').addEventListener('click',()=>{const doc=buildPartyPdfDoc();if(doc){const report=getSelectedPartyReport();doc.save(`${safeReportFileName(companyName(currentUser.companyId))}-${report?.reportDate||'party-wise-report'}.pdf`);}});

function renderPartyWiseAdminImports(){
  const wrap=$('#partyWiseAdminImports');if(!wrap)return;
  const reports=[...db.partyWiseImports].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  wrap.innerHTML=reports.map(r=>`<div class="area-import-card"><div><strong>${escapeHtml(r.filename||'Party wise report')}</strong><div class="muted">${displayDate(r.reportDate||r.date)} • ${r.areas??0} areas • ${r.parties??0} parties • ${r.matchedRows??0} matched rows</div></div><div class="area-import-counts"><span class="badge active">Matched ${r.matchedRows??0}</span><span class="badge pending">Unmatched ${r.unmatchedRows??0}</span><span class="badge inactive">Ambiguous ${r.ambiguousRows??0}</span></div></div>`).join('')||'<p class="muted">No party-wise report has been imported.</p>';
}
function isPartyAreaHeading(line){
  const t=String(line.text||'').trim();if(!t||t.length>50)return false;
  if(/Total:|SALE REPORT|Comapny:|Company:|Printed On:|Software By:|ITEM|S#|QTY|BONUS|AMOUNT/i.test(t))return false;
  if(/^\(\d+\)/.test(t)||/^[-+]?\d+\s+/.test(t))return false;
  if(line.words.some(w=>w.x>350&&numericText(w.text)))return false;
  return t===t.toUpperCase()&&/[A-Z]/.test(t)&&Number(line.words[0]?.x||999)<120;
}
function parsePartyWisePages(pages,filename){
  const productIndex=buildAreaProductIndex();
  const importId=uid(),rawRows=[],unmatchedItems=[],ambiguousItems=[];
  let currentArea='',currentPartyCode='',currentPartyName='';
  let fullText='';
  for(const page of pages){
    const lines=pageLines(page);fullText+=lines.map(l=>l.text).join('\n')+'\n';
    for(const line of lines){
      const text=String(line.text||'').replace(/\s+/g,' ').trim();if(!text||isPdfNoiseText(text))continue;
      const partyMatch=text.match(/^\((\d+)\)\s+(.+)$/);
      if(partyMatch){currentPartyCode=partyMatch[1];currentPartyName=partyMatch[2].trim();continue;}
      if(isPartyAreaHeading(line)){currentArea=text;continue;}
      const serial=line.words.find(w=>w.x<50&&/^\d+$/.test(w.text));
      if(!serial||!currentPartyCode)continue;
      const item=line.words.filter(w=>w.x>=48&&w.x<360).map(w=>w.text).join(' ').replace(/\s+/g,' ').trim();
      if(!item)continue;
      const qty=firstNumber(line.words,360,405),bonus=firstNumber(line.words,405,435),tpAmount=firstNumber(line.words,435,505),netAmount=firstNumber(line.words,505,590);
      const unitTp=qty!==0?Math.abs(tpAmount/qty):0;
      const resolved=resolveAreaCompany(item,unitTp,productIndex);
      const base={id:uid(),importId,area:currentArea,partyCode:currentPartyCode,partyName:currentPartyName,item,qty,bonus,unitTp:Number(unitTp.toFixed(2)),tpAmount,netAmount};
      if(resolved.status==='matched')rawRows.push({...base,companyId:resolved.companyId,group:resolved.group,matchType:resolved.matchType||'matched',matchSimilarity:resolved.similarity??100,matchedStockItem:resolved.item||''});
      else if(resolved.status==='ambiguous')ambiguousItems.push({item,partyCode:currentPartyCode,tp:unitTp,reason:resolved.reason||'The item matches more than one company.'});
      else unmatchedItems.push({item,partyCode:currentPartyCode,tp:unitTp,reason:resolved.reason||'No matching Stock & Sales item was found.'});
    }
  }
  const printed=(fullText.match(/Printed\s*On\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[])[1]||new Date().toLocaleDateString('en-GB');
  const range=fullText.match(/From\s*:\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\s*To\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)||[];
  const distributor=(fullText.match(/([A-Z][A-Z .,&'-]+ENTERPRISES[A-Z0-9 .,&'-]*)\s+SALE\s+REPORT/i)||[])[1]?.trim()||'TAWAKAL ENTERPRISES CHANNEL-II';
  const meta={distributor,from:range[1]||'-',to:range[2]||'-',printedOn:printed};
  const reportDate=toIsoDate(printed)||toIsoDate(meta.to)||new Date().toISOString().slice(0,10);
  const dedup=new Map();
  for(const r of rawRows){const key=[r.companyId,r.area,r.partyCode,normalizeProductName(r.item),r.qty,r.bonus,number(r.tpAmount).toFixed(2),number(r.netAmount).toFixed(2)].join('|');dedup.set(key,r);}
  const matchedRows=[...dedup.values()];
  db.partyWiseRows.push(...matchedRows);
  db.partyWiseImports.push({id:importId,filename,date:new Date().toISOString(),reportDate,meta,rows:matchedRows.length,areas:new Set(matchedRows.map(r=>r.area)).size,parties:new Set(matchedRows.map(partyKey)).size,matchedRows:matchedRows.length,unmatchedRows:unmatchedItems.length,ambiguousRows:ambiguousItems.length,unmatchedItems:unmatchedItems.slice(0,50),ambiguousItems:ambiguousItems.slice(0,50)});
  saveDB();
  return{matchedRows:matchedRows.length,unmatchedRows:unmatchedItems.length,ambiguousRows:ambiguousItems.length,areas:new Set(matchedRows.map(r=>r.area)).size,parties:new Set(matchedRows.map(partyKey)).size};
}
async function readPdfFilePages(file,progress,prefix='Reading page'){
  const pdfjsLib=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const bytes=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjsLib.getDocument({data:bytes}).promise;const pages=[];
  for(let i=1;i<=pdf.numPages;i++){progress.textContent=`${prefix} ${i} of ${pdf.numPages}...`;const page=await pdf.getPage(i);const viewport=page.getViewport({scale:1});const tc=await page.getTextContent();pages.push({pageNumber:i,height:viewport.height,items:tc.items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5],width:x.width||0}))});}
  return pages;
}
function stockCsvHeaderIndex(matrix){
  return matrix.findIndex(row=>{
    const names=(row||[]).map(normalizedColumnName);
    return names.includes('ITEM')&&names.some(v=>['RATE','TP','TRADE PRICE'].includes(v));
  });
}
function importStockCsvMatrix(matrix,filename){
  const headerIndex=stockCsvHeaderIndex(matrix);
  if(headerIndex<0)throw new Error('CSV header must contain ITEM and RATE/TP columns');
  const header=matrix[headerIndex]||[];
  const col={
    company:findCsvColumn(header,['COMPANY','COMPANY NAME']),group:findCsvColumn(header,['GROUP','GROUP NAME']),item:findCsvColumn(header,['ITEM','ITEM NAME','PRODUCT','PRODUCT NAME']),rate:findCsvColumn(header,['RATE','TP','TRADE PRICE']),
    open:findCsvColumn(header,['OPEN','OPENING','OPENING QTY','OPENING STOCK']),received:findCsvColumn(header,['RCVD','RECEIVED','RECEIVED QTY']),total:findCsvColumn(header,['TOTAL','TOTAL QTY']),transferred:findCsvColumn(header,['TRANSFERRED','TRANSFER','TRANSFER QTY']),lastMonth:findCsvColumn(header,['LAST MONTH','LAST MONTH SALE']),
    saleQty:findCsvColumn(header,['SALE QTY','SALES QTY','QUANTITY SOLD']),saleBonus:findCsvColumn(header,['SALE BONUS','SALES BONUS']),returnQty:findCsvColumn(header,['RETURN QTY','RET QTY']),returnBonus:findCsvColumn(header,['RETURN BONUS','RET BONUS']),netSaleQty:findCsvColumn(header,['NET SALE QTY','NET SALES QTY']),netSaleBonus:findCsvColumn(header,['NET SALE BONUS','NET SALES BONUS']),netSaleAmount:findCsvColumn(header,['NET SALE AMOUNT','NET SALES AMOUNT','NET AMOUNT']),closingQty:findCsvColumn(header,['CLOSING QTY','CLOSE QTY','CLOSING STOCK']),closingAmount:findCsvColumn(header,['CLOSING AMOUNT','CLOSING AMT','CLOSE AMOUNT']),reportDate:findCsvColumn(header,['REPORT DATE','PRINTED ON','DATE'])
  };
  const rawRows=[];let currentCompany='',currentGroup='';
  for(let i=headerIndex+1;i<matrix.length;i++){
    const row=matrix[i]||[],joined=row.filter(v=>String(v||'').trim()).join(' ').replace(/\s+/g,' ').trim();
    const section=parseGroupLine(joined);if(section){currentCompany=section.company;currentGroup=section.group;continue;}
    if(row.map(normalizedColumnName).join('|')===header.map(normalizedColumnName).join('|'))continue;
    const company=String(col.company>=0?row[col.company]||'':currentCompany).trim().toUpperCase();
    const item=cleanImportedItem(row[col.item]);
    const rate=numValue(row[col.rate]);
    if(!company||!item||rate<=0||/^(TOTAL|GRAND TOTAL|ITEM)$/i.test(item)||isPdfNoiseText(item))continue;
    rawRows.push({
      company,group:String(col.group>=0?row[col.group]||'':currentGroup).trim()||'UNASSIGNED',item,rate,
      open:col.open>=0?numValue(row[col.open]):0,received:col.received>=0?numValue(row[col.received]):0,total:col.total>=0?numValue(row[col.total]):0,transferred:col.transferred>=0?numValue(row[col.transferred]):0,lastMonth:col.lastMonth>=0?numValue(row[col.lastMonth]):0,
      saleQty:col.saleQty>=0?numValue(row[col.saleQty]):0,saleBonus:col.saleBonus>=0?numValue(row[col.saleBonus]):0,returnQty:col.returnQty>=0?numValue(row[col.returnQty]):0,returnBonus:col.returnBonus>=0?numValue(row[col.returnBonus]):0,netSaleQty:col.netSaleQty>=0?numValue(row[col.netSaleQty]):0,netSaleBonus:col.netSaleBonus>=0?numValue(row[col.netSaleBonus]):0,netSaleAmount:col.netSaleAmount>=0?numValue(row[col.netSaleAmount]):0,closingQty:col.closingQty>=0?numValue(row[col.closingQty]):0,closingAmount:col.closingAmount>=0?numValue(row[col.closingAmount]):0,
      sourceDate:col.reportDate>=0?String(row[col.reportDate]||''):''
    });
  }
  if(!rawRows.length)throw new Error('No valid stock rows were found in the CSV');
  const text=matrixText(matrix),baseMeta=reportMetaFromText(text,'ARBY ENTERPRISES, HYDERABAD');
  const csvDate=rawRows.map(r=>r.sourceDate).find(toIsoDate)||'';
  const meta={...baseMeta,printedOn:baseMeta.printedOn||csvDate};
  const importId=uid(),reportDate=toIsoDate(csvDate)||toIsoDate(meta.printedOn)||toIsoDate(meta.to)||new Date().toISOString().slice(0,10);
  const companyMap=new Map(db.companies.map(c=>[c.name,c]));let companiesAdded=0,rowsAdded=0;
  const dedup=new Map();
  for(const r of rawRows){const key=[r.company,r.group,r.item,r.rate].join('|').toUpperCase();dedup.set(key,r);}
  for(const r of dedup.values()){
    let company=companyMap.get(r.company);
    if(!company){company={id:uid(),name:r.company,active:true};db.companies.push(company);companyMap.set(r.company,company);companiesAdded++;}
    db.stock.push({id:uid(),importId,companyId:company.id,group:r.group,item:r.item,rate:r.rate,open:r.open,received:r.received,total:r.total,transferred:r.transferred,lastMonth:r.lastMonth,saleQty:r.saleQty,saleBonus:r.saleBonus,returnQty:r.returnQty,returnBonus:r.returnBonus,netSaleQty:r.netSaleQty,netSaleBonus:r.netSaleBonus,netSaleAmount:r.netSaleAmount,closingQty:r.closingQty,closingAmount:r.closingAmount});rowsAdded++;
  }
  const groupsDetected=new Set([...dedup.values()].map(r=>`${r.company}|${r.group}`)).size;
  db.reportMeta=meta;db.imports.push({id:importId,filename,date:new Date().toISOString(),reportDate,meta,groups:groupsDetected,rows:rowsAdded,format:'csv'});saveDB();
  return{companiesAdded,rowsAdded,groupsDetected};
}
function areaHeaderCellsFromLine(line){
  const words=[...(line?.words||[])].sort((a,b)=>a.x-b.x),cells=[];
  for(let i=0;i<words.length;i++){
    const token=String(words[i].text||'').trim();if(!token)continue;
    if(/^TTL$/i.test(token)&&/^(QTY|AMT)$/i.test(String(words[i+1]?.text||''))){
      const next=words[++i];cells.push({label:`TTL ${String(next.text).toUpperCase()}`,x:(words[i-1].x+next.x)/2,width:(next.x+(next.width||0))-words[i-1].x});
    }else cells.push({label:token,x:words[i].x,width:words[i].width||0});
  }
  return cells;
}
function areaPdfPagesToMatrix(pages){
  const metaRows=[];const parsed=[];const union=[];
  for(const page of pages){
    const lines=pageLines(page);
    const headerLine=lines.find(line=>/\bITEM\b/i.test(line.text)&&/TTL\s*QTY/i.test(line.text)&&/TTL\s*AMT/i.test(line.text));
    if(!headerLine)continue;
    if(!metaRows.length)lines.filter(l=>l.top<headerLine.top).slice(0,8).forEach(l=>metaRows.push([l.text]));
    const cells=areaHeaderCellsFromLine(headerLine);
    const itemIndex=cells.findIndex(c=>normalizedColumnName(c.label)==='ITEM');
    const qtyIndex=cells.findIndex(c=>normalizedColumnName(c.label)==='TTL QTY');
    const amtIndex=cells.findIndex(c=>normalizedColumnName(c.label)==='TTL AMT');
    if(itemIndex<0||qtyIndex<0||amtIndex<0)continue;
    const ordered=cells.slice(itemIndex,amtIndex+1);
    const centers=ordered.map(c=>c.x+(c.width||0)/2),bounds=[];
    for(let i=0;i<centers.length-1;i++)bounds.push((centers[i]+centers[i+1])/2);
    const labels=ordered.map(c=>c.label.trim());labels.forEach(label=>{if(!union.includes(label))union.push(label);});
    for(const line of lines){
      if(line.top<=headerLine.top+1||isPdfNoiseText(line.text)||/ITEM SALES STATISTICS|COMPANY:|STATION:|Printed On:|Page No/i.test(line.text))continue;
      if(/^(Software By:|TAWAKAL ENTERPRISES)/i.test(line.text))continue;
      const buckets=labels.map(()=>[]);
      for(const w of line.words){
        let ci=0;while(ci<bounds.length&&w.x>=bounds[ci])ci++;
        if(ci>=0&&ci<buckets.length)buckets[ci].push(w.text);
      }
      const item=String(buckets[0].join(' ')).replace(/\s+/g,' ').trim();
      if(!item||/^ITEM$/i.test(item))continue;
      const values={};values[labels[0]]=item;
      for(let i=1;i<labels.length;i++)values[labels[i]]=buckets[i].length?numValue(buckets[i].join('')):null;
      if(!/^G\s*TTL\s*AMT$/i.test(item)&&!extractAreaTp(item)&&values['TTL QTY']===null&&values['TTL AMT']===null)continue;
      parsed.push(values);
    }
  }
  if(!parsed.length)throw new Error('No Area Wise table rows were found in the PDF');
  const normalizedUnion=['ITEM',...union.filter(x=>normalizedColumnName(x)!=='ITEM'&&normalizedColumnName(x)!=='TTL QTY'&&normalizedColumnName(x)!=='TTL AMT'),'TTL QTY','TTL AMT'];
  const matrix=[...metaRows,normalizedUnion];
  parsed.forEach(values=>matrix.push(normalizedUnion.map(label=>values[label]??'')));
  return matrix;
}
function partyCsvHeaderIndex(matrix){
  return matrix.findIndex(row=>{const names=(row||[]).map(normalizedColumnName);return names.includes('ITEM')&&names.some(v=>v==='QTY'||v==='QUANTITY')&&names.some(v=>v==='NET'||v==='NET AMOUNT');});
}
function importPartyWiseCsvMatrix(matrix,filename){
  const headerIndex=partyCsvHeaderIndex(matrix);if(headerIndex<0)throw new Error('CSV header must contain ITEM, QTY and NET AMOUNT columns');
  const header=matrix[headerIndex]||[];
  const col={area:findCsvColumn(header,['AREA','AREA NAME']),partyCode:findCsvColumn(header,['PARTY CODE','CODE']),party:findCsvColumn(header,['PARTY','PARTY NAME','CUSTOMER','CUSTOMER NAME']),item:findCsvColumn(header,['ITEM','ITEM NAME','PRODUCT']),qty:findCsvColumn(header,['QTY','QUANTITY']),bonus:findCsvColumn(header,['BONUS','BONUS QTY']),unitTp:header.map(normalizedColumnName).findIndex(v=>['TP','UNIT TP','RATE','TRADE PRICE'].includes(v)),tpAmount:findCsvColumn(header,['TP AMOUNT','TP AMT','AMOUNT TP']),netAmount:findCsvColumn(header,['NET AMOUNT','NET']),reportDate:findCsvColumn(header,['REPORT DATE','PRINTED ON','DATE'])};
  const productIndex=buildAreaProductIndex(),importId=uid(),rawRows=[],unmatchedItems=[],ambiguousItems=[];
  let currentArea='',currentPartyCode='',currentPartyName='';
  for(let i=headerIndex+1;i<matrix.length;i++){
    const row=matrix[i]||[],first=String(row[0]||'').trim(),joined=row.filter(v=>String(v||'').trim()).join(' ').trim();
    if(!joined)continue;
    if(row.map(normalizedColumnName).join('|')===header.map(normalizedColumnName).join('|'))continue;
    const heading=first.match(/^\((\d+)\)\s+(.+)$/);if(heading&&(!row[col.item]||String(row[col.item]).trim()==='')){currentPartyCode=heading[1];currentPartyName=heading[2].trim();continue;}
    if(col.area<0&&joined===joined.toUpperCase()&&!/TOTAL|ITEM|QTY|BONUS|AMOUNT/.test(joined)){currentArea=joined;currentPartyCode='';currentPartyName='';continue;}
    let partyText=col.party>=0?String(row[col.party]||'').trim():currentPartyName;
    let partyCode=col.partyCode>=0?String(row[col.partyCode]||'').replace(/[()]/g,'').trim():currentPartyCode;
    const embedded=partyText.match(/^\((\d+)\)\s+(.+)$/);if(embedded){partyCode=partyCode||embedded[1];partyText=embedded[2].trim();}
    const area=col.area>=0?String(row[col.area]||'').trim():currentArea;
    const item=cleanImportedItem(row[col.item]);if(!item||/TOTAL$/i.test(item)||/^(ITEM|GRAND TOTAL)$/i.test(item))continue;
    const qty=numValue(row[col.qty]),bonus=col.bonus>=0?numValue(row[col.bonus]):0;
    let unitTp=col.unitTp>=0?numValue(row[col.unitTp]):0;
    let tpAmount=col.tpAmount>=0?numValue(row[col.tpAmount]):0;
    if(!tpAmount&&unitTp)tpAmount=qty*unitTp;if(!unitTp&&qty)unitTp=Math.abs(tpAmount/qty);
    const netAmount=col.netAmount>=0?numValue(row[col.netAmount]):tpAmount;
    const resolved=resolveAreaCompany(item,unitTp,productIndex),base={id:uid(),importId,area,partyCode,partyName:partyText||'Unknown Party',item,qty,bonus,unitTp:Number(unitTp.toFixed(2)),tpAmount,netAmount,sourceDate:col.reportDate>=0?String(row[col.reportDate]||''):''};
    if(resolved.status==='matched')rawRows.push({...base,companyId:resolved.companyId,group:resolved.group,matchType:resolved.matchType||'matched',matchSimilarity:resolved.similarity??100,matchedStockItem:resolved.item||''});else if(resolved.status==='ambiguous')ambiguousItems.push({item,partyCode,tp:unitTp,reason:resolved.reason||'The item matches more than one company.'});else unmatchedItems.push({item,partyCode,tp:unitTp,reason:resolved.reason||'No matching Stock & Sales item was found.'});
  }
  const text=matrixText(matrix),meta=reportMetaFromText(text,'TAWAKAL ENTERPRISES CHANNEL-II'),csvDate=rawRows.map(r=>r.sourceDate).find(toIsoDate)||'';
  const reportDate=toIsoDate(csvDate)||toIsoDate(meta.printedOn)||toIsoDate(meta.to)||new Date().toISOString().slice(0,10);
  const dedup=new Map();for(const r of rawRows){const key=[r.companyId,r.area,r.partyCode,normalizeProductName(r.item),r.qty,r.bonus,number(r.tpAmount).toFixed(2),number(r.netAmount).toFixed(2)].join('|');dedup.set(key,r);}
  const matchedRows=[...dedup.values()];db.partyWiseRows.push(...matchedRows);
  db.partyWiseImports.push({id:importId,filename,date:new Date().toISOString(),reportDate,meta,rows:matchedRows.length,areas:new Set(matchedRows.map(r=>r.area)).size,parties:new Set(matchedRows.map(partyKey)).size,matchedRows:matchedRows.length,unmatchedRows:unmatchedItems.length,ambiguousRows:ambiguousItems.length,unmatchedItems:unmatchedItems.slice(0,50),ambiguousItems:ambiguousItems.slice(0,50),format:'csv'});saveDB();
  return{matchedRows:matchedRows.length,unmatchedRows:unmatchedItems.length,ambiguousRows:ambiguousItems.length,areas:new Set(matchedRows.map(r=>r.area)).size,parties:new Set(matchedRows.map(partyKey)).size};
}

$('#extractPartyWiseBtn').addEventListener('click',async()=>{
  const file=$('#partyWiseFile').files[0];if(!file)return toast('Select a Party Wise PDF or CSV file first');
  const progress=$('#partyWiseProgress');
  try{
    let summary;
    if(isPdfUpload(file)){
      progress.textContent='Loading PDF engine...';
      const pages=await readPdfFilePages(file,progress,'Reading party report page');
      progress.textContent='Matching party items with company stock data...';
      summary=parsePartyWisePages(pages,file.name);
    }else if(isCsvUpload(file)){
      progress.textContent='Reading Party Wise CSV...';
      const matrix=await readCsvMatrix(file);
      progress.textContent='Matching party items with company stock data...';
      summary=importPartyWiseCsvMatrix(matrix,file.name);
    }else throw new Error('Unsupported Party Wise file format');
    progress.textContent='Import complete.';
    $('#partyWiseSummary').innerHTML=`<div class="demo-box"><strong>${summary.matchedRows}</strong> rows matched to companies<br><strong>${summary.unmatchedRows}</strong> rows could not be matched<br><strong>${summary.ambiguousRows}</strong> rows matched more than one company<br><strong>${summary.parties}</strong> parties across <strong>${summary.areas}</strong> areas</div>${summary.matchedRows===0?'<div class="warning-box">No company rows were matched. Import the Sales, Stock & Return report first, then upload this Party Wise report again.</div>':''}`;
    renderAdmin();toast(`Party-wise ${uploadExtension(file).toUpperCase()} processed successfully`);
  }catch(err){console.error(err);progress.textContent=`Import failed. ${err.message||'Use the supplied Party Wise PDF or a CSV with Area, Party, Item, Qty, Bonus, TP Amount and Net Amount columns.'}`;toast('Could not import Party Wise report');}
});

$('#extractAreaWiseBtn').addEventListener('click',async()=>{
  const file=$('#areaWiseFile').files[0];if(!file)return toast('Select an Area Wise PDF or CSV file first');
  const progress=$('#areaWiseProgress');
  try{
    let matrix;
    if(isPdfUpload(file)){
      progress.textContent='Loading PDF engine...';
      const pages=await readPdfFilePages(file,progress,'Reading area report page');
      progress.textContent='Converting the Area Wise PDF table...';
      matrix=areaPdfPagesToMatrix(pages);
    }else if(isCsvUpload(file)){
      progress.textContent='Reading Area Wise CSV...';matrix=await readCsvMatrix(file);
    }else if(isExcelUpload(file)){
      progress.textContent='Reading Area Wise Excel report...';
      if(!window.XLSX)throw new Error('Excel library is not available');
      const bytes=await file.arrayBuffer(),workbook=window.XLSX.read(bytes,{type:'array'}),sheet=workbook.Sheets[workbook.SheetNames[0]];
      matrix=window.XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null});
    }else throw new Error('Unsupported Area Wise file format');
    progress.textContent='Matching products with company stock data...';
    const summary=importAreaWiseMatrix(matrix,file.name);
    progress.textContent='Import complete.';
    $('#areaWiseSummary').innerHTML=`<div class="demo-box"><strong>${summary.matchedRows}</strong> rows matched to companies<br><strong>${summary.unmatchedRows}</strong> rows could not be matched<br><strong>${summary.ambiguousRows}</strong> rows matched more than one company<br><strong>${summary.areas}</strong> area columns detected</div>${summary.unmatchedRows||summary.ambiguousRows?'<div class="info-box">Open the imported report below to view every unmatched and ambiguous item with TP, total quantity, total amount, and the matching reason.</div>':''}${summary.matchedRows===0?'<div class="warning-box">No company rows were matched. Import the Sales, Stock & Return report first, then upload this Area Wise report again.</div>':''}`;
    renderAdmin();toast(`Area-wise ${uploadExtension(file).toUpperCase()} processed successfully`);
  }catch(err){console.error(err);progress.textContent=`Import failed. ${err.message||'Use the same Area Wise table layout in PDF or CSV format.'}`;toast('Could not import Area Wise report');}
});

$('#extractPdfBtn').addEventListener('click',async()=>{
  const file=$('#pdfFile').files[0];if(!file)return toast('Select a Sales, Stock & Return PDF or CSV file first');
  const progress=$('#importProgress');
  try{
    let summary;
    if(isPdfUpload(file)){
      progress.textContent='Loading PDF engine...';
      const pages=await readPdfFilePages(file,progress,'Reading stock report page');
      progress.textContent='Converting table rows to stock data...';
      summary=importPdfPages(pages,file.name);
    }else if(isCsvUpload(file)){
      progress.textContent='Reading Sales, Stock & Return CSV...';
      summary=importStockCsvMatrix(await readCsvMatrix(file),file.name);
    }else throw new Error('Unsupported Sales, Stock & Return file format');
    progress.textContent='Import complete.';
    $('#importSummary').innerHTML=`<div class="demo-box"><strong>${summary.companiesAdded}</strong> new companies detected<br><strong>${summary.rowsAdded}</strong> stock rows imported<br><strong>${summary.groupsDetected}</strong> groups detected</div>`;
    renderAdmin();toast(`${uploadExtension(file).toUpperCase()} processed successfully`);
  }catch(err){console.error(err);progress.textContent=`Import failed. ${err.message||'Use the supplied text-based PDF or a CSV with Company, Group, Item and Rate/TP columns.'}`;toast('Could not import Sales, Stock & Return report');}
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
