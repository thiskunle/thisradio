# ThisRadio website

A one-page site for the ThisRadio podcast. A 3D radio, built in three.js with no model files, changes with each part of an episode as visitors scroll.

Vite, TypeScript and three.js; no framework. Fonts are self-hosted (Anybody for headings, Schibsted Grotesk for text).

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/, works on any host or subfolder
npm run preview   # serve dist/
```

## How it works

| File | What it holds |
|---|---|
| `index.html` | All the words on the page. It reads fine without JavaScript or WebGL. |
| `src/stations.ts` | One entry per stop on the page: page colours, where the radio sits, camera, and which effects are on. Edit the numbers here to change a scene. |
| `src/radio.ts` | The radio model: body, speaker, dial, knobs, antenna, and the circuit board and valves on the back. |
| `src/scene.ts` | Lights, the floor shadow, the guest radio, sound rings, the hot-seat stool and googly eyes; draws each frame. |
| `src/main.ts` | Scroll tracking, colour blending, the dial at the bottom of the page, and the opening drop-in. three.js loads after the text. |
| `src/audio/library.ts` | **Everything the Listen section plays:** the Spotify playlist, hosted music, podcast episodes, and the live stream settings. Add, remove or reorder entries here; no player code changes. |
| `src/audio/engine.ts` | The one native audio player (music, episodes, live). Only one thing plays at a time; queue, shuffle, repeat, volume, Media Session, remembers the last pick for the browsing session, reconnects a dropped live stream. |
| `src/audio/spotify.ts` | The official Spotify embed, loaded when the visitor gets near it, through Spotify's iFrame API (plain embed if the API can't load). |
| `src/audio/live.ts` | Now-playing details for the live stream (Icecast, SHOUTcast or Radio.co). |
| `src/audio/ui.ts`, `audio.css` | The Listen section (Music, Podcasts, Live tabs) and the floating player that opens from the dial's Listen button. |
| `src/static.ts` | The optional "Turn on static" sound: noise that fades as the dial lands on a part. Off until a visitor turns it on. |

The scenes follow the suggested episode structure: Opening (speaker rings), The Conversation (a second radio joins), Tech Meets Business (the back opens on glowing valves), The Hot Seat (a stool and a tremble), Comic Relief (bouncing, googly eyes) and Final Word.

Reduced motion is respected: the radio still changes pose per part, without idle movement or bouncing.

## Logo

`src/assets/logo.png` is the ThisRadio logo with the white background removed. CSS uses it as a mask, so it takes the page's text colour. The browser icons (`public/icon-32.png`, `public/icon-180.png`) are the logo's microphone on the brand blue.

## Before going live

- **Check the facts:** weekly episodes and 30–60 minute length come from the suggested Spotify settings.
- No host names, guests or episodes are on the page yet; add them once they're real.

## Listening

- **Music:** the official Spotify embed of the ThisRadio playlist. Spotify keeps its own controls; signed-in listeners hear full tracks, everyone else hears Spotify's previews. The site only uses the iFrame API's playback updates and `pause()`, so the playlist and ThisRadio's own player never play over each other.
- **Hosted music:** add files you own or are licensed to stream to `tracks` in `src/audio/library.ts` (files can go in `public/audio/`). The track list appears under the playlist once there is at least one.
- **Podcasts:** add published episodes to `episodes`. Until then the tab says episodes will appear once published and links to the show on Spotify.
- **Live:** set `live.streamUrl` (HTTPS) and, for now-playing details, `provider` and `metadataUrl`. Until then the tab shows "Coming soon" with a disabled play button. The metadata URL must allow requests from thisradio.org (CORS).
- Nothing plays until a visitor presses play. The floating player opens from **Listen** on the dial, so it never covers the page on its own.
