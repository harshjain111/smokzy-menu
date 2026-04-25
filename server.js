// Smokzy interactive menu — Express backend
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smokzy2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-prod-please';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadDB() {
  if (!fs.existsSync(DATA_FILE)) {
    return { settings: { brandName:'SMOKZY', tagline:'The Art of Shisha', logoUrl:'', partnerName:'', partnerLogoUrl:'' },
      cover:{}, founderNote:{}, pots:[], pairings:[], feedback:[],
      analytics:{ totalViews:0, uniqueVisitors:[], flavorViews:{}, hourlyTraffic:Array(24).fill(0), dailyTraffic:{} } };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
let db = loadDB();
let saveTimer = null;
function saveDB() { clearTimeout(saveTimer); saveTimer = setTimeout(() => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)), 250); }
function saveDBNow() { clearTimeout(saveTimer); fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
const uid = () => crypto.randomBytes(8).toString('hex');

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest('base64url');
  if (parts[1] !== expected) return null;
  try { return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch(e) { return null; }
}
function requireAdmin(req, res, next) {
  const tok = verifyToken(req.cookies && req.cookies.smokzy_admin);
  if (!tok || tok.role !== 'admin') return res.status(401).json({ error: 'unauthorized' });
  next();
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.get(['/admin', '/admin/'], (req, res) => res.redirect('/admin.html'));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
      cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'no file' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// AI flavor image generation (OpenAI dall-e-3). Requires OPENAI_API_KEY env var.
app.post('/api/admin/generate-flavor-image', requireAdmin, async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY not set on the server. Add it to your environment to enable AI image generation.' });
  const body = req.body || {};
  const potId = body.potId, flavorId = body.flavorId;
  let prompt = body.customPrompt;
  let pot, fl;
  if (!prompt) {
    pot = db.pots.find(p => p.id === potId);
    fl = pot && pot.flavors && pot.flavors.find(f => f.id === flavorId);
    if (!fl) return res.status(404).json({ error: 'flavor not found' });
    const notes = (fl.notes || []).join(', ');
    prompt = 'An ultra-realistic luxury menu photograph evoking the shisha flavor "' + fl.name + '". ' +
            'Show the key flavor components: ' + (fl.description || notes || fl.name) + '. ' +
            'Composition on a dark velvet surface, dramatic moody lighting with soft gold rim light, ' +
            'swirling shisha smoke wisps in the background, cinematic, hyperreal, professional food photography aesthetic. ' +
            'No text, no watermark, no people. Square composition, centered.';
  }
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', quality: 'standard' })
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: (j.error && j.error.message) || 'OpenAI error' });
    const imgUrl = j.data[0].url;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return res.status(502).json({ error: 'Could not download generated image' });
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const fileName = 'ai-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.png';
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buf);
    const newUrl = '/uploads/' + fileName;
    if (pot && fl) { fl.image = newUrl; saveDBNow(); }
    res.json({ url: newUrl, prompt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// public endpoints
app.get('/api/menu', (req, res) => {
  const s = db.settings || {};
  res.json({
    brand: s.brandName || 'Smokzy',
    settings: { brandName: s.brandName || 'SMOKZY', tagline: s.tagline || '',
      logoUrl: s.logoUrl || '', partnerName: s.partnerName || '', partnerLogoUrl: s.partnerLogoUrl || '' },
    cover: db.cover, founderNote: db.founderNote, pots: db.pots, pairings: db.pairings
  });
});
app.post('/api/track/view', (req, res) => {
  const visitorId = (req.body && req.body.visitorId) || 'anon';
  db.analytics.totalViews = (db.analytics.totalViews || 0) + 1;
  if (!db.analytics.uniqueVisitors.includes(visitorId)) db.analytics.uniqueVisitors.push(visitorId);
  const hour = new Date().getHours();
  db.analytics.hourlyTraffic[hour] = (db.analytics.hourlyTraffic[hour] || 0) + 1;
  const day = new Date().toISOString().slice(0, 10);
  db.analytics.dailyTraffic[day] = (db.analytics.dailyTraffic[day] || 0) + 1;
  saveDB();
  res.json({ ok: true, totalViews: db.analytics.totalViews });
});
app.post('/api/track/flavor', (req, res) => {
  const flavorId = req.body && req.body.flavorId;
  if (!flavorId) return res.status(400).json({ error: 'flavorId required' });
  db.analytics.flavorViews[flavorId] = (db.analytics.flavorViews[flavorId] || 0) + 1;
  saveDB();
  res.json({ ok: true });
});
app.post('/api/feedback', (req, res) => {
  const b = req.body || {};
  if (!b.rating) return res.status(400).json({ error: 'rating required' });
  db.feedback.unshift({ id: uid(), timestamp: new Date().toISOString(),
    name: (b.name || '').slice(0, 80),
    rating: Math.max(1, Math.min(5, Number(b.rating))),
    experience: (b.experience || '').slice(0, 1000),
    favoriteFlavor: (b.favoriteFlavor || '').slice(0, 80),
    wouldRecommend: !!b.wouldRecommend });
  saveDB();
  res.json({ ok: true });
});

// admin auth
app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'wrong password' });
  res.cookie('smokzy_admin', signToken({ role: 'admin', iat: Date.now() }), { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('smokzy_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => {
  const tok = verifyToken(req.cookies && req.cookies.smokzy_admin);
  res.json({ admin: !!(tok && tok.role === 'admin'), aiEnabled: !!OPENAI_API_KEY });
});

app.get('/api/admin/data', requireAdmin, (req, res) => res.json(db));
app.put('/api/admin/cover', requireAdmin, (req, res) => { db.cover = { ...db.cover, ...req.body }; saveDBNow(); res.json(db.cover); });
app.put('/api/admin/founder', requireAdmin, (req, res) => { db.founderNote = { ...db.founderNote, ...req.body }; saveDBNow(); res.json(db.founderNote); });
app.put('/api/admin/settings', requireAdmin, (req, res) => { db.settings = { ...db.settings, ...req.body }; saveDBNow(); res.json(db.settings); });

app.post('/api/admin/pots', requireAdmin, (req, res) => {
  const pot = { id: uid(), name: '', image: '', tagline: '', basePrice: 0, flavors: [], ...req.body };
  db.pots.push(pot); saveDBNow(); res.json(pot);
});
app.put('/api/admin/pots/:id', requireAdmin, (req, res) => {
  const i = db.pots.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not found' });
  db.pots[i] = { ...db.pots[i], ...req.body, id: db.pots[i].id };
  saveDBNow(); res.json(db.pots[i]);
});
app.delete('/api/admin/pots/:id', requireAdmin, (req, res) => {
  db.pots = db.pots.filter(p => p.id !== req.params.id);
  saveDBNow(); res.json({ ok: true });
});
app.post('/api/admin/pots/:potId/flavors', requireAdmin, (req, res) => {
  const pot = db.pots.find(p => p.id === req.params.potId);
  if (!pot) return res.status(404).json({ error: 'pot not found' });
  const flavor = { id: uid(), name: '', strength: 5, description: '', notes: [], category: 'fruit', popular: false, image: '', price: pot.basePrice || 0, ...req.body };
  pot.flavors = pot.flavors || [];
  pot.flavors.push(flavor);
  saveDBNow(); res.json(flavor);
});
app.put('/api/admin/pots/:potId/flavors/:flavorId', requireAdmin, (req, res) => {
  const pot = db.pots.find(p => p.id === req.params.potId);
  if (!pot) return res.status(404).json({ error: 'pot not found' });
  const i = (pot.flavors || []).findIndex(f => f.id === req.params.flavorId);
  if (i < 0) return res.status(404).json({ error: 'flavor not found' });
  pot.flavors[i] = { ...pot.flavors[i], ...req.body, id: pot.flavors[i].id };
  saveDBNow(); res.json(pot.flavors[i]);
});
app.delete('/api/admin/pots/:potId/flavors/:flavorId', requireAdmin, (req, res) => {
  const pot = db.pots.find(p => p.id === req.params.potId);
  if (!pot) return res.status(404).json({ error: 'pot not found' });
  pot.flavors = (pot.flavors || []).filter(f => f.id !== req.params.flavorId);
  saveDBNow(); res.json({ ok: true });
});
app.post('/api/admin/pairings', requireAdmin, (req, res) => {
  const p = { id: uid(), drink: '', flavor: '', reason: '', ...req.body };
  db.pairings.push(p); saveDBNow(); res.json(p);
});
app.put('/api/admin/pairings/:id', requireAdmin, (req, res) => {
  const i = db.pairings.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not found' });
  db.pairings[i] = { ...db.pairings[i], ...req.body, id: db.pairings[i].id };
  saveDBNow(); res.json(db.pairings[i]);
});
app.delete('/api/admin/pairings/:id', requireAdmin, (req, res) => {
  db.pairings = db.pairings.filter(p => p.id !== req.params.id);
  saveDBNow(); res.json({ ok: true });
});
app.delete('/api/admin/feedback/:id', requireAdmin, (req, res) => {
  db.feedback = db.feedback.filter(f => f.id !== req.params.id);
  saveDBNow(); res.json({ ok: true });
});
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  const flavorNameById = {};
  db.pots.forEach(p => (p.flavors || []).forEach(f => { flavorNameById[f.id] = f.name + ' (' + p.name + ')'; }));
  const topFlavors = Object.entries(db.analytics.flavorViews || {})
    .map(([id, count]) => ({ id, name: flavorNameById[id] || 'Deleted flavor', count }))
    .sort((a, b) => b.count - a.count).slice(0, 20);
  res.json({
    totalViews: db.analytics.totalViews || 0,
    uniqueVisitors: (db.analytics.uniqueVisitors || []).length,
    hourlyTraffic: db.analytics.hourlyTraffic || Array(24).fill(0),
    dailyTraffic: db.analytics.dailyTraffic || {},
    topFlavors, feedbackCount: db.feedback.length
  });
});
app.post('/api/admin/analytics/reset', requireAdmin, (req, res) => {
  db.analytics = { totalViews: 0, uniqueVisitors: [], flavorViews: {}, hourlyTraffic: Array(24).fill(0), dailyTraffic: {} };
  saveDBNow(); res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log('\n🌬  Smokzy menu running at  http://localhost:' + PORT);
  console.log('   Admin panel at            http://localhost:' + PORT + '/admin');
  console.log('   Default admin password:   ' + ADMIN_PASSWORD);
  console.log('   AI image generation:      ' + (OPENAI_API_KEY ? 'ENABLED' : 'disabled (set OPENAI_API_KEY to enable)') + '\n');
});
