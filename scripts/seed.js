// One-time seed: push the contents of data.json into Supabase.
// Run with `npm run seed` AFTER you've set SUPABASE_URL + SUPABASE_SERVICE_KEY.

const fs = require('fs');
const path = require('path');
const db = require('../lib/db');

(async () => {
  const file = path.join(__dirname, '..', 'data.json');
  if (!fs.existsSync(file)) { console.error('data.json not found'); process.exit(1); }
  const seed = JSON.parse(fs.readFileSync(file, 'utf8'));

  console.log('→ pushing settings…');
  await db.updateSettings({
    brandName: seed.settings?.brandName,
    tagline: seed.settings?.tagline,
    logoUrl: seed.settings?.logoUrl,
    partnerName: seed.settings?.partnerName,
    partnerLogoUrl: seed.settings?.partnerLogoUrl
  });
  await db.setCover(seed.cover || {});
  await db.setFounderNote(seed.founderNote || {});

  console.log('→ pushing pots & flavors…');
  for (const pot of (seed.pots || [])) {
    try {
      await db.createPot({
        id: pot.id, name: pot.name, tagline: pot.tagline, image: pot.image,
        basePrice: pot.basePrice, description: pot.description
      });
      for (const fl of (pot.flavors || [])) {
        await db.createFlavor(pot.id, {
          id: fl.id, name: fl.name, strength: fl.strength,
          description: fl.description, notes: fl.notes,
          category: fl.category, popular: fl.popular,
          price: fl.price, image: fl.image || ''
        });
      }
      console.log('   ✓', pot.name, '(' + (pot.flavors || []).length + ' flavors)');
    } catch (e) {
      console.warn('   ! pot already exists or error:', pot.name, '—', e.message);
    }
  }

  console.log('→ pushing pairings…');
  for (const p of (seed.pairings || [])) {
    try { await db.createPairing(p); }
    catch (e) { console.warn('   ! pairing skipped:', p.drink, '—', e.message); }
  }

  console.log('\n✓ Seed complete. Visit your app and you should see the menu.\n');
  process.exit(0);
})().catch(e => { console.error('Seed failed:', e); process.exit(1); });
