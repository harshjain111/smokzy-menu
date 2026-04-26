# Deploying Smokzy on Supabase + Vercel

This is the production setup. You'll do steps 1–4 in your browser (Supabase + Vercel dashboards), then a couple of CLI commands.

Total time: ~15 minutes.

---

## 1. Create the Supabase project (3 min)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub
2. **New project**
   - Name: `smokzy-menu`
   - Region: pick the one closest to your venue (for Terra Mayaa: **Mumbai (ap-south-1)**)
   - Database password: generate a strong one, save it in your password manager
   - Plan: **Free** (works for one venue)
3. Wait ~2 min for the project to provision

## 2. Run the schema (1 min)

1. In your Supabase project: **SQL Editor** (left sidebar) → **New query**
2. Open `lib/schema.sql` from this repo, copy all of it, paste into the editor
3. Click **Run** (bottom right)
4. You should see "Success. No rows returned"

This creates all tables (`settings`, `pots`, `flavors`, `pairings`, `feedback`, `analytics_events`) and the `menu-images` storage bucket.

## 3. Get your API keys (1 min)

1. **Settings → API** in the Supabase sidebar
2. Copy two values into a notepad:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **service_role key** under "Project API keys" — click the eye icon to reveal. Use the `service_role` one, NOT the `anon` one. This bypasses Row Level Security and is server-only.

## 4. Push code to GitHub (3 min)

If you don't have the project on GitHub yet:

```bash
cd C:\Users\ASUS\Desktop\smokzy-menu
git init
git add .
git commit -m "Smokzy menu — Supabase + Vercel"
```

Then go to <https://github.com/new>, create a new repo called `smokzy-menu` (private if you prefer), and follow the "push existing repo" instructions GitHub gives you. Roughly:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/smokzy-menu.git
git push -u origin main
```

## 5. Deploy on Vercel (3 min)

1. Go to <https://vercel.com> → **Sign up with GitHub**
2. **Add New → Project** → select your `smokzy-menu` repo → **Import**
3. Framework preset: **Other** (Vercel will auto-detect from `vercel.json`)
4. Open the **Environment Variables** section and add four:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from step 3 |
   | `SUPABASE_SERVICE_KEY` | the service_role key from step 3 |
   | `ADMIN_PASSWORD` | pick a strong password — this replaces `smokzy2026` |
   | `SESSION_SECRET` | any long random string (40+ chars) |

5. Click **Deploy**. Wait 60-90 seconds.
6. Vercel gives you a URL like `https://smokzy-menu.vercel.app`. Click it.

You'll see the menu cover BUT it'll be empty (no pots yet) because Supabase is empty.

## 6. Seed the initial data (2 min)

On your local machine, with the same Supabase env vars set:

**Windows:**
```cmd
set SUPABASE_URL=https://xxxxx.supabase.co
set SUPABASE_SERVICE_KEY=eyJ...
npm run seed
```

**Mac/Linux:**
```bash
SUPABASE_URL=https://xxxxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... npm run seed
```

You should see:
```
→ pushing settings…
→ pushing pots & flavors…
   ✓ The Classic Glass (3 flavors)
   ✓ Smokzy Royale (3 flavors)
   ✓ Fruit Garden (3 flavors)
→ pushing pairings…
✓ Seed complete.
```

Refresh your Vercel URL — the full menu now loads.

## 7. You're live

- Customer menu: `https://smokzy-menu.vercel.app`
- Admin panel: `https://smokzy-menu.vercel.app/admin` (use the password from step 5)

Every change made in admin saves to Supabase instantly. Every menu view, flavor tap, and feedback gets logged. Vercel auto-deploys whenever you push to GitHub.

---

## Custom domain

In Vercel: **Project → Settings → Domains** → add `menu.terramayaa.com` (or whatever you like). They'll show you the CNAME to set at your DNS provider. SSL is automatic.

---

## QR code for the table

Print a QR pointing at `https://menu.terramayaa.com` (or your Vercel URL). Use any free QR generator. Stick it on the table next to the ashtray. Each scan auto-logs as a view, the analytics dashboard updates in real time.

---

## Local development

You can still run locally — it'll talk to the same Supabase database:

```cmd
cd smokzy-menu
npm install
set SUPABASE_URL=https://xxxxx.supabase.co
set SUPABASE_SERVICE_KEY=eyJ...
npm start
```

Open <http://localhost:3000>. Changes you make locally hit the live database, so be careful — or create a separate Supabase project for staging.

---

## Troubleshooting

**"MISSING ENV: set SUPABASE_URL and SUPABASE_SERVICE_KEY"**
You forgot to add the env vars in Vercel (or locally). Add them and redeploy / restart.

**Images don't appear after upload**
Check Supabase → Storage → `menu-images` bucket exists and is set to **Public**. The schema.sql creates it, but if you skipped that step, click "New bucket" in the Storage UI and set Public: ON.

**Admin password doesn't work**
Make sure you added `ADMIN_PASSWORD` env var in Vercel and redeployed. Without it, the default is still `smokzy2026`.

**Cookie / login issues on Vercel but not local**
The cookie is set with `secure: true` in production. This means it only works over HTTPS. Since Vercel gives you HTTPS by default, this should just work — but if you're testing on a custom http:// domain, switch to https://.
