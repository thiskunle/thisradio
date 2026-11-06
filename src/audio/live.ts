/**
 * Now-playing details for ThisRadio Live. The stream itself plays through the shared engine,
 * which handles connecting and reconnecting; this file only asks the stream service what is on.
 * Each provider reports it differently, so add a reader here if the service changes.
 */
import type { LiveConfig } from "./library";

type Reader = (json: any) => { title: string; artwork?: string };

const readers: Record<Exclude<LiveConfig["provider"], "none">, Reader> = {
  // Icecast: /status-json.xsl. With several mount points, `source` is a list.
  icecast: (j) => {
    const src = j?.icestats?.source;
    const one = Array.isArray(src) ? src[0] : src;
    const title = one?.title || [one?.artist, one?.title].filter(Boolean).join(" – ");
    return { title: title || "" };
  },
  // SHOUTcast v2: /stats?json=1
  shoutcast: (j) => ({ title: j?.songtitle || "" }),
  // Radio.co: https://public.radio.co/stations/<id>/status
  radioco: (j) => ({ title: j?.current_track?.title || "", artwork: j?.current_track?.artwork_url_large }),
};

/** Starts polling while `active()` is true. Returns a stop function. */
export function watchLiveMetadata(config: LiveConfig, active: () => boolean, onTitle: (title: string) => void) {
  if (config.provider === "none" || !config.metadataUrl) return () => {};
  const read = readers[config.provider];
  const every = Math.max(10, config.metadataEvery ?? 20) * 1000;
  let timer = 0;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    if (active() && document.visibilityState === "visible") {
      try {
        const res = await fetch(config.metadataUrl!, { cache: "no-store" });
        if (res.ok) onTitle(read(await res.json()).title.trim());
      } catch {
        /* Details are a bonus; the stream keeps playing without them. */
      }
    }
    timer = window.setTimeout(tick, every);
  };
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
