/**
 * The Listen section (Music, Podcasts, Live tabs) and the floating player that opens from the dial.
 * Content comes from `library.ts`; playback from `engine.ts`; the Spotify embed from `spotify.ts`.
 */
import { createEngine, type Item } from "./engine";
import { episodes, live, spotify, tracks } from "./library";
import { createSpotifyEmbeds } from "./spotify";
import { watchLiveMetadata } from "./live";
import { icons, waves } from "./icons";
import "./audio.css";

const PLAYLIST_HEIGHT = 352;
/** Spotify's compact episode player. */
const EPISODE_HEIGHT = 152;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const clock = (sec: number) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

const spokenTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m ? `${m} minute${m === 1 ? "" : "s"} ${s} second${s === 1 ? "" : "s"}` : `${s} second${s === 1 ? "" : "s"}`;
};

const dateLabel = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(+d) ? "" : d.toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });
};

// Only entries with an audio file can play here.
const trackItems: Item[] = tracks
  .filter((t) => t.id && t.audio)
  .map((t) => ({ id: t.id, kind: "track", title: t.title, subtitle: t.artist, artwork: t.artwork, src: t.audio, duration: t.duration }));
const episodeItems: Item[] = episodes
  .filter((e) => e.id && e.audio)
  .map((e) => ({
    id: e.id,
    kind: "episode",
    title: e.title,
    subtitle: e.guest ? `ThisRadio with ${e.guest}` : "ThisRadio",
    artwork: e.artwork,
    src: e.audio!,
    duration: e.duration,
  }));
const liveItem: Item | null = live.streamUrl
  ? { id: "live", kind: "live", title: "ThisRadio Live", subtitle: "Live radio", src: live.streamUrl }
  : null;

