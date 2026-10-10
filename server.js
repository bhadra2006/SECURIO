const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) { if (!origin || (process.env.NODE_ENV !== 'production' && !allowedOrigins.length) || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); } }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Small in-memory rate limiter suitable for this prototype; use a shared store in production.
const attempts = new Map();
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10 } = {}) { return (req, res, next) => { const key = `${req.ip}:${req.path}`; const now = Date.now(); const entry = attempts.get(key); if (!entry || now - entry.start >= windowMs) attempts.set(key, { start: now, count: 1 }); else { entry.count++; if (entry.count > max) return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' }); } next(); }; }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
function cleanText(value, max = 120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
const allowedTypes = new Set(['User Access','API Credential','Trusted Device','Vendor Access','Database Permission']);
const allowedSeverity = new Set(['Low','Medium','High','Critical']);
// Prototype-only in-memory storage: demo accounts, sessions and new items reset on server restart.
const users = [], sessions = new Map(); let nextUserId = 2;
// Demo-only in-memory override register; use persistent storage for production.
const securityOverrides = []; let nextOverrideId = 1;
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; }
const adminEmail = (process.env.ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'admin@securio.demo')).trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'SecurioAdmin!2026');
if (adminEmail && adminPassword.length >= 12) users.push({ id: 1, name: 'SECURIO Admin', email: adminEmail, role: 'admin', approved: true, ...hashPassword(adminPassword) });
else if (process.env.NODE_ENV === 'production') console.warn('Admin account not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in environment variables.');
let items = [
 { id: 1, name: 'Anu — Employee Access', type: 'User Access', owner: 'Anu', department: 'HR', baseline: { employee: 'Anu', department: 'IT', role: 'Developer', permissions: 'Development Database', mfa: 'Enabled', device: 'Laptop-01' }, current: { employee: 'Anu', department: 'HR', role: 'Developer', permissions: 'Development Database', mfa: 'Enabled', device: 'Laptop-07' }, lastVerified: '2026-01-01', reviewDays: 90, unresolvedSince: '2026-04-01', issueStatus: 'open', severity: 'High', userId: 1 },
 { id: 2, name: 'Weather API', type: 'API Credential', owner: 'Anu', department: 'Engineering', baseline: { apiName: 'Weather API', environment: 'Production', owner: 'Anu', status: 'Active', lastRotated: '2026-05-01' }, current: { apiName: 'Weather API', environment: 'Production', owner: 'Rahul', status: 'Active', lastRotated: '2026-05-01' }, lastVerified: '2026-05-01', reviewDays: 90, unresolvedSince: null, severity: 'Medium', userId: 1 },
 { id: 3, name: 'Vendor Portal Account', type: 'Vendor Access', owner: 'External Vendor', department: 'Finance', baseline: { vendor: 'Acme Finance', system: 'Finance Portal', accessLevel: 'Standard', contractExpiry: '2026-12-31', mfa: 'Enabled' }, current: { vendor: 'Acme Finance', system: 'Finance Portal', accessLevel: 'Standard', contractExpiry: '2026-12-31', mfa: 'Disabled' }, lastVerified: '2026-07-01', reviewDays: 90, unresolvedSince: null, severity: 'High', userId: 1 }
];
function daysBetween(a, b = new Date()) { if (!validDate(a)) return 0; return Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000)); }
function analyze(item) {
 const driftFields = [], keys = new Set([...Object.keys(item.baseline || {}), ...Object.keys(item.current || {})]);
 for (const key of keys) if (String(item.baseline?.[key] ?? '') !== String(item.current?.[key] ?? '')) driftFields.push({ field: key, baseline: item.baseline?.[key] ?? '—', current: item.current?.[key] ?? '—' });
 const age = daysBetween(item.lastVerified), reviewInterval = Number.isFinite(Number(item.reviewDays)) ? Math.max(1, Math.min(3650, Number(item.reviewDays))) : 90;
 const expired = age >= reviewInterval, debtDays = item.unresolvedSince && validDate(item.unresolvedSince) ? daysBetween(item.unresolvedSince) : 0;
 let score = driftFields.length * 15 + (expired ? 30 : 0) + (debtDays ? Math.min(30, Math.ceil(debtDays / 3)) : 0) + (item.severity === 'Critical' ? 25 : item.severity === 'High' ? 18 : item.severity === 'Medium' ? 10 : 5); score = Math.min(100, score);
 const risk = score >= 76 ? 'Critical' : score >= 51 ? 'High' : score >= 26 ? 'Medium' : 'Low';
 const issues = []; if (driftFields.length) issues.push('Security drift detected'); if (expired) issues.push('Security review overdue'); if (debtDays) issues.push(`Unresolved security issue for ${debtDays} days`);
 let action = 'Continue monitoring'; if (expired) action = 'Re-verify security item'; if (driftFields.length) action = 'Review changed fields and permissions'; if (debtDays > 30) action = 'Resolve the outstanding security issue'; if (expired && driftFields.length) action = 'Review changes and re-verify';
 const urgency = risk === 'Critical' ? 'Immediate' : risk === 'High' ? 'High' : risk === 'Medium' ? 'Review soon' : 'Routine';
 const why = []; if (driftFields.length) { const f = driftFields[0]; why.push(`${f.field} changed from ${f.baseline} to ${f.current}`); } if (expired) why.push('the previous security verification is no longer valid'); if (debtDays) why.push(`the issue has remained unresolved for ${debtDays} days`);
 const explanation = why.length ? why.join('; ') + '.' : 'No significant lifecycle risk is currently detected.';
 const impact = risk === 'Critical' ? 'Potentially significant security exposure' : risk === 'High' ? 'Could expose unnecessary access or weaken controls' : risk === 'Medium' ? 'May become a larger issue if left unattended' : 'Low current impact';
 const currentSummary = Object.entries(item.current || {}).slice(0,4).map(([k,v]) => `${k}: ${v}`).join(' · ');
 return { ...item, age, expired, debtDays, driftFields, score, risk, issues, action, urgency, explanation, impact, currentSummary };
}
function auth(req, res, next) {
 const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => { const i=part.indexOf('='); return i<0?['','']:[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())]; }));
 const token = cookies.securio_session || (process.env.NODE_ENV !== 'production' ? (req.headers.authorization || '').replace(/^Bearer\s+/i, '') : ''), session = sessions.get(token);
 if (session && session.createdAt && Date.now() - session.createdAt > 8 * 60 * 60 * 1000) sessions.delete(token);
 const activeSession = sessions.get(token), user = activeSession && users.find(u => u.id === activeSession.userId);
 if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
 req.user = { id: user.id, name: user.name, email: user.email, role: user.role }; next();
}
function adminOnly(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' }); next(); }
function ownedItem(req, res, next) { const item = items.find(x => x.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Security item not found.' }); if (req.user.role !== 'admin' && item.userId !== req.user.id) return res.status(403).json({ error: 'You can only access your own security items.' }); req.item = item; next(); }
app.post('/api/auth/signup', rateLimit({ max: 5 }), (req,res) => {
 const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
 if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Enter a valid name and email, and a password between 10 and 128 characters.' });
 if (users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
 const user = { id: nextUserId++, name, email, role: 'user', approved: false, ...hashPassword(password) }; users.push(user);
 res.status(201).json({ success: true, message: 'Account submitted for admin approval.', user: { id:user.id, name, email, role:user.role, approved:false } });
});
app.post('/api/auth/login', rateLimit({ max: 8 }), (req,res) => {
 const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || ''), user = users.find(u => u.email === email);
 if (!user) { crypto.scryptSync(password.slice(0,128), 'securio-invalid-user-salt', 64); return res.status(401).json({ error: 'Email or password is incorrect.' }); }
 if (user.role !== 'admin' && !user.approved) return res.status(403).json({ error: 'Your account is awaiting admin approval. Please try again after it has been approved.' });
 const candidate = crypto.scryptSync(password, user.salt, 64).toString('hex');
 if (candidate.length !== user.hash.length || !crypto.timingSafeEqual(Buffer.from(candidate,'hex'), Buffer.from(user.hash,'hex'))) return res.status(401).json({ error: 'Email or password is incorrect.' });
 const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId:user.id, createdAt:Date.now() }); const cookieFlags = `Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; res.setHeader('Set-Cookie', `securio_session=${encodeURIComponent(token)}; ${cookieFlags}`); res.json({ user: { id:user.id, name:user.name, email:user.email, role:user.role } });
});
app.get('/api/auth/me', auth, (req,res) => res.json({ user:req.user }));
app.post('/api/auth/logout', auth, (req,res) => { const cookie = String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('securio_session=')); if (cookie) sessions.delete(decodeURIComponent(cookie.slice('securio_session='.length))); res.setHeader('Set-Cookie', `securio_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); res.json({ success:true }); });
app.get('/api/users', auth, adminOnly, (req,res) => res.json(users.filter(u => u.role !== 'admin').map(u => ({ id:u.id, name:u.name, email:u.email, role:u.role, approved:!!u.approved }))));
app.post('/api/users/:id/approval', auth, adminOnly, (req,res) => { const user = users.find(u => u.id === Number(req.params.id) && u.role !== 'admin'); if (!user) return res.status(404).json({ error:'User not found.' }); const decision = req.body && req.body.decision; if (!['approve','reject'].includes(decision)) return res.status(400).json({ error:'Choose approve or reject.' }); if (decision === 'approve') user.approved = true; else { for (const token of [...sessions.keys()]) if (sessions.get(token).userId === user.id) sessions.delete(token); const idx = users.findIndex(u => u.id === user.id); users.splice(idx,1); items = items.filter(i => i.userId !== user.id); } res.json({ success:true, message: decision === 'approve' ? 'User approved.' : 'User request rejected.' }); });
app.get('/api/items', auth, (req,res) => res.json((req.user.role === 'admin' ? items : items.filter(i => i.userId === req.user.id)).map(analyze)));
app.get('/api/admin/overrides', auth, adminOnly, (req,res) => {
 const now = new Date();
 const rows = securityOverrides.map(record => ({ ...record, status: record.status === 'revoked' ? 'revoked' : (new Date(record.expiresAt + 'T23:59:59') < now ? 'expired' : 'active') }));
 res.json({ overrides: rows, prototype: true });
});
app.post('/api/admin/overrides', auth, adminOnly, (req,res) => {
 const body = req.body || {}, itemId = Number(body.itemId), item = items.find(x => x.id === itemId);
 const reason = cleanText(body.reason, 500), scope = cleanText(body.scope, 300), evidence = cleanText(body.evidence, 160), expiresAt = body.expiresAt;
 if (!item) return res.status(400).json({ error: 'Select an existing security item.' });
 if (reason.length < 12) return res.status(400).json({ error: 'Explain the reason in at least 12 characters.' });
 if (scope.length < 8) return res.status(400).json({ error: 'Describe the scope or compensating measure in at least 8 characters.' });
 if (!validDate(expiresAt)) return res.status(400).json({ error: 'Choose a valid expiry date.' });
 const today = new Date().toISOString().slice(0,10); if (expiresAt < today) return res.status(400).json({ error: 'Expiry date cannot be in the past.' });
 const record = { id:nextOverrideId++, itemId:item.id, itemName:item.name, reason, scope, evidence, expiresAt, status:'active', createdAt:new Date().toISOString(), createdBy:{ id:req.user.id, name:req.user.name, email:req.user.email } };
 securityOverrides.unshift(record); res.status(201).json({ override:record, message:'Security exception recorded. The underlying finding remains unchanged.' });
});
app.post('/api/admin/overrides/:id/revoke', auth, adminOnly, (req,res) => {
 const record = securityOverrides.find(x => x.id === Number(req.params.id)); if (!record) return res.status(404).json({ error:'Override record not found.' });
 if (record.status === 'revoked') return res.status(400).json({ error:'This override has already been revoked.' });
 record.status = 'revoked'; record.revokedAt = new Date().toISOString(); record.revokedBy = { id:req.user.id, name:req.user.name }; res.json({ success:true, message:'Override revoked. The underlying security finding remains unchanged.' });
});
app.get('/api/admin/blind-spots', auth, adminOnly, (req,res) => {
 const records = items.map(analyze), groups = new Map();
 for (const item of records) { const key = cleanText(item.department || 'Unassigned',80) || 'Unassigned'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
 const insights = [];
 for (const [department, group] of groups) {
  const overdue = group.filter(i => i.expired), drift = group.filter(i => i.driftFields.length), debt = group.filter(i => i.debtDays > 0);
  const concernItems = new Set([...overdue,...drift,...debt].map(i=>i.id));
  if (concernItems.size >= 2 || (overdue.length && debt.length)) insights.push({ title: `Potential review blind spot in ${department}`, department, itemCount:group.length, affectedCount:concernItems.size, overdueCount:overdue.length, driftCount:drift.length, debtCount:debt.length, evidence:[overdue.length ? `${overdue.length} overdue review(s)` : '', drift.length ? `${drift.length} item(s) with baseline differences` : '', debt.length ? `${debt.length} unresolved issue(s)` : ''].filter(Boolean), items:group.filter(i=>concernItems.has(i.id)).map(i=>({id:i.id,name:i.name,risk:i.risk,action:i.action})), explanation:'This is a rule-based pattern in recorded demo data, not proof of a breach or team failure.', recommendation:'Review the listed items with their owners and confirm whether changes are authorised.' });
 }
 const totalOverdue=records.filter(i=>i.expired).length, totalDrift=records.filter(i=>i.driftFields.length).length, totalDebt=records.filter(i=>i.debtDays>0).length;
 if (!insights.length && records.length) insights.push({title:'No cross-item blind spot detected',department:'Organisation-wide',itemCount:records.length,affectedCount:0,overdueCount:totalOverdue,driftCount:totalDrift,debtCount:totalDebt,evidence:['No department currently meets the prototype pattern threshold.'],items:[],explanation:'The current rules did not find a repeated pattern in the recorded items. This does not guarantee the environment is secure.',recommendation:'Continue scheduled reviews and resolve individual findings.'});
 res.json({generatedAt:new Date().toISOString(), prototype:true, totalItems:records.length, overdueCount:totalOverdue, driftCount:totalDrift, debtCount:totalDebt, insights});
});
app.post('/api/items', auth, (req,res) => {
 const body = req.body || {}, type = cleanText(body.type || 'User Access', 40);
 if (!allowedTypes.has(type)) return res.status(400).json({ error: 'Choose a supported security item type.' });
 if (!body.current || typeof body.current !== 'object' || Array.isArray(body.current)) return res.status(400).json({ error: 'Current security state must be an object.' });
 const current = {}; for (const [key, value] of Object.entries(body.current)) { if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || !['string','number','boolean'].includes(typeof value)) return res.status(400).json({ error: 'Invalid security field.' }); const text = String(value); if (text.length > 200) return res.status(400).json({ error: 'Security field values must be 200 characters or fewer.' }); current[key] = text; }
 const name = cleanText(body.name || `${type} item`, 120); if (!name) return res.status(400).json({ error: 'Item name is required.' });
 const reviewDays = body.reviewDays === undefined ? 90 : Number(body.reviewDays); if (!Number.isInteger(reviewDays) || reviewDays < 1 || reviewDays > 3650) return res.status(400).json({ error: 'Review interval must be between 1 and 3650 days.' });
 const lastVerified = body.lastVerified === undefined ? new Date().toISOString().slice(0,10) : body.lastVerified; if (!validDate(lastVerified)) return res.status(400).json({ error: 'Last verified must be a valid YYYY-MM-DD date.' });
 const severity = body.severity || 'Medium'; if (!allowedSeverity.has(severity)) return res.status(400).json({ error: 'Invalid severity.' });
 const owner = cleanText(current.owner || current.user || current.employee || current.vendor || req.user.name, 80);
 const item = { id:Date.now() + Math.floor(Math.random()*1000), name, type, owner, department:cleanText(current.department || 'General', 80), baseline:{...current}, current, lastVerified, reviewDays, unresolvedSince:null, issueStatus:'none', severity, userId:req.user.id };
 items.unshift(item); res.status(201).json(analyze(item));
});
app.put('/api/items/:id', auth, ownedItem, (req,res) => {
 const body = req.body || {};
 if (body.current !== undefined) {
  if (!body.current || typeof body.current !== 'object' || Array.isArray(body.current)) return res.status(400).json({ error: 'Current security state must be an object.' });
  const clean = {}; for (const [key,value] of Object.entries(body.current)) { if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || !['string','number','boolean'].includes(typeof value) || String(value).length > 200) return res.status(400).json({ error: 'Invalid security field or value.' }); clean[key] = String(value); }
  req.item.current = clean;
 }
 if (body.name !== undefined) { const name = cleanText(body.name,120); if (!name) return res.status(400).json({error:'Item name cannot be empty.'}); req.item.name = name; }
 if (body.reviewDays !== undefined) { const n=Number(body.reviewDays); if (!Number.isInteger(n)||n<1||n>3650) return res.status(400).json({error:'Review interval must be between 1 and 3650 days.'}); req.item.reviewDays=n; }
 if (body.severity !== undefined) { if (!allowedSeverity.has(body.severity)) return res.status(400).json({error:'Invalid severity.'}); req.item.severity=body.severity; }
 // Drift is computed independently. It never silently creates or resolves an issue.
 res.json(analyze(req.item));
});
app.post('/api/items/:id/issues', auth, ownedItem, (req,res) => {
 const status = req.body && req.body.status;
 if (status === 'open') { if (req.item.issueStatus !== 'open') req.item.unresolvedSince = new Date().toISOString().slice(0,10); req.item.issueStatus = 'open'; }
 else if (status === 'resolved') { req.item.issueStatus = 'resolved'; req.item.unresolvedSince = null; }
 else return res.status(400).json({error:'Choose open or resolved.'});
 res.json(analyze(req.item));
});
app.post('/api/items/:id/reverify', auth, ownedItem, (req,res) => {
 req.item.baseline = { ...(req.item.current || {}) }; req.item.lastVerified = new Date().toISOString().slice(0,10);
 // Re-verification updates the baseline; open issues remain open until explicitly resolved.
 res.json(analyze(req.item));
});
app.delete('/api/items/:id', auth, ownedItem, (req,res) => { items = items.filter(x => x.id !== req.item.id); res.json({ success:true }); });
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log(`SECURIO running at http://localhost:${PORT}`));
