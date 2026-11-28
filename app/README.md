# MagicTouch wall app

The classroom product: a projector wall that children touch with the MagicTouch IR pen
(or a finger, or a mouse / touch screen), a phone remote for the teacher, and every activity
from Nursery to Intermediate. Look and feel: **Studio** (direction C, decided 24 Nov 2026).

Everything is one code base, owned by Maqsusi EduTech and written to one standard
([`CODE-STANDARD.md`](../CODE-STANDARD.md)). It started as two: the Interactive Wall code bought
from Basha (IP assignment signed, 24 Nov 2026) and our own activity engine. Since 27 Nov 2026 every
activity, early-years ones included, is JSON data on the shared templates in `public/engine/templates/`.

| Part                                                   | Where                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Offline server, logins, licence, usage counts          | `server/` (file store in `data/store.json`)                  |
| Wall launcher, phone remote, team play                 | `public/index.html`, `public/launcher.js`, `public/teams.js` |
| School view                                            | `public/school/`                                             |
| IR pen and hand input, 9-dot calibration               | `public/shared/input/`, `public/calibrate/`                  |
| The engine and its templates                           | `public/engine/` (`/engine/?a=<id>` runs one activity)       |
| Activities (150: Nursery to Intermediate)              | `public/activities/<id>/activity.json` plus media            |
| Studio look: tokens, emoji, music, card art, catalogue | `public/shared/studio/`, `public/shared/catalog.js`          |

## Run it on the classroom PC

Needs [Node.js](https://nodejs.org/) 18 or newer and Chrome or Edge. Nothing else, and no internet.

- **Mac:** double-click `Start MagicTouch Wall (Mac).command`
- **Windows:** double-click `start-magictouch-wall-windows.bat`
- **Any:** `node server/index.js`, then open http://localhost:8090/

The first time, the wall asks you to **set up the school's first login** (for example `office`
and a password of 8+ characters). That login opens the **School view** and also works as a wall,
so a one-room school needs nothing else. After that, sign-up is closed: further logins are added
in the School view (`MT_SIGNUP=always` turns open sign-up back on).

**School view** (`/school/`, or ⚙ Settings → School view): for the principal, HODs and floor
in-charges, on a laptop or phone. It shows, for today / 7 / 30 / 90 days: walls in use, class
time on the walls, activities opened, time per day, by class, by subject, per wall and the most
used activities, which walls are on right now, and a CSV download for Excel. Under **Logins** the
school adds a login per classroom wall (so usage shows per room) and School view logins for each
HOD or in-charge (or they share one), names them, resets passwords and turns logins off.
Time counts while an activity is on a wall, up to one hour per opening, and stops when the wall
goes off. Days follow India time (`MT_TZ` changes it).

**Phone remote:** the server prints a "Phone remote" address such as `http://192.168.1.20:8090/`.
Open it on a phone on the same Wi-Fi and sign in with the same school login. From the phone the
teacher can open any activity on the wall, go back to the menu, lock the wall, and start the pen
calibration.

**Team play:** the ★ button on the wall (or _Team play_ on the phone) splits the class into 2–4
teams. A score strip floats over any activity: tap a team to give it a star, then _Finish_ for
the winner's celebration. Every school starts with Peacocks, Tigers, Elephants and Parrots; the
School view's **Teams** tab renames them and sets each mascot (our gallery or the school's own
picture). Only team names and points are kept.

**Input:** wall ⚙ Settings → IR pen (default), Hand, or Mouse or touch screen (no camera;
for laptops, interactive panels and demos).

## School licence

The wall shows only the classes the school bought. Put the licence in `data/licence.json`
(see `licence.example.json`):

```json
{
  "school": "Sunrise Public School, Hyderabad",
  "levels": ["nursery", "prekg", "lkg", "class-4", "class-10"],
  "validUntil": "2027-06-30"
}
```

Level keys: `nursery`, `prekg`, `lkg`, `class-1` … `class-10`, `inter-1`, `inter-2`.
With no file the wall runs as a **demo licence** showing every class. (Signed licence files are
planned; today the file is trusted as is.)

## Data and privacy

Version 1 stores **no student data**. The only things kept (in `data/store.json`) are the wall
logins (password hashed with scrypt, login tokens stored only as SHA-256 hashes, 30-day sessions)
and, per login, which activity is on the wall and whether it is locked, plus daily usage totals
per wall and activity (number of openings and seconds), kept for 400 days. Nothing is recorded
about any child.

## Checks

```
npm install              # once: the lint and format tools (development only; the wall needs none)
npm run check            # lint, format, activity files, offline, media audit, emoji, unit tests
npm test                 # unit tests only (server, homography, template contract, activities)
npm run test:browser     # opens and touches every activity in Chromium; server must be running on 8090
node tests/browser/input.cjs   # IR pen and hand input end to end with a stand-in camera
node tools/asset-audit.js      # rewrites ASSETS-AUDIT.csv
```

## Adding things

- **An activity:** a folder `public/activities/<id>/` with an `activity.json` naming a template, and
  its media. Run `node tools/activities.js` to check it and update the index; it then appears on the
  wall under its class and subject. See [`CODE-STANDARD.md`](../CODE-STANDARD.md).
- **A template:** `public/engine/templates/<name>.js` (+ `.css`), following the template contract in
  the code standard.

## Assets

`ASSETS-AUDIT.csv` lists every picture, sound and 3D model with its status. Files the review found
with stock-library marks (Adobe Stock, Vecteezy, rawpixel, Epic Stock Media, an artist-signed GIF)
were removed or replaced by our own art (`tools/art/`) or generated sound. The other purchased
media is marked `purchased-unverified`: ask Basha for the source of the photos, GIFs, voice clips
and 3D animals before a public launch.

## Voice packs and sound cues (offline)

All narration and sound effects go through `public/shared/audio-engine.js` (`MagicAudio`, CLAUDE.md §8).
Sound cues are Kenney CC0 files in `public/assets/sfx/`. Voice clips are made once, on a PC with internet:

```bash
cd app
cp .env.example .env          # then put your Google Cloud Text-to-Speech API key in .env
npm run voices:check          # dry run: lines and characters, sends nothing
npm run voices                # makes only the missing clips into public/assets/voice/<lang>/
```

Run it again after adding or changing activity text: existing clips are skipped, and the monthly
character count in `data/tts-usage.json` keeps it inside Google's free tier (1M Chirp 3: HD characters a
month). Lines that a template builds at run time and that have no clip yet are spoken by the offline
browser voice and listed by `MagicAudio.misses()` in the browser console; save that list to a file and
pass it with `node scripts/generate-voices.js --lines misses.json`.

A clip that Google returned silent (it happens for some single letters and very short words) is found
by `scripts/mp3-voice-check.js` and made again on the next `npm run voices`, with an end mark added
("M." instead of "M"). Until then the wall says that one item with the offline voice.

### Theme sounds

An activity can name real-world sounds: `"sfx": "lion"` on an item (played as its picture opens, is
picked or is answered right), `"sfx"` on the activity (played as it opens) and `"ambience": "rain"` (a
quiet loop under the activity). The files are in `public/assets/sfx/themes/` (`lion.ogg`, …); the
server lists that folder, so a file dropped in works at once and a name with no file plays nothing.
Without a recording, weather, water, machine and vehicle sounds are made in code
(`public/shared/theme-synth.js`). Use only CC0, public-domain or CC BY recordings and add each one to `themes/credits.json` (source, author,
licence); other names for a file (`ambulance` → `siren`) go in `themes/aliases.json`.
