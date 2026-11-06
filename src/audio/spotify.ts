/**
 * Official Spotify embeds (the playlist, and any episode published on Spotify), each loaded
 * when the visitor gets near it.
 *
 * Spotify keeps its own controls. The only things this file uses from Spotify's documented
 * iFrame API are its playback updates (to know when an embed is playing) and `pause()`
 * (so embeds and ThisRadio's own player never play over each other).
 * If the API script can't load, plain embeds are used and the players simply stay separate.
 */

const API = "https://open.spotify.com/embed/iframe-api/v1";
const IFRAME_ALLOW = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

interface EmbedController {
  addListener(event: "ready" | "playback_update", fn: (e: { data: { isPaused: boolean } }) => void): void;
  pause(): void;
}
interface IFrameAPI {
  createController(el: HTMLElement, options: { uri: string; width?: string | number; height?: string | number }, cb: (c: EmbedController) => void): void;
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

/** Loads Spotify's iFrame API once; resolves to null if it can't load in time. */
let apiPromise: Promise<IFrameAPI | null> | undefined;
function loadApi(): Promise<IFrameAPI | null> {
  apiPromise ??= new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 8000);
    window.onSpotifyIframeApiReady = (api) => {
      clearTimeout(timer);
      resolve(api);
    };
    const script = document.createElement("script");
    script.src = API;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    document.head.append(script);
  });
  return apiPromise;
}

export interface SpotifyEmbeds {
  /** Adds an embed into `slot`; `uri` is like "spotify:playlist:<id>" or "spotify:episode:<id>". */
  mount(slot: HTMLElement, uri: string, height: number, title: string): void;
  /** True while any Spotify embed on the page is playing. */
  readonly playing: boolean;
  /** Pauses every Spotify embed except `keep`. */
  pauseAll(keep?: EmbedController): void;
  onChange(fn: () => void): void;
}

export function createSpotifyEmbeds(): SpotifyEmbeds {
  const listeners: (() => void)[] = [];
  const controllers: EmbedController[] = [];
  const playing = new Set<EmbedController>();
  const changed = () => listeners.forEach((fn) => fn());

  const embeds: SpotifyEmbeds = {
    mount(slot, uri, height, title) {
      slot.style.setProperty("--embed-h", `${height}px`);
      let mounted = false;

      const plainIframe = () => {
        if (slot.querySelector("iframe")) return;
        const [, type, id] = uri.split(":");
        const iframe = document.createElement("iframe");
        iframe.src = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
        iframe.title = title;
        iframe.width = "100%";
        iframe.height = String(height);
        iframe.loading = "lazy";
        iframe.allow = IFRAME_ALLOW;
        iframe.setAttribute("allowfullscreen", "");
        slot.querySelectorAll(":scope > div").forEach((d) => d.remove());
        slot.append(iframe);
        slot.dataset.state = "ready";
      };

      const mount = async () => {
        if (mounted) return;
        mounted = true;
        slot.dataset.state = "loading";
        const api = await loadApi();
        if (!api) return plainIframe();
        const target = document.createElement("div");
        slot.append(target);
        api.createController(target, { uri, width: "100%", height }, (c) => {
          controllers.push(c);
          const iframe = slot.querySelector("iframe");
          if (iframe) {
            iframe.title = title;
            iframe.allow = IFRAME_ALLOW;
          }
          slot.dataset.state = "ready";
          c.addListener("playback_update", (e) => {
            const now = !e.data.isPaused;
            if (now === playing.has(c)) return;
            if (now) {
              playing.add(c);
              // Starting one embed pauses the others.
              embeds.pauseAll(c);
            } else playing.delete(c);
            changed();
          });
        });
      };

      // Load once the visitor is within about a screen of the player.
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              io.disconnect();
              mount();
            }
          },
          { rootMargin: "100% 0px" },
        );
        io.observe(slot);
      } else {
        mount();
      }
    },
    get playing() {
      return playing.size > 0;
    },
    pauseAll(keep) {
      for (const c of controllers) if (c !== keep && playing.has(c)) c.pause();
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };
  return embeds;
}
