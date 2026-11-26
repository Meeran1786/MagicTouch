# MagicTouch wall app

The classroom product: a projector wall that children touch with the MagicTouch IR pen
(or a finger, or a mouse / touch screen), a phone remote for the teacher, and every activity
from Nursery to Intermediate. Look and feel: **Studio** (direction C, decided 24 Nov 2026).

It joins two code bases, both owned by Maqsusi EduTech:

| Part | Where | Came from |
|---|---|---|
| Wall launcher, phone remote, 9-dot pen calibration, IR pen tracker, 126 early-years activities | `public/` | Interactive Wall code bought from Basha (IP assignment signed, 24 Nov 2026), restyled |
| Classes 1–12 and Intermediate activities (JSON templates, lesson packs) | `../webcam/poc/`, served at `/engine/poc/` | Our own engine |
| Server, logins, licence, Studio launcher, theme, music | `server/`, `public/index.html`, `public/launcher.*`, `public/catalog.js`, `public/shared/studio/` | New in this merge |

## Run it on the classroom PC

Needs [Node.js](https://nodejs.org/) 18 or newer and Chrome or Edge. Nothing else, and no internet.

- **Mac:** double-click `Start MagicTouch Wall (Mac).command`
- **Windows:** double-click `start-magictouch-wall-windows.bat`
- **Any:** `node server/index.js`, then open http://localhost:8090/

The first time, the wall asks you to **set up this wall's first login** (for example `room-4b`
and a password of 8+ characters). After that, sign-up is closed: further logins are made by the
school admin (`MT_SIGNUP=always` turns it back on).

**Phone remote:** the server prints a "Phone remote" address such as `http://192.168.1.20:8090/`.
Open it on a phone on the same Wi-Fi and sign in with the same school login. From the phone the
teacher can open any activity on the wall, go back to the menu, lock the wall, and start the pen
calibration.

**Input:** wall ⚙ Settings → IR pen (default), Hand, or Mouse or touch screen (no camera;
for laptops, interactive panels and demos).

## School licence

The wall shows only the classes the school bought. Put the licence in `data/licence.json`
(see `licence.example.json`):

```json
{ "school": "Sunrise Public School, Hyderabad", "levels": ["nursery", "prekg", "lkg", "class-4", "class-10"], "validUntil": "2027-06-30" }
```

Level keys: `nursery`, `prekg`, `lkg`, `class-1` … `class-10`, `inter-1`, `inter-2`.
With no file the wall runs as a **demo licence** showing every class. (Signed licence files are
planned; today the file is trusted as is.)

## Data and privacy

Version 1 stores **no student data**. The only things kept (in `data/store.json`) are the wall
logins (password hashed with scrypt, login tokens stored only as SHA-256 hashes, 30-day sessions)
and, per login, which activity is on the wall and whether it is locked.

## Checks

```
npm test                 # server and API tests (node:test)
npm run check            # nothing loads from the internet; no stock-library markers in any media
npm run test:browser     # opens all activities in Chromium (needs Playwright), server must be running
node tools/asset-audit.js  # rewrites ASSETS-AUDIT.csv
```

## Adding things

- **An early-years activity:** a folder in `public/apps/<id>/` plus an entry in `public/apps.js`,
  then `node tools/localize.js` (links the Studio theme and boot script, swaps CDN links for the
  bundled copies).
- **A Classes 1–12 activity:** a JSON file in `../webcam/poc/activities/` listed in `index.json`.
  It appears on the wall automatically, under its class and subject.

## Assets

`ASSETS-AUDIT.csv` lists every picture, sound and 3D model with its status. Files the review found
with stock-library marks (Adobe Stock, Vecteezy, rawpixel, Epic Stock Media, an artist-signed GIF)
were removed or replaced by our own art (`tools/art/`) or generated sound. The other purchased
media is marked `purchased-unverified`: ask Basha for the source of the photos, GIFs, voice clips
and 3D animals before a public launch.

## Cloud (optional)

`api/[...path].js` runs the same API as a Vercel function with Postgres (`DATABASE_URL`, Neon).
The classroom server can also use Postgres by setting `DATABASE_URL`.
