// Smokzy data layer — Supabase Postgres + Storage
// All routes go through this so the rest of the app stays storage-agnostic.

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('\nMISSING ENV: set SUPABASE_URL and SUPABASE_SERVICE_KEY before starting.\n');
  console.error('Get them from your Supabase project: Settings → API.\n');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = process.env.SUPABASE_BUCKET || 'menu-images';

// ---- helpers: snake_case <-> camelCase ----
function row2settings(r) {
  if (!r) return {};
  return {
    brandName: r.brand_name, tagline: r.tagline,
    logoUrl: r.logo_url, partnerName: r.partner_name, partnerLogoUrl: r.partner_logo_url,
    cover: r.cover || {}, founderNote: r.founder_note || {}
  };
}
function row2pot(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, tagline: r.tagline, image: r.image,
           basePrice: r.base_price, description: r.description, position: r.position };
}
function row2flavor(r) {
  if (!r) return null;
  return { id: r.id, potId: r.pot_id, name: r.name, strength: r.strength,
           description: r.description, notes: r.notes || [], category: r.category,
           popular: r.popular, price: r.price, image: r.image, position: r.position };
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
  const update = {};
  if (patch.brandName !== undefined)      update.brand_name = patch.brandName;
  if (patch.tagline !== undefined)        update.tagline = patch.tagline;
  if (patch.logoUrl !== undefined)        update.logo_url = patch.logoUrl;
  if (patch.partnerName !== undefined)    update.partner_name = patch.partnerName;
  if (patch.partnerLogoUrl !== undefined) update.partner_logo_url = patch.partnerLogoUrl;
  const { data, error } = await sb.from('settings').update(update).eq('id', 1).select().maybeSingle();
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

// ---- POTS + FLAVORS ----
async function getPots() {
  const [pots, flavors] = await Promise.all([
    sb.from('pots').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
    sb.from('flavors').select('*').order('position', { ascending: true })
  ]);
  if (pots.error) throw pots.error;
  if (flavors.error) throw flavors.error;
  const byPot = {};
  flavors.data.forEach(f => { (byPot[f.pot_id] = byPot[f.pot_id] || []).push(row2flavor(f)); });
  return pots.data.map(p => ({ ...row2pot(p), flavors: byPot[p.id] || [] }));
}
async function createPot(data) {
  const id = data.id || randomId();
  const row = { id, name: data.name || '', tagline: data.tagline || '',
                image: data.image || '', base_price: data.basePrice || 0,
                description: data.description || '', position: data.position || 0 };
  const { data: r, error } = await sb.from('pots').insert(row).select().maybeSingle();
  if (error) throw error;
  return { ...row2pot(r), flavors: [] };
}
async function updatePot(id, patch) {
  const update = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.tagline !== undefined) update.tagline = patch.tagline;
  if (patch.image !== undefined) update.image = patch.image;
  if (patch.basePrice !== undefined) update.base_price = patch.basePrice;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.position !== undefined) update.position = patch.position;
  const { data, error } = await sb.from('pots').update(update).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return row2pot(data);
}
async function deletePot(id) {
  const { error } = await sb.from('pots').delete().eq('id', id);
  if (error) throw error;
}
async function createFlavor(potId, data) {
  const id = data.id || randomId();
  const row = { id, pot_id: potId, name: data.name || '', strength: data.strength || 5,
                description: data.description || '', notes: data.notes || [],
                category: data.category || 'fruit', popular: !!data.popular,
                price: data.price || 0, image: data.image || '',
                position: data.position || 0 };
  const { data: r, error } = await sb.from('flavors').insert(row).select().maybeSingle();
  if (error) throw error;
  return row2flavor(r);
}
async function updateFlavor(potId, flavorId, patch) {
  const update = {};
  if (patch.name !== undefined)        update.name = patch.name;
  if (patch.strength !== undefined)    update.strength = patch.strength;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.notes !== undefined)       update.notes = patch.notes;
  if (patch.category !== undefined)    update.category = patch.category;
  if (patch.popular !== undefined)     update.popular = patch.popular;
  if (patch.price !== undefined)       update.price = patch.price;
  if (patch.image !== undefined)       update.image = patch.image;
  if (patch.position !== undefined)    update.position = patch.position;
  const { data, error } = await sb.from('flavors').update(update).eq('id', flavorId).eq('pot_id', potId).select().maybeSingle();
  if (error) throw error;
  return row2flavor(data);
}
async function deleteFlavor(potId, flavorId) {
  const { error } = await sb.from('flavors').delete().eq('id', flavorId).eq('pot_id', potId);
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
async function updatePairing(id, patch) {
  const update = {};
  if (patch.drink !== undefined)  update.drink = patch.drink;
  if (patch.flavor !== undefined) update.flavor = patch.flavor;
  if (patch.reason !== undefined) update.reason = patch.reason;
  const { data, error } = await sb.from('pairings').update(update).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return row2pairing(data);
}
async function deletePairing(id) {
  const { error } = await sb.from('pairings').delete().eq('id', id);
  if (error) throw error;
}

// ---- FEEDBACK ----
async function listFeedback() {
  const { data, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(500);
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
  const [views, flavorTaps] = await Promise.all([
    sb.from('analytics_events').select('id, created_at, visitor_id', { count: 'exact' }).eq('type', 'view'),
    sb.from('analytics_events').select('flavor_id').eq('type', 'flavor_tap')
  ]);
  if (views.error) throw views.error;
  if (flavorTaps.error) throw flavorTaps.error;

  const totalViews = views.count || (views.data || []).length;
  const uniqueVisitors = new Set((views.data || []).map(v => v.visitor_id)).size;

  const hourly = Array(24).fill(0);
  const daily = {};
  (views.data || []).forEach(v => {
    const d = new Date(v.created_at);
    hourly[d.getHours()]++;
    const day = d.toISOString().slice(0, 10);
    daily[day] = (daily[day] || 0) + 1;
  });

  const flavorCounts = {};
  (flavorTaps.data || []).forEach(t => { flavorCounts[t.flavor_id] = (flavorCounts[t.flavor_id] || 0) + 1; });

  // resolve flavor names
  const flavorIds = Object.keys(flavorCounts);
  let nameById = {};
  if (flavorIds.length) {
    const { data: flavorsData } = await sb.from('flavors').select('id, name, pot_id').in('id', flavorIds);
    const potIds = [...new Set((flavorsData || []).map(f => f.pot_id))];
    const { data: potsData } = await sb.from('pots').select('id, name').in('id', potIds);
    const potNameById = {};
    (potsData || []).forEach(p => { potNameById[p.id] = p.name; });
    (flavorsData || []).forEach(f => { nameById[f.id] = f.name + ' (' + (potNameById[f.pot_id] || '') + ')'; });
  }
  const topFlavors = Object.entries(flavorCounts)
    .map(([id, count]) => ({ id, name: nameById[id] || 'Deleted flavor', count }))
    .sort((a, b) => b.count - a.count).slice(0, 20);

  const fbCount = await sb.from('feedback').select('id', { count: 'exact', head: true });

  return {
    totalViews, uniqueVisitors,
    hourlyTraffic: hourly, dailyTraffic: daily, topFlavors,
    feedbackCount: fbCount.count || 0
  };
}
async function resetAnalytics() {
  const { error } = await sb.from('analytics_events').delete().neq('id', 0);
  if (error) throw error;
}

// ---- STORAGE (image uploads) ----
async function uploadImage(buffer, originalName, mimeType) {
  const ext = (originalName.match(/\.[a-z0-9]+$/i) || [])[0] || '.jpg';
  const fileName = Date.now() + '-' + randomId(6) + ext;
  const { error } = await sb.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: mimeType, upsert: false
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

function randomId(n) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  const len = n || 16;
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// dump everything for the admin "edit all" view
async function getEverything() {
  const [settings, pots, pairings, feedback, analytics] = await Promise.all([
    getSettings(), getPots(), getPairings(), listFeedback(), getAnalytics()
  ]);
  return {
    settings: { brandName: settings.brandName, tagline: settings.tagline,
                logoUrl: settings.logoUrl, partnerName: settings.partnerName,
                partnerLogoUrl: settings.partnerLogoUrl },
    cover: settings.cover, founderNote: settings.founderNote,
    pots, pairings, feedback, analytics
  };
}

module.exports = {
  getSettings, updateSettings,
  getCover, setCover, getFounderNote, setFounderNote,
  getPots, createPot, updatePot, deletePot,
  createFlavor, updateFlavor, deleteFlavor,
  getPairings, createPairing, updatePairing, deletePairing,
  listFeedback, createFeedback, deleteFeedback,
  trackView, trackFlavor, getAnalytics, resetAnalytics,
  uploadImage, randomId, getEverything
};
