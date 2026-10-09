let items = [];
let currentUser = null;
let authToken = localStorage.getItem('securioToken') || '';
let authMode = 'login';

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && authToken) {
    authToken = ''; currentUser = null; localStorage.removeItem('securioToken'); showAuth();
  }
  return response;
}
function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}
function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('signedInName').textContent = currentUser.name;
  document.getElementById('signedInRole').textContent = currentUser.role === 'admin' ? 'Administrator access' : 'Personal security workspace';
  document.getElementById('roleBadge').textContent = currentUser.role === 'admin' ? 'ADMIN' : 'USER';
  document.getElementById('usersNav').classList.toggle('hidden', currentUser.role !== 'admin');
  showView('dashboard');
  loadItems();
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  document.getElementById('nameField').classList.toggle('hidden', !signup);
  document.getElementById('authEyebrow').textContent = signup ? 'CREATE YOUR WORKSPACE' : 'WELCOME BACK';
  document.getElementById('authTitle').textContent = signup ? 'Create account' : 'Sign in';
  document.getElementById('authIntro').textContent = signup ? 'Create a personal account to monitor your own security items.' : 'Sign in to open your security workspace.';
  document.getElementById('authSubmit').innerHTML = signup ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  document.getElementById('authSwitchText').textContent = signup ? 'Already have an account?' : 'New to SECURIO?';
  document.getElementById('authSwitch').textContent = signup ? 'Sign in' : 'Create an account';
  document.querySelector('#authForm [name="password"]').autocomplete = signup ? 'new-password' : 'current-password';
  document.getElementById('authMessage').textContent = '';
  document.getElementById('authMessage').classList.remove('success-message');
}
document.getElementById('authSwitch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));

function slideToLogin() {
  const loginPanel = document.getElementById('loginPanel');
  loginPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    const email = document.querySelector('#authForm [name="email"]');
    if (email) email.focus({ preventScroll: true });
  }, 650);
}
document.getElementById('enterWorkspace').addEventListener('click', slideToLogin);
document.getElementById('landingWordmark').addEventListener('click', slideToLogin);
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const target = event.target;
  if (target && (target.matches('input, textarea, select, button, [contenteditable="true"]'))) return;
  if (!document.getElementById('authScreen').classList.contains('hidden') && window.scrollY < document.getElementById('loginPanel').offsetTop - 20) {
    event.preventDefault();
    slideToLogin();
  }
});

