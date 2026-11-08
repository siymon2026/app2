# SIYMON — 3 Official Cinematic Explainer Videos

Three silent, vertical (9:16) 3D-animated explainer films for SIYMON, produced from the real
flows in this repository — no speech, no on-screen text, no narration.

| # | Film | Duration | Story |
|---|------|----------|-------|
| 1 | Customer experience | ~46 s | open app → discover stores → pick products → set address → pay → store prepares → live tracking → handover |
| 2 | Restaurants & stores | ~44 s | merchant dashboard → manage products/stock → new order → accept → prepare → driver pickup |
| 3 | Driver experience | ~49 s | go online → hex dispatch → offer → accept → ride to store → pickup code → deliver → delivery code → earnings |

## Read this first

`docs/AUDIT-SIYMON-FLOWS-AR.md` records what the code actually does, and the four places where the
brief and the code disagree (the code wins):

1. The **store** shows the pickup code and the **customer** shows the delivery code; the driver types them in.
2. `stripe` is never available (`lib/payment-methods.js`) → no instant card payment is shown. Only
   cash-on-delivery, TPE-on-delivery and wallet are displayed.
3. "Stock" is the per-product availability toggle in the merchant panel.
4. Tracking shows the real state machine (`new → admin_accepted → restaurant_ready → accepted →
   picked_up → on_the_way → delivered → done`), nothing invented.

## Brand

* `#0F0F0F` background, `#5DD62C` primary green, `#337418` dark green, `#F8F8F8` text
  (`public/brand.css`).
* The logo is the repository asset `public/icons/icon-512.png` — never redrawn, never replaced.

## How the films are made

No browser or video tooling was available in the sandbox, so the films are rendered by a small
software 3D engine:

* `src/engine.js` — vectors, camera/projection, painter-sorted lit geometry, perspective texture
  mapping (homography), glow/bloom/grain post-processing.
* `src/phone.js` — phone/tablet model with a real perspective-mapped screen.
* `src/ui.js` + `src/screens.js` — the app screens, rebuilt from `public/index.html`,
  `public/restaurant/`, `public/store/`, `public/driver/`, `public/wallet/` — RTL layouts, same
  tabs, same states. Words are intentionally replaced by bars (no readable text anywhere).
* `src/set.js` — night city, grid-district map, scooter, SIYMON bag, counter, hex dispatch ring, storefront.
* `src/common.js` — shots, transitions, end card.
* `src/video1.js` / `video2.js` / `video3.js` — the three timelines.
* `src/audio.js` — procedural score (pad, bass, arp, drums) plus SFX cues (whoosh, pop, chime,
  engine, impact). No voice.
* `src/video.js` — frame loop → ffmpeg (H.264, yuv420p, 1080×1920, 30 fps) + AAC mux.

### Render

```bash
cd siymon-videos/src
export NODE_PATH=/path/to/node_modules   # @napi-rs/canvas + @ffmpeg-installer/ffmpeg
node video.js 1        # full film  → sisymon-videos/SIYMON-01-CUSTOMER-EXPERIENCE.mp4
node video.js 2 12 20  # stills at t=12s, 20s → renders/stills/
node video.js 3 audio  # music+SFX only → renders/*.wav
```

Renders (`renders/`, `*.mp4`) and `node_modules` are git-ignored; `assets/` holds the campaign
food/product plates used inside the phone UI.
