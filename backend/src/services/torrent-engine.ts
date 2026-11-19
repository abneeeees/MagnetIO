import type { Torrent, TorrentFile } from "webtorrent";
import WebTorrent from "webtorrent";
import crypto from "node:crypto";

// Single shared client so multiple streams reuse the same peer pool
const opts = {
  maxConns: 55,
  peerId: crypto.randomBytes(20),
  nodeId: crypto.randomBytes(20),
  tracker: true,
  dht: true,
  webSeeds: true,
};

export const client = new WebTorrent(opts);

client.on("error", (err) => {
  console.error("WebTorrent client error:", err instanceof Error ? err.message : String(err));
});

const TORRENT_PATH = process.env.TORRENT_PATH ?? "/tmp/webtorrent";
const IDLE_TTL_MS = Number(process.env.TORRENT_IDLE_TTL_MS ?? 120_000);
const MAX_ACTIVE_TORRENTS = Number(process.env.MAX_ACTIVE_TORRENTS ?? 3);
export const MAX_STREAM_FILE_BYTES = Number(process.env.MAX_STREAM_FILE_BYTES ?? 0);

const TORRENT_OPTS = {
  deselect: true,
  destroyStoreOnDestroy: true,
  path: TORRENT_PATH,
  addUID: true,
  storeCacheSlots: 8,
};

export const VIDEO_EXTENSIONS = [".mkv", ".mp4", ".avi", ".webm", ".mov", ".m4v", ".wmv"];

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
};

export const DEFAULT_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.qu.ax:6969/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://explodie.org:6969/announce",
  "udp://tracker.bittor.pw:1337/announce",
  "http://tracker.opentrackr.org:1337/announce",
  "http://tracker.renfei.net:8080/announce",
];

function normalizeTorrentTarget(target: string): string {
  const trimmed = target.trim();
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) {
    const trParams = DEFAULT_TRACKERS.map((tr) => `&tr=${encodeURIComponent(tr)}`).join("");
    return `magnet:?xt=urn:btih:${trimmed}${trParams}`;
  }
  return trimmed;
}

function isDestroyed(torrent: Torrent): boolean {
  return Boolean((torrent as unknown as { destroyed?: boolean }).destroyed);
}

// In-flight map to deduplicate concurrent requests for the same torrent
const torrentPromises = new Map<string, Promise<Torrent>>();

// Per-torrent lifecycle bookkeeping, keyed by infoHash
interface TorrentState {
  torrent: Torrent;
  lastAccess: number;
  activeStreams: number;
  timer?: NodeJS.Timeout;
}

const torrentStates = new Map<string, TorrentState>();

// Re-arm the idle timer. Never schedules removal while a stream is active.
function scheduleCleanup(state: TorrentState): void {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  if (state.activeStreams > 0) return;

  const delay = Math.max(0, state.lastAccess + IDLE_TTL_MS - Date.now());
  state.timer = setTimeout(() => {
    state.timer = undefined;
    if (state.activeStreams > 0) return;
    void destroyTorrent(state.torrent.infoHash);
  }, delay);
  // Don't keep the process alive just for cleanup.
  state.timer.unref?.();
}

function registerTorrent(torrent: Torrent): void {
  if (isDestroyed(torrent)) return;

  if (torrent.pieces.length > 0) {
    torrent.deselect(0, torrent.pieces.length - 1);
  }

  const state: TorrentState = {
    torrent,
    lastAccess: Date.now(),
    activeStreams: 0,
  };
  torrentStates.set(torrent.infoHash, state);
  scheduleCleanup(state);
}

function touchTorrent(torrent: Torrent): void {
  const state = torrentStates.get(torrent.infoHash);
  if (!state) return;
  state.lastAccess = Date.now();
  scheduleCleanup(state);
}

// Call before starting to serve a range. Pauses the idle timer.
export function beginStream(torrent: Torrent): void {
  const state = torrentStates.get(torrent.infoHash);
  if (!state) return;
  state.activeStreams += 1;
  state.lastAccess = Date.now();
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
}

// Call when a range finishes, errors, or is cancelled by the client.
export function endStream(torrent: Torrent): void {
  const state = torrentStates.get(torrent.infoHash);
  if (!state) return;
  state.activeStreams = Math.max(0, state.activeStreams - 1);
  state.lastAccess = Date.now();
  scheduleCleanup(state);
}

function evictIdleTorrent(): void {
  let victim: TorrentState | undefined;
  for (const state of torrentStates.values()) {
    if (state.activeStreams > 0) continue;
    if (!victim || state.lastAccess < victim.lastAccess) victim = state;
  }
  if (victim) void destroyTorrent(victim.torrent.infoHash);
}

// Make room for a new torrent without killing anything that is being watched.
function ensureCapacity(): void {
  while (torrentStates.size >= MAX_ACTIVE_TORRENTS) {
    const before = torrentStates.size;
    evictIdleTorrent();
    if (torrentStates.size === before) break; // everything is actively streaming
  }
}

