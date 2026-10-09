const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors()); app.use(express.json({ limit: '1mb' })); app.use(express.static(path.join(__dirname, 'public')));
// Prototype-only in-memory storage: demo accounts, sessions and new items reset on server restart.
const users = [], sessions = new Map(); let nextUserId = 2;
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; }
users.push({ id: 1, name: 'SECURIO Admin', email: 'admin@securio.demo', role: 'admin', approved: true, ...hashPassword('SecurioAdmin!2026') });
let items = [
 { id: 1, name: 'Anu — Employee Access', type: 'User Access', owner: 'Anu', department: 'HR', baseline: { employee: 'Anu', department: 'IT', role: 'Developer', permissions: 'Development Database', mfa: 'Enabled', device: 'Laptop-01' }, current: { employee: 'Anu', department: 'HR', role: 'Developer', permissions: 'Development Database', mfa: 'Enabled', device: 'Laptop-07' }, lastVerified: '2026-01-01', reviewDays: 90, unresolvedSince: '2026-04-01', severity: 'High', userId: 1 },
 { id: 2, name: 'Weather API', type: 'API Credential', owner: 'Anu', department: 'Engineering', baseline: { apiName: 'Weather API', environment: 'Production', owner: 'Anu', status: 'Active', lastRotated: '2026-05-01' }, current: { apiName: 'Weather API', environment: 'Production', owner: 'Rahul', status: 'Active', lastRotated: '2026-05-01' }, lastVerified: '2026-05-01', reviewDays: 90, unresolvedSince: null, severity: 'Medium', userId: 1 },
 { id: 3, name: 'Vendor Portal Account', type: 'Vendor Access', owner: 'External Vendor', department: 'Finance', baseline: { vendor: 'Acme Finance', system: 'Finance Portal', accessLevel: 'Standard', contractExpiry: '2026-12-31', mfa: 'Enabled' }, current: { vendor: 'Acme Finance', system: 'Finance Portal', accessLevel: 'Standard', contractExpiry: '2026-12-31', mfa: 'Disabled' }, lastVerified: '2026-07-01', reviewDays: 90, unresolvedSince: null, severity: 'High', userId: 1 }
];
function daysBetween(a, b = new Date()) { return a ? Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000)) : 0; }
function analyze(item) {
 const driftFields = [], keys = new Set([...Object.keys(item.baseline || {}), ...Object.keys(item.current || {})]);
 for (const key of keys) if ((item.baseline?.[key] ?? '') !== (item.current?.[key] ?? '')) driftFields.push({ field: key, baseline: item.baseline?.[key] ?? '—', current: item.current?.[key] ?? '—' });
 const age = daysBetween(item.lastVerified), expired = age >= Number(item.reviewDays || 90), debtDays = item.unresolvedSince ? daysBetween(item.unresolvedSince) : 0;
 let score = driftFields.length * 15 + (expired ? 30 : 0) + (debtDays ? Math.min(30, Math.ceil(debtDays / 3)) : 0) + (item.severity === 'Critical' ? 25 : item.severity === 'High' ? 18 : item.severity === 'Medium' ? 10 : 5); score = Math.min(100, score);
 const risk = score >= 76 ? 'Critical' : score >= 51 ? 'High' : score >= 26 ? 'Medium' : 'Low';
 const issues = []; if (driftFields.length) issues.push('Security drift detected'); if (expired) issues.push('Security verification expired'); if (debtDays) issues.push(`Unresolved security issue for ${debtDays} days`);
 let action = 'Continue monitoring'; if (expired) action = 'Re-verify security item'; if (driftFields.length) action = 'Review changed fields and permissions'; if (debtDays > 30) action = 'Resolve the outstanding security issue'; if (expired && driftFields.length) action = 'Review changes and re-verify';
 const urgency = risk === 'Critical' ? 'Immediate' : risk === 'High' ? 'High' : risk === 'Medium' ? 'Review soon' : 'Routine';
 const why = []; if (driftFields.length) { const f = driftFields[0]; why.push(`${f.field} changed from ${f.baseline} to ${f.current}`); } if (expired) why.push('the previous security verification is no longer valid'); if (debtDays) why.push(`the issue has remained unresolved for ${debtDays} days`);
 const explanation = why.length ? why.join('; ') + '.' : 'No significant lifecycle risk is currently detected.';
 const impact = risk === 'Critical' ? 'Potentially significant security exposure' : risk === 'High' ? 'Could expose unnecessary access or weaken controls' : risk === 'Medium' ? 'May become a larger issue if left unattended' : 'Low current impact';
 const currentSummary = Object.entries(item.current || {}).slice(0,4).map(([k,v]) => `${k}: ${v}`).join(' · ');
 return { ...item, age, expired, debtDays, driftFields, score, risk, issues, action, urgency, explanation, impact, currentSummary };
}
function auth(req, res, next) {
 const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''), session = sessions.get(token), user = session && users.find(u => u.id === session.userId);
 if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
 req.user = { id: user.id, name: user.name, email: user.email, role: user.role }; next();
}
function adminOnly(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' }); next(); }
function ownedItem(req, res, next) { const item = items.find(x => x.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Security item not found.' }); if (req.user.role !== 'admin' && item.userId !== req.user.id) return res.status(403).json({ error: 'You can only access your own security items.' }); req.item = item; next(); }
app.post('/api/auth/signup', (req,res) => {
 const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
 if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Enter your name, email, and a password with at least 8 characters.' });
 if (users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
 const user = { id: nextUserId++, name, email, role: 'user', approved: false, ...hashPassword(password) }; users.push(user);
 res.status(201).json({ success: true, message: 'Account submitted for admin approval.', user: { id:user.id, name, email, role:user.role, approved:false } });
});
app.post('/api/auth/login', (req,res) => {
 const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || ''), user = users.find(u => u.email === email);
 if (!user) return res.status(401).json({ error: 'Email or password is incorrect.' });
 if (user.role !== 'admin' && !user.approved) return res.status(403).json({ error: 'Your account is awaiting admin approval. Please try again after it has been approved.' });
 const candidate = crypto.scryptSync(password, user.salt, 64).toString('hex');
 if (candidate.length !== user.hash.length || !crypto.timingSafeEqual(Buffer.from(candidate,'hex'), Buffer.from(user.hash,'hex'))) return res.status(401).json({ error: 'Email or password is incorrect.' });
 const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId:user.id }); res.json({ token, user: { id:user.id, name:user.name, email:user.email, role:user.role } });
});
app.get('/api/auth/me', auth, (req,res) => res.json({ user:req.user }));
app.post('/api/auth/logout', auth, (req,res) => { sessions.delete((req.headers.authorization || '').replace(/^Bearer\s+/i,'')); res.json({ success:true }); });
app.get('/api/users', auth, adminOnly, (req,res) => res.json(users.filter(u => u.role !== 'admin').map(u => ({ id:u.id, name:u.name, email:u.email, role:u.role, approved:!!u.approved }))));
app.post('/api/users/:id/approval', auth, adminOnly, (req,res) => { const user = users.find(u => u.id === Number(req.params.id) && u.role !== 'admin'); if (!user) return res.status(404).json({ error:'User not found.' }); const decision = req.body && req.body.decision; if (!['approve','reject'].includes(decision)) return res.status(400).json({ error:'Choose approve or reject.' }); if (decision === 'approve') user.approved = true; else { for (const token of [...sessions.keys()]) if (sessions.get(token).userId === user.id) sessions.delete(token); const idx = users.findIndex(u => u.id === user.id); users.splice(idx,1); items = items.filter(i => i.userId !== user.id); } res.json({ success:true, message: decision === 'approve' ? 'User approved.' : 'User request rejected.' }); });
app.get('/api/items', auth, (req,res) => res.json((req.user.role === 'admin' ? items : items.filter(i => i.userId === req.user.id)).map(analyze)));
app.post('/api/items', auth, (req,res) => {
 const body = req.body || {}, type = body.type || 'User Access', current = body.current || {}, baseline = { ...current };
 const owner = current.owner || current.user || current.employee || current.vendor || req.user.name;
 const item = { id:Date.now(), name:String(body.name || `${type} item`).slice(0,120), type, owner, department:current.department || 'General', baseline, current, lastVerified:body.lastVerified || new Date().toISOString().slice(0,10), reviewDays:Math.max(1,Math.min(3650,Number(body.reviewDays || 90))), unresolvedSince:body.unresolvedSince || null, severity:body.severity || 'Medium', userId:req.user.id };
 items.unshift(item); res.status(201).json(analyze(item));
});
app.put('/api/items/:id', auth, ownedItem, (req,res) => { if (req.body.current !== undefined) { req.item.current = req.body.current; const hasDrift = Object.keys({ ...req.item.baseline, ...req.item.current }).some(k => (req.item.baseline?.[k] ?? '') !== (req.item.current?.[k] ?? '')); if (hasDrift && !req.item.unresolvedSince) req.item.unresolvedSince = new Date().toISOString().slice(0,10); if (!hasDrift) req.item.unresolvedSince = null; } for (const key of ['name','reviewDays','severity']) if (req.body[key] !== undefined) req.item[key] = req.body[key]; res.json(analyze(req.item)); });
app.post('/api/items/:id/reverify', auth, ownedItem, (req,res) => { req.item.baseline = { ...(req.item.current || {}) }; req.item.lastVerified = new Date().toISOString().slice(0,10); req.item.unresolvedSince = null; res.json(analyze(req.item)); });
app.delete('/api/items/:id', auth, ownedItem, (req,res) => { items = items.filter(x => x.id !== req.item.id); res.json({ success:true }); });
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log(`SECURIO running at http://localhost:${PORT}`));
