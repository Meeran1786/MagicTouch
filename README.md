# MagicTouch

Touch-based interactive learning on a projector wall, by **Maqsusi EduTech** (Hyderabad, India).
A projector shows the activity on a wall; an IR camera sees an IR sensor pen (or a hand) and turns it
into taps and drags. One JSON-driven engine runs every activity, from Nursery to Intermediate.

## What's in this repo

| Folder | What it is |
|---|---|
| `app/` | **The classroom product.** Offline server, wall launcher, phone remote, School view, IR pen and hand input, and every activity from Nursery to Intermediate, in the Studio look. See [`app/README.md`](app/README.md). |
| `design/`, `wireframes/` | Design references and the clickable wireframes for the Studio look |
| `CLAUDE.md` | The visual and motion design system every screen follows |
| `CODE-STANDARD.md` | How all code is written: stack, structure, activities and templates, input, checks |

## Run it

Needs [Node.js](https://nodejs.org/) 18 or newer and Chrome or Edge; no internet.

```
cd app
node server/index.js
```

Then open **http://localhost:8090/**, or double-click `app/Start MagicTouch Wall (Mac).command` /
`app/start-magictouch-wall-windows.bat`. A single activity opens at `http://localhost:8090/engine/?a=<id>`,
and `http://localhost:8090/engine/` lists them all.

## Adding content

Activities are data, not code: a folder in `app/public/activities/<id>/` with an `activity.json` that
names one of the shared templates, then `node tools/activities.js` in `app/`. See
[`CODE-STANDARD.md`](CODE-STANDARD.md). All content must be original: no textbook text, pictures or
exercises. Maps of India are left out until an official Survey of India outline is used.

## Ownership

Copyright © Maqsusi EduTech. All rights reserved. Bundled third-party parts are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Anyone contributing code or content must sign an
IP assignment before starting work.