// Get an already-loaded torrent or add via magnet/id; resolves once metadata (file list) is ready
export async function resolveTorrent(torrentId: string, timeoutMs = 30000): Promise<Torrent> {
  const target = normalizeTorrentTarget(torrentId);

  const existing = (await client.get(target)) || (await client.get(torrentId));
  if (existing) {
    const ready = existing.ready ? existing : await waitForTorrentReady(existing, timeoutMs);
    if (torrentStates.has(ready.infoHash)) touchTorrent(ready);
    else registerTorrent(ready);
    return ready;
  }

  const inFlight = torrentPromises.get(target);
  if (inFlight) return inFlight;

  const promise = (async () => {
    let torrent: Torrent | undefined;
    try {
      ensureCapacity();
      torrent = await client.add(target, TORRENT_OPTS);
      const ready = await waitForTorrentReady(torrent, timeoutMs);
      registerTorrent(ready);
      return ready;
    } catch (err) {
      // Never leave a half-loaded torrent (and its files) behind on failure.
      if (torrent && !isDestroyed(torrent)) void destroyTorrent(torrent.infoHash);
      throw err;
    } finally {
      torrentPromises.delete(target);
    }
  })();

  torrentPromises.set(target, promise);
  return promise;
}

// this function waits for the torrent to be ready, either by resolving immediately or after a timeout
function waitForTorrentReady(torrent: Torrent, timeoutMs: number): Promise<Torrent> {
  if (torrent.ready) return Promise.resolve(torrent);

  return new Promise<Torrent>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      torrent.removeListener("ready", onReady);
      torrent.removeListener("error", onError);
    };

    const onReady = () => {
      cleanup();
      resolve(torrent);
    };

    const onError = (err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timeout (${timeoutMs / 1000}s) waiting for torrent metadata. Ensure the torrent has active seeders.`,
        ),
      );
    }, timeoutMs);

    torrent.once("ready", onReady);
    torrent.once("error", onError);
  });
}

// Use Torrentio's fileIdx when given, otherwise fall back to the largest video file
export function pickFile(torrent: Torrent, fileIdx?: number): TorrentFile {
  if (fileIdx != null && !isNaN(fileIdx)) {
    const file = torrent.files[fileIdx];
    if (file) return file;
  }

  const videos = torrent.files.filter((file) =>
    VIDEO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  );
  const candidates = videos.length > 0 ? videos : torrent.files;

  if (candidates.length === 0) {
    throw new Error("Torrent contains no files");
  }

  return candidates.reduce((largest, file) => (file.length > largest.length ? file : largest));
}

// Handles HTTP Range requests so <video> can seek; return 206 partial content
export function streamFile(
  torrent: Torrent,
  file: TorrentFile,
  rangeHeader?: string,
  signal?: AbortSignal,
): Response {
  const size = file.length;
  const match = rangeHeader?.match(/bytes=(\d*)-(\d*)/);

  let start = 0;
  let end = size - 1;
  let status = 200;

  if (match) {
    if (!match[1] && match[2]) {
      // Suffix range: `bytes=-500` means the last 500 bytes.
      const suffix = parseInt(match[2], 10);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = match[1] ? parseInt(match[1], 10) : 0;
      end = match[2] ? parseInt(match[2], 10) : size - 1;
    }

    // Out-of-bounds range → 416 with acceptable range in header
    if (start >= size || end >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
  }

  const headers = new Headers({
    "Content-Type": MIME_TYPES[extOf(file.name)] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, Content-Type",
  });
  if (status === 206) {
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  const source = file.stream({ start, end });
  const reader = source.getReader();

  beginStream(torrent);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    endStream(torrent);
  };

  // Wrap the torrent file stream so we can observe completion/cancellation and
  // release the torrent (and its disk usage) once nobody is watching.
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
          return;
        }
        if (value) controller.enqueue(value);
      } catch (err) {
        finish();
        controller.error(err);
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });

  // If the client disconnects, stop reading from the torrent promptly.
  if (signal) {
    if (signal.aborted) {
      void reader.cancel();
    } else {
      signal.addEventListener("abort", () => void reader.cancel(), { once: true });
    }
  }

  return new Response(body, { status, headers });
}

// Grab file extension (".", "mkv") to pick the right MIME type
function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

// Clean up: stop seeding/fetching a torrent and delete its downloaded files.
export async function destroyTorrent(torrentId: string): Promise<void> {
  const torrent = await client.get(torrentId);
  if (!torrent) return;

  const state = torrentStates.get(torrent.infoHash);
  if (state?.timer) clearTimeout(state.timer);
  torrentStates.delete(torrent.infoHash);

  try {
    // destroyStore: true is what actually removes the files from disk.
    await client.remove(torrent.infoHash, { destroyStore: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("No torrent with id")) {
      console.error("Failed to remove torrent:", message);
    }
  }
}
