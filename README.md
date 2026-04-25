# Smokzy — Interactive Flip-Book Menu

A digital menu that feels like a leather-bound storybook. Customers flip through pages, tap any flavor to reveal its strength, story and tasting notes. You manage everything — cover art, founder's note, pots, flavors, prices, pairings — from a separate admin panel. Every view, every flavor tap, and every guest feedback gets tracked.

## What's inside

```
smokzy-menu/
├── server.js              # Express backend + REST API
├── data.json              # The "database" (seeded with sample Smokzy content)
├── package.json
└── public/
    ├── index.html         # Customer flip-book menu
    ├── admin.html         # Admin panel (separate page)
    ├── css/menu.css       # Book styling (dark luxe)
    ├── css/admin.css      # Admin styling (clean)
    ├── js/menu.js         # Flip animation + flavor modal + tracking
    └── js/admin.js        # CRUD + login + dashboard
```

## Run it locally

```bash
cd smokzy-menu
npm install
npm start
```

Then open:

- Customer menu: <http://localhost:3000/>
- Admin panel:   <http://localhost:3000/admin>  (or `/admin.html` — both work)
- Default admin password: `smokzy2026`

> If you get an `npm error ENOENT` saying it can't find `package.json`, you ran the command from the wrong folder. `cd` into `smokzy-menu` first, then `npm install`.

Override the password and session secret with environment variables:

```bash
ADMIN_PASSWORD="your-strong-password" SESSION_SECRET="a-long-random-string" npm start
```

## What the customer sees

1. **Cover** — opens with the Smokzy crest and "Tap to open" pulse
2. **Founder's note** — quote on the left, full story on the right
3. **Pot pages** — each pot gets a full image on the left and its flavor list on the right. Tap any flavor → modal pops up with strength meter, description, and tasting notes
4. **Recommended pairings** — a chapter showing the best flavor for each drink
5. **Feedback** — guests rate the experience and leave a note

Customers can flip pages by:

- Clicking on a page
- Using arrow buttons at the bottom
- Pressing ← / → keys
- Swiping on touch devices

## What the admin sees

The admin panel has 6 tabs:

- **Dashboard** — total views, unique visitors, peak hour, hourly heatmap, most-viewed flavors, reset button
- **Branding** — Smokzy logo upload, partner venue name + logo, brand name & tagline. Both logos appear on the cover ("Presented at…") and back cover.
- **Cover & Founder** — edit title, subtitle, background image (upload or paste URL), founder body, signature
- **Pots & Flavors** — add/edit/delete pots (image upload, name, tagline, base price, description) and their flavors (name, strength 1–10, price, description, "popular" tag). Add as many pots as you like — each pot gets its own page in the book.
- **Pairings** — add/edit/delete drink → flavor pairings with reasoning
- **Feedback** — see every guest submission with rating, name, tonight's favorite, comments, and recommendation flag

Every change in the admin saves to `data.json` instantly and is reflected on the next customer menu load.

### Image uploads

Anywhere you see an "Upload…" button (cover background, Smokzy logo, partner logo, pot image, flavor image), you can upload a PNG/JPG/SVG up to 8MB. Files are saved into `public/uploads/` and served from your domain — no external image host needed.

### AI image generation (optional)

Each flavor row has a `✨` button. Click it and the server will use OpenAI's `dall-e-3` to generate a moody, on-brand photo of that flavor's components based on its name and description, save it to `public/uploads/`, and attach it to the flavor automatically.

To enable it, set the `OPENAI_API_KEY` environment variable before starting the server.

**Windows (Command Prompt):**

```
set OPENAI_API_KEY=sk-your-key-here
npm start
```

**Windows (PowerShell):**

```
$env:OPENAI_API_KEY = "sk-your-key-here"
npm start
```

**macOS / Linux:**

```
OPENAI_API_KEY=sk-your-key-here npm start
```

Get a key at <https://platform.openai.com/api-keys>. Each generation costs about ₹3-4 (USD 0.04) at current dall-e-3 pricing. If the key isn't set, the `✨` button will tell you exactly what to do — the rest of the app keeps working.

To make the key permanent on a deployed server, add it to your hosting platform's environment variables (Render, Railway, Fly all have a UI for this).

## Analytics that get tracked

- `POST /api/track/view` — fired once when the menu opens, increments total views, adds visitor id to unique set, and bumps the current hour and date counters
- `POST /api/track/flavor` — fired when a customer taps a flavor card, increments that flavor's tap count
- Admin dashboard exposes:
  - Total views
  - Unique visitors (by browser localStorage id)
  - Most active hour
  - 24-cell hourly heatmap (rolling, all-time)
  - Top 20 most-viewed flavors
  - Total feedback count

## Going live

This prototype writes to a single `data.json` file. That's perfectly fine for one venue with hundreds or even a few thousand views per day, but for multiple locations or analytics dashboards used during peak hours, swap the `loadDB()` / `saveDB()` calls in `server.js` for a real database. Two easy paths:

- **Supabase / Neon Postgres** — change `loadDB`/`saveDB` to issue SQL via `pg`. Same routes, no client changes.
- **Firebase Firestore** — replace the JSON file with collections (`pots`, `pairings`, `feedback`, `analytics`).

### Deploying

The simplest options today:

| Host | Steps |
|---|---|
| **Render** | Connect repo, set start command `npm start`, add `ADMIN_PASSWORD` env var. Free tier works. |
| **Railway** | `railway up`, set env vars in dashboard. |
| **Fly.io** | `fly launch` then `fly deploy`. Mount a volume so `data.json` persists. |
| **VPS (Hostinger/DigitalOcean)** | `pm2 start server.js`, point Nginx to port 3000, add SSL with Certbot. |

For QR-code menus on tables, point the QR at `https://yourdomain.com/?table=5` — the `?table` param is logged on the server and you can extend `track/view` to record table-level analytics later.

## Security notes for production

1. Change `ADMIN_PASSWORD` to something strong via env var
2. Set `SESSION_SECRET` to a long random string via env var
3. Put the app behind HTTPS (any of the above hosts handle that automatically)
4. If you ever connect to a real DB, sanitise inputs and add rate-limiting on `/api/feedback` and `/api/track/*`

## Customizing the book theme

The look lives in `public/css/menu.css`. The CSS variables at the top control the entire palette:

```css
:root {
  --paper:       #f4ecdc;   /* page color */
  --ink:         #1c1814;   /* text */
  --gold:        #c9a86a;   /* accents */
  --burgundy:    #5a1a1f;   /* highlights & strength meter */
  --serif:       'Cormorant Garamond', Georgia, serif;
}
```

Change those four colors and the entire book reskins.

---

Built for Smokzy · The Art of Shisha