export function mountListening() {
  const foundSection = document.querySelector<HTMLElement>("#listen");
  const foundToggle = document.querySelector<HTMLButtonElement>("[data-dock-toggle]");
  const foundDock = document.querySelector<HTMLElement>("#dock");
  if (!foundSection || !foundToggle || !foundDock) return;
  const section: HTMLElement = foundSection;
  const toggle: HTMLButtonElement = foundToggle;
  const dock: HTMLElement = foundDock;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const engine = createEngine();
  const st = engine.state;

  /* ---------- Spotify ---------- */
  const slot = section.querySelector<HTMLElement>("[data-spotify]")!;
  const embed = createSpotifyEmbeds();
  embed.mount(slot, `spotify:playlist:${spotify.playlistId}`, PLAYLIST_HEIGHT, "The ThisRadio playlist on Spotify");
  // One thing at a time: whichever player starts pauses the others.
  embed.onChange(() => {
    if (embed.playing && (st.playing || st.loading)) engine.pause();
    render();
  });

  /* ---------- Tabs ---------- */
  const tabs = [...section.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")!)!);
  const selectTab = (i: number, focus = false) => {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(i));
    tab.addEventListener("keydown", (e) => {
      const keys: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      selectTab((keys[e.key] + tabs.length) % tabs.length, true);
    });
  });
  selectTab(0);
  section.classList.add("is-ready");

  const showMode = (mode: "music" | "podcasts" | "live") => {
    selectTab(Math.max(0, tabs.findIndex((t) => t.dataset.mode === mode)));
    closeDock(false);
    section.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" });
  };

  /* ---------- Music: hosted tracks (only shown once there are some) ---------- */
  const trackBox = section.querySelector<HTMLElement>("[data-tracks]")!;
  const trackList = trackBox.querySelector<HTMLUListElement>("ul")!;
  if (trackItems.length) {
    trackBox.hidden = false;
    trackList.innerHTML = tracks
      .filter((t) => t.id && t.audio)
      .map(
        (t) => `<li>
          <button class="track" type="button" data-play-track="${esc(t.id)}">
            <span class="track-art">${t.artwork ? `<img src="${esc(t.artwork)}" alt="" loading="lazy" width="56" height="56">` : icons.mic}</span>
            <span class="track-text"><span class="track-title">${esc(t.title)}</span><span class="track-sub">${esc(t.artist)}${t.genre ? ` · ${esc(t.genre)}` : ""}</span></span>
            <span class="track-len">${t.duration ? clock(t.duration) : ""}</span>
            <span class="track-state">${waves}<span class="track-icon">${icons.play}</span></span>
          </button>
        </li>`,
      )
      .join("");
  }

  /* ---------- Podcasts ---------- */
  const episodeBox = section.querySelector<HTMLElement>("[data-episodes]")!;
  if (episodes.length) {
    episodeBox.innerHTML = `<ul class="episodes">${episodes
      .map((e) => {
        const date = dateLabel(e.published);
        const links = (e.links ?? [])
          .map((l) => `<a class="pill-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}${icons.external}</a>`)
          .join("");
        // Episodes on Spotify show Spotify's own player, which carries the artwork.
        const art = e.spotifyId && !e.artwork ? "" : `<div class="episode-art">${e.artwork ? `<img src="${esc(e.artwork)}" alt="" loading="lazy" width="120" height="120">` : icons.mic}</div>`;
        return `<li class="episode${art ? "" : " episode--embed"}">
          ${art}
          <div class="episode-body">
            <p class="episode-meta">${[date, e.duration ? clock(e.duration) : ""].filter(Boolean).join(" · ")}</p>
            <h3 class="ep-title">${esc(e.title)}</h3>
            ${e.guest ? `<p class="episode-guest">With ${esc(e.guest)}</p>` : ""}
            <p class="episode-desc">${esc(e.description)}</p>
            ${e.spotifyId ? `<div class="spotify-slot spotify-slot--episode" data-spotify-episode="${esc(e.spotifyId)}" data-title="${esc(e.title)} on Spotify"><p class="spotify-wait">Loading the Spotify player…</p></div>` : ""}
            <div class="episode-actions">
              ${e.audio ? `<button class="play-pill" type="button" data-play-episode="${esc(e.id)}"><span class="track-state">${waves}<span class="track-icon">${icons.play}</span></span><span data-label>Play episode</span></button>` : ""}
              ${links}
            </div>
          </div>
        </li>`;
      })
      .join("")}</ul>`;
    episodeBox.querySelectorAll<HTMLElement>("[data-spotify-episode]").forEach((el) =>
      embed.mount(el, `spotify:episode:${el.dataset.spotifyEpisode}`, EPISODE_HEIGHT, el.dataset.title!),
    );
  }

  /* ---------- Live ---------- */
  const liveBox = section.querySelector<HTMLElement>("[data-live]")!;
  if (liveItem) {
    section.querySelector("[data-live-soon]")?.remove();
    liveBox.innerHTML = `<div class="live-card" data-live-card>
      <p class="live-badge" data-live-badge><span class="dot" aria-hidden="true"></span><span data-live-word>Live</span></p>
      <h3 class="live-title">ThisRadio Live</h3>
      <p class="live-now" data-live-now></p>
      <p class="live-status" data-live-status role="status"></p>
      <button class="listen live-play" type="button" data-play-live>${icons.play}<span>Play live</span></button>
    </div>`;
    watchLiveMetadata(live, () => st.item?.kind === "live" && st.playing, (t) => engine.setLiveTitle(t));
  }

  section.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-play-track],[data-play-episode],[data-play-live],[data-show-mode]");
    if (!el) return;
    if (el.dataset.playTrack) engine.playFrom(trackItems, el.dataset.playTrack);
    else if (el.dataset.playEpisode) engine.playFrom(episodeItems, el.dataset.playEpisode);
    else if (el.hasAttribute("data-play-live") && liveItem) {
      if (st.item?.kind === "live" && engine.active) engine.stop();
      else engine.playFrom([liveItem], "live");
    }
  });

  /* ---------- Floating player ---------- */
  dock.innerHTML = `
    <div class="dock-head">
      <p class="dock-label" id="dock-label">ThisRadio player</p>
      <button class="icon-btn" type="button" data-dock-close aria-label="Minimize player">${icons.minimize}</button>
    </div>
    <div class="dock-now" data-dock-now>
      <div class="dock-art" data-dock-art>${icons.mic}</div>
      <div class="dock-meta">
        <p class="dock-title" data-dock-title></p>
        <p class="dock-sub" data-dock-sub></p>
      </div>
    </div>
    <div class="dock-progress" data-dock-progress>
      <input type="range" min="0" max="100" step="1" value="0" aria-label="Playback position" data-dock-seek>
      <div class="dock-times"><span data-dock-time>0:00</span><span data-dock-dur>0:00</span></div>
    </div>
    <div class="dock-controls" data-dock-controls>
      <button class="icon-btn" type="button" data-act="shuffle" aria-label="Shuffle" aria-pressed="false">${icons.shuffle}</button>
      <button class="icon-btn" type="button" data-act="prev" aria-label="Previous">${icons.prev}</button>
      <button class="icon-btn icon-btn--main" type="button" data-act="toggle" aria-label="Play">${icons.play}</button>
      <button class="icon-btn" type="button" data-act="next" aria-label="Next">${icons.next}</button>
      <button class="icon-btn" type="button" data-act="repeat" aria-label="Repeat: off" data-repeat="off">${icons.repeat}<span class="repeat-one" aria-hidden="true">1</span></button>
    </div>
    <div class="dock-volume" data-dock-volume>
      <button class="icon-btn icon-btn--small" type="button" data-act="mute" aria-label="Mute">${icons.volume}</button>
      <input type="range" min="0" max="100" step="1" aria-label="Volume" data-dock-vol>
      <button class="text-btn" type="button" data-act="stop">${icons.stop}<span>Stop</span></button>
    </div>
    <p class="dock-error" data-dock-error role="alert"></p>
    <p class="dock-empty" data-dock-empty>Nothing from ThisRadio is playing.</p>
    <div class="dock-spotify" data-dock-spotify hidden>
      <p><span class="dock-spotify-head">${waves}Playing in the Spotify player.</span> Use the Spotify player's own controls to pause or skip.</p>
      <button class="text-btn" type="button" data-show-mode="music">Go to the player</button>
    </div>
    <div class="dock-sources">
      <p class="dock-sources-label">Listen to</p>
      <button type="button" class="source" data-show-mode="music">The playlist<small>On Spotify</small></button>
      <button type="button" class="source" data-show-mode="podcasts">Podcasts<small>${episodes.length ? `${episodes.length} episode${episodes.length === 1 ? "" : "s"}` : "None yet"}</small></button>
      <button type="button" class="source" data-show-mode="live">Live radio<small>${liveItem ? "On air when live" : "Coming soon"}</small></button>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => dock.querySelector<T>(sel)!;
  const els = {
    now: q("[data-dock-now]"),
    art: q("[data-dock-art]"),
    title: q("[data-dock-title]"),
    sub: q("[data-dock-sub]"),
    progress: q("[data-dock-progress]"),
    seek: q<HTMLInputElement>("[data-dock-seek]"),
    time: q("[data-dock-time]"),
    dur: q("[data-dock-dur]"),
    controls: q("[data-dock-controls]"),
    volume: q("[data-dock-volume]"),
    vol: q<HTMLInputElement>("[data-dock-vol]"),
    error: q("[data-dock-error]"),
    empty: q("[data-dock-empty]"),
    spotify: q("[data-dock-spotify]"),
    btn: (act: string) => q<HTMLButtonElement>(`[data-act="${act}"]`),
  };
  const toggleLabel = toggle.querySelector<HTMLElement>("[data-dock-toggle-label]")!;

  let open = false;
  const openDock = () => {
    open = true;
    dock.dataset.open = "";
    toggle.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => q<HTMLButtonElement>("[data-dock-close]").focus());
  };
  function closeDock(returnFocus = true) {
    if (!open) return;
    open = false;
    delete dock.dataset.open;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener("click", () => (open ? closeDock() : openDock()));
  dock.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDock();
  });
  document.addEventListener("pointerdown", (e) => {
    if (open && !dock.contains(e.target as Node) && !toggle.contains(e.target as Node)) closeDock(false);
  });

  let seeking = false;
  els.seek.addEventListener("input", () => {
    seeking = true;
    els.time.textContent = clock((+els.seek.value / 100) * st.duration);
  });
  els.seek.addEventListener("change", () => {
    seeking = false;
    engine.seek((+els.seek.value / 100) * st.duration);
  });
  els.vol.addEventListener("input", () => engine.setVolume(+els.vol.value / 100));

  dock.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-show-mode]");
    if (!el) return;
    if (el.dataset.showMode) return showMode(el.dataset.showMode as "music");
    switch (el.dataset.act) {
      case "toggle":
        if (!st.playing) embed.pauseAll();
        return engine.toggle();
      case "prev":
        return engine.prev();
      case "next":
        return engine.next();
      case "shuffle":
        return engine.toggleShuffle();
      case "repeat":
        return engine.cycleRepeat();
      case "mute":
        return engine.toggleMute();
      case "stop":
        return engine.stop();
    }
  });
  // Starting native audio from the page pauses Spotify too.
  section.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-play-track],[data-play-episode],[data-play-live]")) embed.pauseAll();
  });
  section.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-show-mode]");
    if (el) showMode(el.dataset.showMode as "music");
  });

  /* ---------- Rendering ---------- */
  let lastArt = "";
  function render() {
    const item = st.item;
    const isLive = item?.kind === "live";
    const nativeOn = engine.active;
    const anyPlaying = st.playing || embed.playing;

    // Compact button on the dial.
    toggle.classList.toggle("is-playing", anyPlaying);
    toggleLabel.textContent = anyPlaying ? (isLive && st.playing ? "On air" : "Playing") : "Listen";
    toggle.setAttribute("aria-label", anyPlaying ? "Open the player, something is playing" : "Open the player");

    // Now playing.
    els.now.hidden = !item;
    els.progress.hidden = !item || isLive;
    els.controls.hidden = !item;
    els.volume.hidden = !item;
    els.empty.hidden = !!item || embed.playing;
    els.spotify.hidden = !embed.playing;
    els.error.textContent = st.error;
    els.error.hidden = !st.error;

    if (item) {
      els.title.textContent = isLive && st.liveTitle ? st.liveTitle : item.title;
      els.sub.textContent = isLive ? liveStatusText() : item.subtitle;
      const art = item.artwork ?? "";
      if (art !== lastArt) {
        lastArt = art;
        els.art.innerHTML = art ? `<img src="${esc(art)}" alt="" width="64" height="64">` : icons.mic;
      }
      els.now.classList.toggle("is-playing", st.playing);

      if (!isLive && !seeking) {
        const pct = st.duration ? (st.time / st.duration) * 100 : 0;
        els.seek.value = String(pct);
        els.seek.style.setProperty("--pct", `${pct}%`);
        els.seek.setAttribute("aria-valuetext", `${spokenTime(st.time)} of ${spokenTime(st.duration)}`);
        els.time.textContent = clock(st.time);
        els.dur.textContent = st.duration ? clock(st.duration) : "–:––";
        els.seek.disabled = !st.duration;
      }

      const main = els.btn("toggle");
      main.innerHTML = nativeOn ? icons.pause : icons.play;
      main.setAttribute("aria-label", nativeOn ? (isLive ? "Stop live radio" : "Pause") : "Play");
      main.classList.toggle("is-loading", st.loading);
      const single = isLive || st.queueLength < 2;
      for (const act of ["shuffle", "prev", "next", "repeat"]) els.btn(act).hidden = isLive || (single && act !== "prev" && act !== "repeat");
      els.btn("shuffle").setAttribute("aria-pressed", String(st.shuffle));
      const rep = els.btn("repeat");
      rep.dataset.repeat = st.repeat;
      rep.setAttribute("aria-label", `Repeat: ${st.repeat === "one" ? "this one" : st.repeat}`);
      const mute = els.btn("mute");
      mute.innerHTML = st.muted || st.volume === 0 ? icons.muted : icons.volume;
      mute.setAttribute("aria-label", st.muted ? "Unmute" : "Mute");
      if (document.activeElement !== els.vol) els.vol.value = String(Math.round((st.muted ? 0 : st.volume) * 100));
      els.vol.style.setProperty("--pct", `${els.vol.value}%`);
    }

    // Play buttons on the page show which item is on.
    section.querySelectorAll<HTMLElement>("[data-play-track],[data-play-episode]").forEach((b) => {
      const id = b.dataset.playTrack ?? b.dataset.playEpisode;
      const kind = b.dataset.playTrack ? "track" : "episode";
      const current = item?.id === id && item?.kind === kind;
      const on = current && nativeOn;
      b.classList.toggle("is-current", current);
      b.classList.toggle("is-playing", current && st.playing);
      b.setAttribute("aria-pressed", String(on));
      b.querySelector(".track-icon")!.innerHTML = on ? icons.pause : icons.play;
      const label = b.querySelector("[data-label]");
      if (label) label.textContent = on ? "Pause episode" : current ? "Resume episode" : "Play episode";
    });

    if (liveItem) {
      const card = section.querySelector<HTMLElement>("[data-live-card]")!;
      const liveOn = isLive && nativeOn;
      card.dataset.status = isLive ? st.live : "idle";
      section.querySelector("[data-live-status]")!.textContent = isLive ? liveStatusText() : "Press play to tune in.";
      section.querySelector("[data-live-now]")!.textContent = isLive && st.liveTitle ? `Now playing: ${st.liveTitle}` : "";
      const btn = section.querySelector<HTMLElement>("[data-play-live]")!;
      btn.innerHTML = `${liveOn ? icons.stop : icons.play}<span>${liveOn ? "Stop" : "Play live"}</span>`;
    }
  }

  function liveStatusText() {
    switch (st.live) {
      case "connecting":
        return "Connecting…";
      case "live":
        return "Live now";
      case "reconnecting":
        return "Connection dropped. Reconnecting…";
      case "offline":
        return "Off air or unreachable. Try again later.";
      default:
        return "Stopped";
    }
  }

  // Starting native audio from the dock or the keyboard media keys also pauses Spotify.
  let wasPlaying = false;
  engine.onChange(() => {
    if (st.playing && !wasPlaying) embed.pauseAll();
    wasPlaying = st.playing;
    render();
  });

  engine.restore(trackItems);
  engine.restore(episodeItems);
  render();
}
