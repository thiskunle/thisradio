/**
 * Everything the listening section plays, in one place.
 *
 * Add, remove or reorder entries in these lists; the players read them as they are, so no
 * player code changes. Audio files can live in `public/audio/` (use "./audio/name.mp3") or on
 * any HTTPS host that allows playback from thisradio.org. Only add music ThisRadio owns or is
 * licensed to stream, and only episodes that are actually published.
 */

export interface HostedTrack {
  /** Unique and stable: it is how the player remembers the last track. */
  id: string;
  title: string;
  artist: string;
  /** Square image, ideally 512x512 or larger. */
  artwork?: string;
  /** MP3 or AAC (M4A) plays in every current browser. */
  audio: string;
  genre?: string;
  /** In seconds, shown before the file loads. Optional; the player reads the real length. */
  duration?: number;
}

export interface Episode {
  id: string;
  title: string;
  guest?: string;
  description: string;
  /** ISO date, for example "2026-12-01". */
  published?: string;
  artwork?: string;
  /** A direct audio file URL, played by ThisRadio's own player. */
  audio?: string;
  /**
   * The episode's Spotify ID (the part after /episode/ in its link). Shows Spotify's official
   * player in the card, for episodes that are only on Spotify.
   */
  spotifyId?: string;
  duration?: number;
  /** Where else to listen, for example { label: "Spotify", url: "https://open.spotify.com/episode/…" }. */
  links?: { label: string; url: string }[];
}

export type LiveProvider = "icecast" | "shoutcast" | "radioco" | "none";

export interface LiveConfig {
  /** HTTPS stream URL. While this is empty, Live shows as "Coming soon" and cannot be played. */
  streamUrl: string;
  /** Where now-playing details come from, if the stream service provides them. */
  provider: LiveProvider;
  /**
   * The provider's status address:
   * - icecast: https://your-server/status-json.xsl
   * - shoutcast: https://your-server/stats?json=1
   * - radioco: https://public.radio.co/stations/<station id>/status
   */
  metadataUrl?: string;
  /** How often to check now-playing details, in seconds. */
  metadataEvery?: number;
}

export const spotify = {
  playlistId: "3snc02m8rXgsk12gtqYf0D",
  playlistUrl: "https://open.spotify.com/playlist/3snc02m8rXgsk12gtqYf0D",
  showUrl: "https://open.spotify.com/show/3pJs6OIWUip55J9qgRL3yG",
};

/** Music ThisRadio hosts itself. Empty until there is licensed music to add. */
export const tracks: HostedTrack[] = [
  // {
  //   id: "example-track",
  //   title: "Track title",
  //   artist: "Artist name",
  //   artwork: "./audio/example-track.jpg",
  //   audio: "./audio/example-track.mp3",
  //   genre: "Afrobeats",
  //   duration: 214,
  // },
];

/** Published episodes, newest first. Empty until the first one is out. */
export const episodes: Episode[] = [
  {
    id: "grambyte-sponsor",
    title: "Our Sponsor Grambyte Technologies Inc.",
    description:
      "This episode of This Radio is proudly sponsored by GramByte Technologies Inc., a Canadian technology company helping businesses build, protect, and grow their digital presence.",
    published: "2026-11-05",
    duration: 196,
    spotifyId: "1CZScn45lAGSpUu5wTRlcL",
    links: [
      { label: "Open in Spotify", url: "https://open.spotify.com/episode/1CZScn45lAGSpUu5wTRlcL" },
      { label: "grambyte.ca", url: "https://www.grambyte.ca" },
    ],
  },
  // {
  //   id: "ep-001",
  //   title: "Episode title",
  //   guest: "Guest name",
  //   description: "One or two sentences about the conversation.",
  //   published: "2026-12-01",
  //   artwork: "./audio/ep-001.jpg",
  //   audio: "https://your-podcast-host/ep-001.mp3",
  //   duration: 2700,
  //   links: [{ label: "Spotify", url: "https://open.spotify.com/episode/…" }],
  // },
];

/** ThisRadio Live. Off until a real stream is set up. */
export const live: LiveConfig = {
  streamUrl: "",
  provider: "none",
};
