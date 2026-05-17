// Smokzy data layer — Supabase Postgres + Storage
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('\nMISSING ENV: set SUPABASE_URL and SUPABASE_SERVICE_KEY before starting.\n');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = process.env.SUPABASE_BUCKET || 'menu-images';

function randomId(n) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; const len = n || 16;
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// derive strength_label from numeric strength when not stored
function deriveLabel(strength) {
  const n = Number(strength) || 5;
  if (n <= 3) return 'light';
  if (n <= 7) return 'mild';
  return 'strong';
}
// when admin picks a label, also set a numeric strength so old logic works
function labelToNumber(label) {
  return ({ light: 3, mild: 6, strong: 9 })[label] || 6;
}

function row2settings(r) {
  if (!r) return {};
  return { brandName: r.brand_name, tagline: r.tagline,
           logoUrl: r.logo_url, partnerName: r.partner_name, partnerLogoUrl: r.partner_logo_url,
           cover: r.cover || {}, founderNote: r.founder_note || {},
           highlights: r.highlights || { enabled: false, items: [] },
           importedUpcharge: Number(r.imported_upcharge || 0) };
}
function row2pot(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, tagline: r.tagline, image: r.image,
           basePrice: r.base_price, description: r.description, position: r.position };
}
function row2flavor(r) {
  if (!r) return null;
  return { id: r.id, potId: r.pot_id, name: r.name, strength: r.strength,
           strengthLabel: r.strength_label || deriveLabel(r.strength),
           description: r.description, notes: r.notes || [],
           tags: r.tags || [],
           category: r.category, popular: r.popular, price: r.price,
           image: r.image, position: r.position,
           blendType: r.blend_type || 'signature', source: 'inline' };
}
function row2libraryFlavor(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, blendType: r.blend_type || 'signature',
           strength: r.strength,
           strengthLabel: r.strength_label || deriveLabel(r.strength),
           description: r.description, notes: r.notes || [],
           tags: r.tags || [],
           image: r.image, defaultPrice: r.default_price, popular: r.popular };
}
function row2pairing(r) {
  return { id: r.id, drink: r.drink, flavor: r.flavor, reason: r.reason, position: r.position };
}
function row2feedback(r) {
  return { id: r.id, timestamp: r.created_at, name: r.name, rating: r.rating,
           experience: r.experience, favoriteFlavor: r.favorite_flavor,
           wouldRecommend: r.would_recommend };
}

