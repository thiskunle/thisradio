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
| `src/static.ts` | The optional "Turn on static" sound: noise that fades as the dial lands on a part. Off until a visitor turns it on. |

The scenes follow the suggested episode structure: Opening (speaker rings), The Conversation (a second radio joins), Tech Meets Business (the back opens on glowing valves), The Hot Seat (a stool and a tremble), Comic Relief (bouncing, googly eyes) and Final Word.

Reduced motion is respected: the radio still changes pose per part, without idle movement or bouncing.

## Logo

`src/assets/logo.png` is the ThisRadio logo with the white background removed. CSS uses it as a mask, so it takes the page's text colour. The browser icons (`public/icon-32.png`, `public/icon-180.png`) are the logo's microphone on the brand blue.

## Before going live

- **Check the facts:** weekly episodes and 30–60 minute length come from the suggested Spotify settings.
- No host names, guests or episodes are on the page yet; add them once they're real.
