/**
 * The one native audio player on the page. Hosted music, podcast episodes and the live stream
 * all play through the same <audio> element, so two of them can never play at once.
 * Nothing plays until a visitor presses a play control.
 */

export interface Item {
  id: string;
  kind: "track" | "episode" | "live";
  title: string;
  /** Artist, guest, or "ThisRadio Live". */
  subtitle: string;
  artwork?: string;
  src: string;
  duration?: number;
}

export type Repeat = "off" | "all" | "one";
export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export interface State {
  item: Item | null;
  playing: boolean;
  loading: boolean;
  error: string;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: Repeat;
  live: LiveStatus;
  /** Now-playing details from the live stream, when the service sends them. */
  liveTitle: string;
  queueLength: number;
}

const SESSION_KEY = "thisradio:player";
const MAX_RECONNECTS = 6;

function readSession(): { id?: string; kind?: string; time?: number; volume?: number; shuffle?: boolean; repeat?: Repeat } {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

export function createEngine() {
  const audio = new Audio();
  audio.preload = "none";
  const events = new EventTarget();
  const saved = readSession();

  let queue: Item[] = [];
  let index = -1;
  /** Play order when shuffle is on: positions in `queue`. */
  let order: number[] = [];
  let reconnects = 0;
  let reconnectTimer = 0;
  let stalledTimer = 0;
  /** Where to start once the file's details load (setting it earlier is ignored by some browsers). */
  let pendingStart = 0;

  const state: State = {
    item: null,
    playing: false,
    loading: false,
    error: "",
    time: 0,
    duration: 0,
    volume: typeof saved.volume === "number" ? saved.volume : 1,
    muted: false,
    shuffle: !!saved.shuffle,
    repeat: saved.repeat ?? "off",
    live: "idle",
    liveTitle: "",
    queueLength: 0,
  };
  audio.volume = state.volume;

  let notifyQueued = false;
  const emit = () => {
    if (notifyQueued) return;
    notifyQueued = true;
    queueMicrotask(() => {
      notifyQueued = false;
      events.dispatchEvent(new Event("change"));
    });
  };

  const save = () => {
    try {
      const item = state.item;
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          id: item && item.kind !== "live" ? item.id : undefined,
          kind: item?.kind,
          time: item && item.kind !== "live" ? Math.floor(audio.currentTime) : 0,
          volume: state.volume,
          shuffle: state.shuffle,
          repeat: state.repeat,
        }),
      );
    } catch {
      /* Storage can be blocked; the player works without it. */
    }
  };

  const buildOrder = () => {
    order = queue.map((_, i) => i);
    if (!state.shuffle) return;
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // The current item stays first, so turning shuffle on doesn't jump.
    const at = order.indexOf(index);
    if (at > 0) [order[0], order[at]] = [order[at], order[0]];
  };

  const setMediaSession = () => {
    if (!("mediaSession" in navigator)) return;
    const item = state.item;
    if (!item) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.kind === "live" && state.liveTitle ? state.liveTitle : item.title,
      artist: item.subtitle,
      album: "ThisRadio",
      artwork: item.artwork ? [{ src: new URL(item.artwork, location.href).href, sizes: "512x512" }] : [],
    });
  };

  const select = (i: number, startAt = 0) => {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
    index = i;
    const item = queue[i] ?? null;
    state.item = item;
    state.error = "";
    state.time = startAt;
    state.duration = item?.duration ?? 0;
    state.liveTitle = "";
    state.live = item?.kind === "live" ? "connecting" : "idle";
    reconnects = 0;
    if (item) {
      audio.src = item.src;
      pendingStart = startAt;
    } else {
      audio.removeAttribute("src");
      audio.load();
    }
    setMediaSession();
    save();
    emit();
  };

  const play = async () => {
    if (!state.item) return;
    state.error = "";
    state.loading = true;
    if (state.item.kind === "live") {
      // A live stream always rejoins at the live edge.
      audio.src = state.item.src;
      state.live = reconnects ? "reconnecting" : "connecting";
    }
    emit();
    try {
      await audio.play();
    } catch (err) {
      const name = (err as DOMException)?.name;
      // Interrupted by another load, or blocked without a user gesture: nothing to report.
      if (name === "AbortError" || name === "NotAllowedError") {
        state.loading = false;
        emit();
        return;
      }
      if (state.item?.kind === "live") return scheduleReconnect();
      state.loading = false;
      state.error = name === "NotSupportedError" ? "This file isn't available right now." : "This couldn't start. Try again in a moment.";
      emit();
    }
  };

  const pause = () => {
    audio.pause();
  };

  /** Stops and clears the player. */
  const stop = () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
    audio.pause();
    queue = [];
    order = [];
    select(-1);
    state.playing = false;
    state.loading = false;
    state.queueLength = 0;
    emit();
  };

  const step = (dir: 1 | -1, auto = false) => {
    if (!queue.length || state.item?.kind === "live") return;
    const pos = order.indexOf(index);
    let next = pos + dir;
    if (next >= order.length || next < 0) {
      if (auto && state.repeat === "off") {
        state.playing = false;
        emit();
        return;
      }
      next = (next + order.length) % order.length;
    }
    select(order[next]);
    play();
  };

  const scheduleReconnect = () => {
    if (state.item?.kind !== "live" || state.live === "offline") return;
    if (state.live === "reconnecting" && reconnectTimer) return;
    clearTimeout(reconnectTimer);
    if (reconnects >= MAX_RECONNECTS) {
      state.live = "offline";
      state.loading = false;
      state.error = "The live stream isn't reachable right now.";
      emit();
      return;
    }
    reconnects += 1;
    state.live = "reconnecting";
    emit();
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      play();
    }, Math.min(30000, 1000 * 2 ** reconnects));
  };

  audio.addEventListener("playing", () => {
    clearTimeout(stalledTimer);
    state.playing = true;
    state.loading = false;
    state.error = "";
    if (state.item?.kind === "live") {
      state.live = "live";
      reconnects = 0;
    }
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    emit();
  });
  audio.addEventListener("pause", () => {
    state.playing = false;
    state.loading = false;
    if (state.item?.kind === "live" && state.live === "live") state.live = "idle";
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    save();
    emit();
  });
  audio.addEventListener("waiting", () => {
    state.loading = true;
    emit();
    // A live stream that stays stuck is reconnected.
    if (state.item?.kind === "live") {
      clearTimeout(stalledTimer);
      stalledTimer = window.setTimeout(() => {
        if (state.loading) scheduleReconnect();
      }, 8000);
    }
  });
  audio.addEventListener("timeupdate", () => {
    state.time = audio.currentTime;
    emit();
  });
  audio.addEventListener("loadedmetadata", () => {
    if (pendingStart && state.item?.kind !== "live") audio.currentTime = pendingStart;
    pendingStart = 0;
  });
  audio.addEventListener("durationchange", () => {
    if (Number.isFinite(audio.duration)) state.duration = audio.duration;
    emit();
  });
  audio.addEventListener("ended", () => {
    if (state.item?.kind === "live") return scheduleReconnect();
    if (state.repeat === "one") {
      audio.currentTime = 0;
      play();
      return;
    }
    step(1, true);
  });
  audio.addEventListener("error", () => {
    if (!state.item) return;
    if (state.item.kind === "live") return scheduleReconnect();
    state.loading = false;
    state.playing = false;
    state.error = "This file isn't available right now.";
    emit();
  });
  audio.addEventListener("volumechange", () => {
    state.volume = audio.volume;
    state.muted = audio.muted;
    save();
    emit();
  });

  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => play()],
      ["pause", () => pause()],
      ["stop", () => stop()],
      ["previoustrack", () => step(-1)],
      ["nexttrack", () => step(1)],
      ["seekto", (d) => d.seekTime != null && seek(d.seekTime)],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* Unsupported action in this browser. */
      }
    }
  }

  const seek = (seconds: number) => {
    if (!state.item || state.item.kind === "live") return;
    audio.currentTime = Math.max(0, Math.min(seconds, state.duration || seconds));
    state.time = audio.currentTime;
    emit();
  };

  // Keep the remembered position fresh without writing on every frame.
  setInterval(() => {
    if (state.playing) save();
  }, 5000);
  window.addEventListener("pagehide", save);

  return {
    state,
    /** True while something is playing, loading, or the live stream is trying to (re)connect. */
    get active() {
      return state.playing || state.loading || state.live === "connecting" || state.live === "reconnecting";
    },
    onChange(fn: () => void) {
      events.addEventListener("change", fn);
    },
    /** Loads a list and plays the item with `id`. */
    playFrom(items: Item[], id: string) {
      const i = items.findIndex((it) => it.id === id);
      if (i < 0) return;
      if (state.item?.id === id && state.item.kind === items[i].kind) {
        if (state.playing) pause();
        else play();
        return;
      }
      queue = items;
      state.queueLength = items.length;
      select(i);
      buildOrder();
      play();
    },
    /** Puts back the last item from this browsing session, paused. */
    restore(items: Item[]) {
      if (!saved.id) return;
      const i = items.findIndex((it) => it.id === saved.id && it.kind === saved.kind);
      if (i < 0) return;
      queue = items;
      state.queueLength = items.length;
      select(i, saved.time || 0);
      buildOrder();
    },
    toggle() {
      if (state.item?.kind === "live" && this.active) stop();
      else if (state.playing || state.loading) pause();
      else play();
    },
    play,
    pause,
    stop,
    next: () => step(1),
    prev() {
      // Like most players: back to the start first, then the previous track.
      if (audio.currentTime > 4) seek(0);
      else step(-1);
    },
    seek,
    setVolume(v: number) {
      audio.volume = Math.max(0, Math.min(1, v));
      if (audio.volume > 0) audio.muted = false;
    },
    toggleMute() {
      audio.muted = !audio.muted;
    },
    toggleShuffle() {
      state.shuffle = !state.shuffle;
      buildOrder();
      save();
      emit();
    },
    cycleRepeat() {
      state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
      save();
      emit();
    },
    setLiveTitle(title: string) {
      if (title === state.liveTitle) return;
      state.liveTitle = title;
      setMediaSession();
      emit();
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
