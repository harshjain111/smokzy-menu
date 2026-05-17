// Smokzy interactive menu — Express backend (Supabase + Vercel)
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('./lib/db');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smokzy2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-prod-please';

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
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'no file' });
    try {
      const url = await db.uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json({ url });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// ---- DYNAMIC PRICING ----
// Single source of truth for every flavour price:
//   signature → pot.basePrice
//   imported  → pot.basePrice + settings.importedUpcharge
// Per-flavour `price` fields are ignored (kept null in the DB by schema-v5).
function priceFor(pot, fl, upcharge) {
  const base = Number((pot && pot.basePrice) || 0);
  const blend = (fl && fl.blendType) || 'signature';
  const up = Number(upcharge || 0);
  return blend === 'imported' ? base + up : base;
}
function enrichPotPrices(pots, upcharge) {
  return (pots || []).map(p => ({
    ...p,
    importedPrice: Number(p.basePrice || 0) + Number(upcharge || 0),
    flavors: (p.flavors || []).map(f => ({ ...f, price: priceFor(p, f, upcharge) }))
  }));
}

// public read
app.get('/api/menu', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const [potsRaw, pairings, library] = await Promise.all([db.getPots(), db.getPairings(), db.listLibrary()]);
    const upcharge = Number(settings.importedUpcharge || 0);
    const pots = enrichPotPrices(potsRaw, upcharge);
    res.json({
      brand: settings.brandName || 'Smokzy',
      settings: {
        brandName: settings.brandName || 'SMOKZY', tagline: settings.tagline || '',
        logoUrl: settings.logoUrl || '', partnerName: settings.partnerName || '',
        partnerLogoUrl: settings.partnerLogoUrl || '',
        highlights: settings.highlights || { enabled: false, items: [] },
        importedUpcharge: upcharge
      },
      cover: settings.cover || {}, founderNote: settings.founderNote || {},
      pots, pairings, library
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/track/view', async (req, res) => {
  try { await db.trackView((req.body && req.body.visitorId) || 'anon'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/track/flavor', async (req, res) => {
  const flavorId = req.body && req.body.flavorId;
  if (!flavorId) return res.status(400).json({ error: 'flavorId required' });
  try { await db.trackFlavor(flavorId); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/feedback', async (req, res) => {
  const b = req.body || {};
  if (!b.rating) return res.status(400).json({ error: 'rating required' });
  try { await db.createFeedback(b); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// admin auth
app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'wrong password' });
  res.cookie('smokzy_admin', signToken({ role: 'admin', iat: Date.now() }), {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7*24*60*60*1000
  });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('smokzy_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => {
  const tok = verifyToken(req.cookies && req.cookies.smokzy_admin);
  res.json({ admin: !!(tok && tok.role === 'admin') });
});

app.get('/api/admin/data', requireAdmin, async (req, res) => { try { res.json(await db.getEverything()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/cover', requireAdmin, async (req, res) => { try { res.json(await db.setCover(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/founder', requireAdmin, async (req, res) => { try { res.json(await db.setFounderNote(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/settings', requireAdmin, async (req, res) => { try { res.json(await db.updateSettings(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });

// pots
app.post('/api/admin/pots', requireAdmin, async (req, res) => { try { res.json(await db.createPot(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/pots/:id', requireAdmin, async (req, res) => { try { res.json(await db.updatePot(req.params.id, req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/admin/pots/:id', requireAdmin, async (req, res) => { try { await db.deletePot(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/pots-reorder', requireAdmin, async (req, res) => {
  try {
    const order = (req.body && req.body.order) || [];
    for (let i = 0; i < order.length; i++) await db.updatePot(order[i], { position: i });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// inline flavors
app.post('/api/admin/pots/:potId/flavors', requireAdmin, async (req, res) => { try { res.json(await db.createFlavor(req.params.potId, req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/pots/:potId/flavors/:flavorId', requireAdmin, async (req, res) => { try { res.json(await db.updateFlavor(req.params.potId, req.params.flavorId, req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/admin/pots/:potId/flavors/:flavorId', requireAdmin, async (req, res) => { try { await db.deleteFlavor(req.params.potId, req.params.flavorId); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// master library
app.get('/api/admin/library', requireAdmin, async (req, res) => { try { res.json(await db.listLibrary()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/admin/library', requireAdmin, async (req, res) => { try { res.json(await db.createLibraryFlavor(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/library/:id', requireAdmin, async (req, res) => { try { res.json(await db.updateLibraryFlavor(req.params.id, req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/admin/library/:id', requireAdmin, async (req, res) => { try { await db.deleteLibraryFlavor(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// pot ↔ library links
app.post('/api/admin/pots/:potId/library', requireAdmin, async (req, res) => {
  try {
    const ids = (req.body && req.body.libraryIds) || [];
    await db.linkLibraryToPot(req.params.potId, ids);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/pots/:potId/library/:libraryId', requireAdmin, async (req, res) => {
  try { await db.unlinkLibraryFromPot(req.params.potId, req.params.libraryId); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/pots/:potId/library/:libraryId', requireAdmin, async (req, res) => {
  try {
    const po = req.body && req.body.priceOverride;
    await db.setLinkPriceOverride(req.params.potId, req.params.libraryId, po == null || po === '' ? null : Number(po));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// pairings + feedback
app.post('/api/admin/pairings', requireAdmin, async (req, res) => { try { res.json(await db.createPairing(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/admin/pairings/:id', requireAdmin, async (req, res) => { try { res.json(await db.updatePairing(req.params.id, req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/admin/pairings/:id', requireAdmin, async (req, res) => { try { await db.deletePairing(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/admin/feedback/:id', requireAdmin, async (req, res) => { try { await db.deleteFeedback(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

// analytics
app.get('/api/admin/analytics', requireAdmin, async (req, res) => { try { res.json(await db.getAnalytics()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/admin/analytics/reset', requireAdmin, async (req, res) => { try { await db.resetAnalytics(); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n🌬  Smokzy menu running at  http://localhost:' + PORT);
    console.log('   Admin panel at            http://localhost:' + PORT + '/admin');
    console.log('   Default admin password:   ' + ADMIN_PASSWORD);
    console.log('   Supabase:                 ' + (process.env.SUPABASE_URL || '⚠ NOT SET') + '\n');
  });
}
module.exports = app;