document.getElementById('authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const payload = { email: form.get('email'), password: form.get('password') };
  if (authMode === 'signup') payload.name = form.get('name');
  const button = document.getElementById('authSubmit');
  const message = document.getElementById('authMessage');
  button.disabled = true; message.textContent = 'Please wait…';
  try {
    const response = await fetch(`/api/auth/${authMode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not authenticate.');
    if (authMode === 'signup') {
      formElement.reset();
      document.querySelector('#authForm [name="email"]').value = payload.email;
      setAuthMode('login');
      message.textContent = 'Account request submitted. An admin must approve it before you can sign in.';
      message.classList.add('success-message');
      return;
    }
    authToken = data.token; currentUser = data.user; localStorage.setItem('securioToken', authToken);
    formElement.reset(); showApp();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  authToken = ''; currentUser = null; items = []; localStorage.removeItem('securioToken'); showAuth(); setAuthMode('login');
});

const typeFields = {
  "User Access": ["employee", "department", "role", "permissions", "mfa", "device"],
  "API Credential": ["apiName", "environment", "owner", "status", "lastRotated"],
  "Trusted Device": ["deviceName", "assignedUser", "os", "encryption", "trustStatus"],
  "Vendor Access": ["vendor", "system", "accessLevel", "contractExpiry", "mfa"],
  "Database Permission": ["database", "serviceAccount", "permissionLevel", "environment", "lastReviewed"]
};

const labels = {
  employee: "Employee", department: "Department", role: "Role", permissions: "Permissions", mfa: "MFA", device: "Device",
  apiName: "API Name", environment: "Environment", owner: "Owner", status: "Status", lastRotated: "Last Rotated",
  deviceName: "Device Name", assignedUser: "Assigned User", os: "Operating System", encryption: "Encryption", trustStatus: "Trust Status",
  vendor: "Vendor", system: "System", accessLevel: "Access Level", contractExpiry: "Contract / Expiry", database: "Database", serviceAccount: "User / Service Account", permissionLevel: "Permission Level", lastReviewed: "Last Reviewed"
};

const inputTypes = new Set(["lastRotated", "contractExpiry", "lastReviewed"]);

async function loadItems(){
  try {
    if (!authToken) { showAuth(); return; }
    const res = await apiFetch("/api/items");
    if (!res.ok) throw new Error("Could not load security items");
    items = await res.json();
    render();
  } catch (error) {
    console.error(error);
  }
}

function showView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active-view"));
  document.getElementById(view).classList.add("active-view");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active", n.dataset.view===view));
  const titles={dashboard:"Security overview",items:"Security items",timeline:"Lifecycle intelligence",add:"Add security item",users:"User approvals"};
  document.getElementById("pageTitle").textContent=titles[view];
  const globalAdd=document.getElementById("globalAddButton");
  if(globalAdd) globalAdd.style.visibility = view === "add" ? "hidden" : "visible";
  window.scrollTo({top:0,behavior:"smooth"});
  if(view === "timeline") renderLifecycle();
  if(view === "users") loadUsers();
}

document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));

function riskClass(r){return String(r || "low").toLowerCase()}
function signals(i){
  const s=[];
  if(i.driftFields.length)s.push("Drift");
  if(i.expired)s.push("Expired");
  if(i.debtDays)s.push("Debt");
  return s.length?s:["Healthy"];
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}

function render(){
  const critical=items.filter(i=>i.risk==="Critical").length;
  const high=items.filter(i=>i.risk==="High").length;
  const expired=items.filter(i=>i.expired).length;

  document.getElementById("summaryCards").innerHTML=`
    <div class="card"><span class="card-icon">◈</span><small>Monitored items</small><div class="metric">${items.length}</div><small>registered security assets</small></div>
    <div class="card"><span class="card-icon">↗</span><small>Drift / change</small><div class="metric">${items.filter(i=>i.driftFields.length).length}</div><small>baseline differences</small></div>
    <div class="card"><span class="card-icon">◷</span><small>Expired reviews</small><div class="metric">${expired}</div><small>verification overdue</small></div>
    <div class="card"><span class="card-icon">!</span><small>High / critical</small><div class="metric">${high+critical}</div><small>priority attention</small></div>`;

  document.getElementById("riskList").innerHTML=items.map(i=>`
    <div class="risk-row">
      <div class="risk-item-title"><span class="item-dot ${riskClass(i.risk)}"></span><div><div class="risk-name">${esc(i.name)}</div><div class="risk-meta">${signals(i).join(" • ")} · ${esc(i.action)}</div></div></div>
      <div><div class="bar"><div class="fill ${riskClass(i.risk)}" style="width:${i.score}%"></div></div></div>
      <div><div class="risk-badge ${riskClass(i.risk)}">${i.risk} ${i.score}</div><small class="urgency ${riskClass(i.risk)}">${i.urgency}</small></div>
    </div>`).join("");

  const priority=[...items].filter(i=>i.risk!=="Low").sort((a,b)=>b.score-a.score).slice(0,4);
  document.getElementById("priorityList").innerHTML=priority.length ? priority.map((i,n)=>`
    <button class="priority-row priority-button" type="button" onclick="openItemFromPriority(${i.id})" aria-label="View ${esc(i.name)} details"><span class="priority-no">0${n+1}</span><span class="priority-copy"><b>${esc(i.name)}</b><small>${esc(i.action)}</small></span><strong class="${riskClass(i.risk)}">${i.urgency}</strong></button>`).join("") : `<div class="empty-state">No priority actions. Current monitored items are within acceptable risk.</div>`;

  const story=items.slice().sort((a,b)=>b.score-a.score)[0];
  document.getElementById("storyPanel").innerHTML=story ? `
    <div class="story-top"><div><p class="eyebrow">SECURITY CHANGE STORY</p><h3>${esc(story.name)}</h3><p class="story-kicker">The item-level journey behind the current risk.</p></div><span class="risk-badge ${riskClass(story.risk)}">${story.risk} · ${story.score}</span></div>
    <div class="story-chain"><span>Verified baseline</span><b>→</b><span>${story.driftFields.length?"Change detected":"Current state checked"}</span><b>→</b><span>${story.expired?"Verification expired":"Verification valid"}</span><b>→</b><span>${story.debtDays?"Debt accumulating":"No open debt"}</span></div>
    <div class="story-grid"><div><small>WHY IT MATTERS</small><p>${esc(story.explanation)}</p></div><div><small>IMPACT</small><p>${esc(story.impact)}</p></div><div><small>URGENCY</small><p class="${riskClass(story.risk)}"><b>${esc(story.urgency)}</b></p></div><div><small>RECOMMENDED ACTION</small><p>${esc(story.action)}</p></div></div>` : `<div class="empty-state">Register a security item to generate a lifecycle story.</div>`;

  document.getElementById("itemsTable").innerHTML=items.map(i=>`
    <tr><td><b>${esc(i.name)}</b><br><span class="risk-meta">${esc(i.currentSummary || i.department)}</span></td><td>${esc(i.type)}</td><td>${esc(i.owner)}</td>
      <td>${signals(i).map(s=>`<span class="signal">${s}</span>`).join("")}</td><td class="${riskClass(i.risk)}"><b>${i.risk}</b> (${i.score})<br><small>${i.urgency}</small></td>
      <td><button class="secondary" onclick="updateCurrent(${i.id})">Update current</button> <button class="secondary" onclick="reverify(${i.id})">Re-verify</button></td></tr>`).join("");

  renderLifecycle();
}

function renderLifecycle(){
  if(!document.getElementById("timelineContent")) return;
  const sorted=[...items].sort((a,b)=>b.score-a.score);
  const top=sorted[0];
  const important=sorted.filter(i=>i.risk!=="Low" || i.driftFields.length || i.expired || i.debtDays).slice(0,4);

  document.getElementById("lifecycleHeadline").textContent=top ? `${top.risk} risk across ${items.length} monitored item${items.length===1?"":"s"}` : "No monitored items yet";
  document.getElementById("lifecycleSubline").textContent=top ? `${top.name} is currently the most important lifecycle state.` : "Register a security item to begin monitoring.";
  document.getElementById("lifecycleCounts").innerHTML=`<span><b>${items.filter(i=>i.driftFields.length).length}</b> drift</span><span><b>${items.filter(i=>i.expired).length}</b> expired</span><span><b>${items.filter(i=>i.debtDays).length}</b> debt</span>`;

  document.getElementById("timelineContent").innerHTML=important.length ? important.map(i=>`
    <article class="event-card ${riskClass(i.risk)}">
      <div class="event-accent"></div>
      <div class="event-top"><div><span class="date">CURRENT STATE · ${i.age} DAYS SINCE VERIFICATION</span><h3>${esc(i.name)}</h3><small>${esc(i.type)}</small></div><span class="risk-badge ${riskClass(i.risk)}">${i.risk} · ${i.score}</span></div>
      <div class="mini-chain"><span>Baseline</span><b>→</b><span>${i.driftFields.length?"Drift":"Stable"}</span><b>→</b><span>${i.expired?"Expired":"Valid"}</span><b>→</b><span>${i.debtDays?"Debt":"Clear"}</span></div>
      <div class="event-details"><div><small>CURRENT SECURITY STATE</small><p>${esc(i.currentSummary || "Current state recorded")}</p></div><div><small>WHY IT MATTERS</small><p>${esc(i.explanation)}</p></div><div><small>NEXT ACTION</small><p>${esc(i.action)}</p></div></div>
    </article>`).join("") : `<div class="empty-state panel">No significant lifecycle events need attention right now.</div>`;
}

function buildState(prefix,type){
  const wrap=document.getElementById(prefix+"Fields");
  if(!wrap) return;
  const fields=typeFields[type]||[];
  wrap.innerHTML=fields.map(k=>{
    const type=inputTypes.has(k)?"date":"text";
    return `<label>${labels[k]||k}<input type="${type}" data-state="${prefix}" data-key="${k}" placeholder="${type==='text' ? `Enter ${labels[k]||k}` : ''}"></label>`;
  }).join("");
}

function collectState(prefix){
  const obj={};
  document.querySelectorAll(`[data-state="${prefix}"]`).forEach(el=>{if(el.value.trim()) obj[el.dataset.key]=el.value.trim();});
  return obj;
}

function openItemFromPriority(id){
  showView("items");
  const row=[...document.querySelectorAll("#itemsTable tr")].find(r=>r.textContent.includes(items.find(i=>String(i.id)===String(id))?.name || "\u0000"));
  if(row){ row.classList.add("row-highlight"); row.scrollIntoView({behavior:"smooth",block:"center"}); setTimeout(()=>row.classList.remove("row-highlight"),1800); }
}

async function reverify(id){
  if(!confirm("Re-verify this security item using its current state?")) return;
  const res=await apiFetch(`/api/items/${id}/reverify`,{method:"POST"});
  if(res.ok) await loadItems();
}

document.getElementById("typeSelect").addEventListener("change",()=>{
  buildState("current",document.getElementById("typeSelect").value);
});
buildState("current",document.getElementById("typeSelect").value);

document.getElementById("itemForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  const current=collectState("current");
  const payload={
    name:f.get("name"), type:f.get("type"),
    current,
    lastVerified:new Date().toISOString().slice(0,10),
    reviewDays:90,
    unresolvedSince:null,
    severity:"Medium"
  };
  const res=await apiFetch("/api/items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(res.ok){
    e.target.reset();
    buildState("current",document.getElementById("typeSelect").value);
    document.getElementById("formMessage").textContent="Security item registered successfully. SECURIO generated its lifecycle risk story.";
    await loadItems();
    setTimeout(()=>showView("dashboard"),700);
  } else document.getElementById("formMessage").textContent="Could not register item.";
});

async function updateCurrent(id){
  const item=items.find(x=>String(x.id)===String(id)); if(!item) return;
  const updated={...(item.current||{})};
  for(const key of (typeFields[item.type]||Object.keys(updated))){
    const label=labels[key]||key; const answer=prompt(`Update current state — ${label}:`, updated[key]??'');
    if(answer===null) return;
    if(answer.trim()) updated[key]=answer.trim(); else delete updated[key];
  }
  const res=await apiFetch(`/api/items/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({current:updated})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){alert(data.error||'Could not update current state.');return;}
  await loadItems();
}
async function loadUsers(){
  const body=document.getElementById('usersTable'); if(!body) return;
  const res=await apiFetch('/api/users'); if(!res.ok){body.innerHTML='<tr><td colspan="4">Could not load users.</td></tr>';return;}
  const users=await res.json();
  body.innerHTML=users.length?users.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td><span class="signal">${u.approved?'Approved':'Pending approval'}</span></td><td>${u.approved?'<span class="risk-meta">No action needed</span>':`<button class="primary" onclick="decideUser(${u.id},'approve')">Approve</button> <button class="secondary" onclick="decideUser(${u.id},'reject')">Reject</button>`}</td></tr>`).join(''):'<tr><td colspan="4">No user account requests yet.</td></tr>';
}
async function decideUser(id,decision){
  const verb=decision==='approve'?'approve':'reject';
  if(!confirm(`Are you sure you want to ${verb} this user account?`)) return;
  const res=await apiFetch(`/api/users/${id}/approval`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});
  const data=await res.json().catch(()=>({})); if(!res.ok){alert(data.error||'Could not update user.');return;} await loadUsers();
}

if (authToken) {
  apiFetch('/api/auth/me').then(r => r.ok ? r.json() : Promise.reject(new Error('Sign in required')))
    .then(data => { currentUser = data.user; showApp(); })
    .catch(() => { showAuth(); setAuthMode('login'); });
} else { showAuth(); setAuthMode('login'); }

document.getElementById('enterWorkspace')?.addEventListener('click', () => { const card = document.querySelector('.auth-card'); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); card?.querySelector('input[name="email"]')?.focus({ preventScroll: true }); });
