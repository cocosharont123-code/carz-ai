// Music tracks offered in the video editor.
//
// No audio ships with the repo: bundling music means licensing it, and that is
// a decision for whoever runs the site, not a default. Drop your own
// royalty-free files into `public/music/` and list them here — the picker
// renders whatever this array contains and hides itself when it's empty.
//
// Sources worth looking at: Pixabay Music, Free Music Archive (CC-BY),
// Uppbeat, or anything you hold a licence for. Keep files small — they are
// fetched on every playback — and prefer MP3 or AAC for Safari.
//
//   { id: "night-drive", title: "Night Drive", artist: "…",
//     src: "/music/night-drive.mp3", credit: "CC-BY — link" }
//
// Spotters can always attach their own audio file instead, which works with no
// setup at all.

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  /** Public path or absolute URL. */
  src: string;
  /** Attribution line shown under the picker, if the licence needs one. */
  credit?: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [];

export function trackById(id: string): MusicTrack | null {
  return MUSIC_TRACKS.find((t) => t.id === id) ?? null;
}