// ---- SETTINGS ----
async function getSettings() {
  const { data, error } = await sb.from('settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return row2settings(data);
}
async function updateSettings(patch) {
  const u = {};
  if (patch.brandName !== undefined)      u.brand_name = patch.brandName;
  if (patch.tagline !== undefined)        u.tagline = patch.tagline;
  if (patch.logoUrl !== undefined)        u.logo_url = patch.logoUrl;
  if (patch.partnerName !== undefined)    u.partner_name = patch.partnerName;
  if (patch.partnerLogoUrl !== undefined) u.partner_logo_url = patch.partnerLogoUrl;
  if (patch.highlights !== undefined)     u.highlights = patch.highlights;
  if (patch.importedUpcharge !== undefined) u.imported_upcharge = Number(patch.importedUpcharge) || 0;
  const { data, error } = await sb.from('settings').update(u).eq('id', 1).select().maybeSingle();
  if (error) throw error;
  return row2settings(data);
}
async function getCover() { const s = await getSettings(); return s.cover || {}; }
async function setCover(patch) {
  const cur = await getCover();
  const merged = { ...cur, ...patch };
  const { error } = await sb.from('settings').update({ cover: merged }).eq('id', 1);
  if (error) throw error;
  return merged;
}
async function getFounderNote() { const s = await getSettings(); return s.founderNote || {}; }
async function setFounderNote(patch) {
  const cur = await getFounderNote();
  const merged = { ...cur, ...patch };
  const { error } = await sb.from('settings').update({ founder_note: merged }).eq('id', 1);
  if (error) throw error;
  return merged;
}

// ---- POTS ----
async function getPotsRaw() {
  const { data, error } = await sb.from('pots').select('*')
    .order('position', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getPots() {
  const [potsR, flavorsR, linksR, libraryR] = await Promise.all([
    getPotsRaw(),
    sb.from('flavors').select('*').order('position', { ascending: true }),
    sb.from('pot_library_flavors').select('*').order('position', { ascending: true }),
    sb.from('flavor_library').select('*')
  ]);
  if (flavorsR.error) throw flavorsR.error;
  if (linksR.error)   throw linksR.error;
  if (libraryR.error) throw libraryR.error;

  const inlineByPot = {};
  (flavorsR.data || []).forEach(f => {
    (inlineByPot[f.pot_id] = inlineByPot[f.pot_id] || []).push(row2flavor(f));
  });

  const libById = {};
  (libraryR.data || []).forEach(L => { libById[L.id] = L; });

  const linkedByPot = {};
  (linksR.data || []).forEach(link => {
    const L = libById[link.library_id]; if (!L) return;
    const fl = row2libraryFlavor(L);
    fl.source = 'library';
    fl.libraryId = L.id;
    fl.id = 'lib_' + L.id;
    fl.potId = link.pot_id;
    fl.price = link.price_override != null ? link.price_override : L.default_price;
    fl.position = link.position;
    (linkedByPot[link.pot_id] = linkedByPot[link.pot_id] || []).push(fl);
  });

  return potsR.map(p => {
    const all = [...(inlineByPot[p.id] || []), ...(linkedByPot[p.id] || [])]
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    return { ...row2pot(p), flavors: all };
  });
}

async function createPot(d) {
  const id = d.id || randomId();
  const row = { id, name: d.name || '', tagline: d.tagline || '',
                image: d.image || '', base_price: d.basePrice || 0,
                description: d.description || '', position: d.position || 0 };
  const { data, error } = await sb.from('pots').insert(row).select().maybeSingle();
  if (error) throw error;
  return { ...row2pot(data), flavors: [] };
}
async function updatePot(id, p) {
  const u = {};
  if (p.name !== undefined) u.name = p.name;
  if (p.tagline !== undefined) u.tagline = p.tagline;
  if (p.image !== undefined) u.image = p.image;
  if (p.basePrice !== undefined) u.base_price = p.basePrice;
  if (p.description !== undefined) u.description = p.description;
  if (p.position !== undefined) u.position = p.position;
  const { data, error } = await sb.from('pots').update(u).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return row2pot(data);
}
async function deletePot(id) {
  const { error } = await sb.from('pots').delete().eq('id', id);
  if (error) throw error;
}

// ---- INLINE FLAVORS ----
async function createFlavor(potId, d) {
  const id = d.id || randomId();
  const sl = d.strengthLabel || deriveLabel(d.strength);
  const sn = d.strength != null ? d.strength : labelToNumber(sl);
  const row = { id, pot_id: potId, name: d.name || '',
                strength: sn, strength_label: sl,
                description: d.description || '', notes: d.notes || [],
                tags: d.tags || [],
                category: d.category || 'fruit', popular: !!d.popular,
                blend_type: d.blendType || 'signature',
                price: d.price || 0, image: d.image || '', position: d.position || 0 };
  const { data, error } = await sb.from('flavors').insert(row).select().maybeSingle();
  if (error) throw error;
  return row2flavor(data);
}
async function updateFlavor(potId, flavorId, p) {
  const u = {};
  if (p.name !== undefined) u.name = p.name;
  if (p.strengthLabel !== undefined) {
    u.strength_label = p.strengthLabel;
    u.strength = labelToNumber(p.strengthLabel);
  } else if (p.strength !== undefined) {
    u.strength = p.strength;
    u.strength_label = deriveLabel(p.strength);
  }
  if (p.description !== undefined) u.description = p.description;
  if (p.notes !== undefined) u.notes = p.notes;
  if (p.tags !== undefined)  u.tags = p.tags;
  if (p.category !== undefined) u.category = p.category;
  if (p.popular !== undefined) u.popular = p.popular;
  if (p.blendType !== undefined) u.blend_type = p.blendType;
  if (p.price !== undefined) u.price = p.price;
  if (p.image !== undefined) u.image = p.image;
  if (p.position !== undefined) u.position = p.position;
  const { data, error } = await sb.from('flavors').update(u)
    .eq('id', flavorId).eq('pot_id', potId).select().maybeSingle();
  if (error) throw error;
  return row2flavor(data);
}
async function deleteFlavor(potId, flavorId) {
  const { error } = await sb.from('flavors').delete().eq('id', flavorId).eq('pot_id', potId);
  if (error) throw error;
}

// ---- LIBRARY ----
async function listLibrary() {
  const [libR, linksR] = await Promise.all([
    sb.from('flavor_library').select('*').order('blend_type', { ascending: true }).order('name', { ascending: true }),
    sb.from('pot_library_flavors').select('library_id')
  ]);
  if (libR.error) throw libR.error;
  if (linksR.error) throw linksR.error;
  const useCounts = {};
  (linksR.data || []).forEach(l => { useCounts[l.library_id] = (useCounts[l.library_id] || 0) + 1; });
  return (libR.data || []).map(r => ({ ...row2libraryFlavor(r), usedInPots: useCounts[r.id] || 0 }));
}
async function createLibraryFlavor(d) {
  const id = d.id || randomId();
  const sl = d.strengthLabel || deriveLabel(d.strength);
  const sn = d.strength != null ? d.strength : labelToNumber(sl);
  const row = { id, name: d.name || '',
                blend_type: d.blendType === 'imported' ? 'imported' : 'signature',
                strength: sn, strength_label: sl,
                description: d.description || '', notes: d.notes || [],
                tags: d.tags || [],
                image: d.image || '', default_price: d.defaultPrice || 0,
                popular: !!d.popular };
  const { data, error } = await sb.from('flavor_library').insert(row).select().maybeSingle();
  if (error) throw error;
  return row2libraryFlavor(data);
}
async function updateLibraryFlavor(id, p) {
  const u = {};
  if (p.name !== undefined) u.name = p.name;
  if (p.blendType !== undefined) u.blend_type = p.blendType === 'imported' ? 'imported' : 'signature';
  if (p.strengthLabel !== undefined) {
    u.strength_label = p.strengthLabel;
    u.strength = labelToNumber(p.strengthLabel);
  } else if (p.strength !== undefined) {
    u.strength = p.strength;
    u.strength_label = deriveLabel(p.strength);
  }
  if (p.description !== undefined) u.description = p.description;
  if (p.notes !== undefined) u.notes = p.notes;
  if (p.tags !== undefined)  u.tags = p.tags;
  if (p.image !== undefined) u.image = p.image;
  if (p.defaultPrice !== undefined) u.default_price = p.defaultPrice;
  if (p.popular !== undefined) u.popular = p.popular;
  const { data, error } = await sb.from('flavor_library').update(u).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return row2libraryFlavor(data);
}
async function deleteLibraryFlavor(id) {
  const { error } = await sb.from('flavor_library').delete().eq('id', id);
  if (error) throw error;
}

// ---- LINKS ----
async function linkLibraryToPot(potId, libraryIds) {
  const rows = libraryIds.map((libId, i) => ({ pot_id: potId, library_id: libId, position: i }));
  if (!rows.length) return [];
  const { error } = await sb.from('pot_library_flavors').upsert(rows, { onConflict: 'pot_id,library_id' });
  if (error) throw error;
  return rows;
}
async function unlinkLibraryFromPot(potId, libraryId) {
  const { error } = await sb.from('pot_library_flavors')
    .delete().eq('pot_id', potId).eq('library_id', libraryId);
  if (error) throw error;
}
async function setLinkPriceOverride(potId, libraryId, priceOverride) {
  const { error } = await sb.from('pot_library_flavors')
    .update({ price_override: priceOverride })
    .eq('pot_id', potId).eq('library_id', libraryId);
  if (error) throw error;
}

// ---- PAIRINGS ----
async function getPairings() {
  const { data, error } = await sb.from('pairings').select('*').order('position', { ascending: true });
  if (error) throw error;
  return (data || []).map(row2pairing);
}
async function createPairing(d) {
  const id = d.id || randomId();
  const { data, error } = await sb.from('pairings').insert({
    id, drink: d.drink || '', flavor: d.flavor || '', reason: d.reason || '', position: d.position || 0
  }).select().maybeSingle();
  if (error) throw error;
  return row2pairing(data);
}
async function updatePairing(id, p) {
  const u = {};
  if (p.drink !== undefined)  u.drink = p.drink;
  if (p.flavor !== undefined) u.flavor = p.flavor;
  if (p.reason !== undefined) u.reason = p.reason;
  const { data, error } = await sb.from('pairings').update(u).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return row2pairing(data);
}
async function deletePairing(id) {
  const { error } = await sb.from('pairings').delete().eq('id', id);
  if (error) throw error;
}

// ---- FEEDBACK ----
async function listFeedback() {
  const { data, error } = await sb.from('feedback').select('*')
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).map(row2feedback);
}
async function createFeedback(d) {
  const id = randomId();
  const { error } = await sb.from('feedback').insert({
    id, name: (d.name || '').slice(0, 80),
    rating: Math.max(1, Math.min(5, Number(d.rating) || 5)),
    experience: (d.experience || '').slice(0, 1000),
    favorite_flavor: (d.favoriteFlavor || '').slice(0, 80),
    would_recommend: !!d.wouldRecommend
  });
  if (error) throw error;
}
async function deleteFeedback(id) {
  const { error } = await sb.from('feedback').delete().eq('id', id);
  if (error) throw error;
}

// ---- ANALYTICS ----
async function trackView(visitorId) {
  const { error } = await sb.from('analytics_events').insert({ type: 'view', visitor_id: visitorId || 'anon' });
  if (error) throw error;
}
async function trackFlavor(flavorId) {
  const { error } = await sb.from('analytics_events').insert({ type: 'flavor_tap', flavor_id: flavorId });
  if (error) throw error;
}
async function getAnalytics() {
  const [views, taps] = await Promise.all([
    sb.from('analytics_events').select('id, created_at, visitor_id', { count: 'exact' }).eq('type', 'view'),
    sb.from('analytics_events').select('flavor_id').eq('type', 'flavor_tap')
  ]);
  if (views.error) throw views.error;
  if (taps.error) throw taps.error;
  const totalViews = views.count || (views.data || []).length;
  const uniqueVisitors = new Set((views.data || []).map(v => v.visitor_id)).size;
  const hourly = Array(24).fill(0);
  const daily = {};
  (views.data || []).forEach(v => {
    const dt = new Date(v.created_at);
    hourly[dt.getHours()]++;
    const day = dt.toISOString().slice(0, 10);
    daily[day] = (daily[day] || 0) + 1;
  });
  const fc = {};
  (taps.data || []).forEach(t => { fc[t.flavor_id] = (fc[t.flavor_id] || 0) + 1; });
  const flavorIds = Object.keys(fc);
  const nameById = {};
  if (flavorIds.length) {
    const realIds = flavorIds.filter(x => !x.startsWith('lib_'));
    const libIds  = flavorIds.filter(x => x.startsWith('lib_')).map(x => x.slice(4));
    if (realIds.length) {
      const { data: fs } = await sb.from('flavors').select('id, name, pot_id').in('id', realIds);
      const potIds = [...new Set((fs || []).map(f => f.pot_id))];
      const { data: ps } = await sb.from('pots').select('id, name').in('id', potIds);
      const pn = {}; (ps || []).forEach(p => pn[p.id] = p.name);
      (fs || []).forEach(f => nameById[f.id] = f.name + ' (' + (pn[f.pot_id] || '') + ')');
    }
    if (libIds.length) {
      const { data: ls } = await sb.from('flavor_library').select('id, name').in('id', libIds);
      (ls || []).forEach(l => nameById['lib_' + l.id] = l.name + ' (library)');
    }
  }
  const topFlavors = Object.entries(fc)
    .map(([id, count]) => ({ id, name: nameById[id] || 'Deleted flavor', count }))
    .sort((a, b) => b.count - a.count).slice(0, 20);
  const fb = await sb.from('feedback').select('id', { count: 'exact', head: true });
  return { totalViews, uniqueVisitors, hourlyTraffic: hourly, dailyTraffic: daily,
           topFlavors, feedbackCount: fb.count || 0 };
}
async function resetAnalytics() {
  const { error } = await sb.from('analytics_events').delete().neq('id', 0);
  if (error) throw error;
}

// ---- STORAGE ----
async function uploadImage(buffer, originalName, mimeType) {
  const ext = (originalName.match(/\.[a-z0-9]+$/i) || [])[0] || '.jpg';
  const fileName = Date.now() + '-' + randomId(6) + ext;
  const { error } = await sb.storage.from(BUCKET).upload(fileName, buffer, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function getEverything() {
  const [settings, pots, pairings, feedback, analytics, library] = await Promise.all([
    getSettings(), getPots(), getPairings(), listFeedback(), getAnalytics(), listLibrary()
  ]);
  const upcharge = Number(settings.importedUpcharge || 0);
  // mirror customer-side pricing: signature = pot.basePrice, imported = + upcharge
  const pricedPots = pots.map(p => ({
    ...p,
    importedPrice: Number(p.basePrice || 0) + upcharge,
    flavors: (p.flavors || []).map(f => ({
      ...f,
      price: ((f.blendType || 'signature') === 'imported')
        ? Number(p.basePrice || 0) + upcharge
        : Number(p.basePrice || 0)
    }))
  }));
  return {
    settings: { brandName: settings.brandName, tagline: settings.tagline,
                logoUrl: settings.logoUrl, partnerName: settings.partnerName,
                partnerLogoUrl: settings.partnerLogoUrl,
                highlights: settings.highlights || { enabled: false, items: [] },
                importedUpcharge: upcharge },
    pots: pricedPots, pairings, feedback, analytics, library
  };
}

module.exports = {
  getSettings, updateSettings, getCover, setCover, getFounderNote, setFounderNote,
  getPots, createPot, updatePot, deletePot,
  createFlavor, updateFlavor, deleteFlavor,
  listLibrary, createLibraryFlavor, updateLibraryFlavor, deleteLibraryFlavor,
  linkLibraryToPot, unlinkLibraryFromPot, setLinkPriceOverride,
  getPairings, createPairing, updatePairing, deletePairing,
  listFeedback, createFeedback, deleteFeedback,
  trackView, trackFlavor, getAnalytics, resetAnalytics,
  uploadImage, randomId, getEverything
};
