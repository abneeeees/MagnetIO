"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { parseStreamTitle, type MediaItem, type SeriesDetails, type TorrentStream } from "@/types";
import { fetchStreams, getSeriesDetails } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  AlertCircle,
  Bookmark,
  Check,
  Copy,
  HardDrive,
  Loader2,
  Play,
  Users,
  X,
} from "lucide-react";

interface StreamSelectorModalProps {
  item: MediaItem;
  inWatchlist?: boolean;
  onToggleWatchlist?: (item: MediaItem) => Promise<boolean>;
  onRequireAuth?: () => void;
  onClose: () => void;
  onPlayStream: (
    stream: TorrentStream,
    title: string,
    mediaInfo?: {
      mediaId: string;
      title: string;
      mediaType: string;
      seasonNum?: number;
      episodeNum?: number;
      posterUrl?: string;
    },
  ) => void;
}

const QUALITY_FILTERS = ["4K", "1080p", "720p", "HD"];
const glassPanel =
  "border border-(--glass-border) bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg)] shadow-[0_8px_24px_rgba(0,0,0,0.15)] backdrop-blur-(--glass-blur) [-webkit-backdrop-filter:blur(var(--glass-blur))]";

function getSelectableSeasons(details: SeriesDetails | null) {
  if (!details) return [];
  const regularSeasons = details.seasons.filter((season) => season.seasonNumber > 0);
  return regularSeasons.length > 0 ? regularSeasons : details.seasons;
}

function getEpisodesForSeason(details: SeriesDetails | null, seasonNumber: number) {
  return details?.seasons.find((season) => season.seasonNumber === seasonNumber)?.episodes ?? [];
}

function getYear(releaseInfo?: string) {
  if (!releaseInfo) return "";
  return releaseInfo.match(/\b(19|20)\d{2}\b/)?.[0] ?? releaseInfo;
}

export function StreamSelectorModal({
  item,
  inWatchlist = false,
  onToggleWatchlist,
  onRequireAuth,
  onClose,
  onPlayStream,
}: StreamSelectorModalProps) {
  const { user } = useAuth();
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(item.type === "series");
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [loading, setLoading] = useState(true);
  const isSeries = item.type === "series";
  const effectiveSeriesDetails = isSeries ? seriesDetails : null;
  const effectiveSeriesLoading = isSeries ? seriesLoading : false;
  const effectiveSeriesError = isSeries ? seriesError : null;
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string | null>("1080p");
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const backdrop = item.background || item.poster;

  const selectableSeasons = useMemo(
    () => getSelectableSeasons(effectiveSeriesDetails),
    [effectiveSeriesDetails],
  );
  const episodesForSeason = useMemo(
    () => getEpisodesForSeason(effectiveSeriesDetails, season),
    [effectiveSeriesDetails, season],
  );

  const filteredStreams = useMemo(
    () =>
      streams
        .map((stream, index) => ({ stream, index, info: parseStreamTitle(stream.title) }))
        .filter(({ info }) => {
          const seedCount = Number(info.seeders);
          if (!Number.isFinite(seedCount) || seedCount <= 50) return false;
          if (!selectedQuality) return true;
          return info.quality === selectedQuality;
        }),
    [streams, selectedQuality],
  );

  useEffect(() => {
    if (item.type !== "series") return;

    let cancelled = false;

    void (async () => {
      setSeriesDetails(null);
      setSeriesError(null);
      setSeriesLoading(true);
      setStreams([]);
      setLoading(true);

      try {
        const details = await getSeriesDetails(item.id);
        if (cancelled) return;

        setSeriesDetails(details);
        const firstSeason = getSelectableSeasons(details)[0];
        if (firstSeason) {
          setSeason(firstSeason.seasonNumber);
          setEpisode(firstSeason.episodes[0]?.episodeNumber ?? 1);
        }
      } catch (loadError) {
        if (cancelled) return;
        console.error("Failed to load series details:", loadError);
        setSeriesError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load season and episode information.",
        );
      } finally {
        if (!cancelled) setSeriesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.id, item.type]);

  const waitingForSeriesInfo = isSeries && effectiveSeriesLoading;

  useEffect(() => {
    if (waitingForSeriesInfo) return;

    let isCurrent = true;
    const loadStreams = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchStreams(
          item.type,
          item.id,
          item.type === "series" ? season : undefined,
          item.type === "series" ? episode : undefined,
        );
        if (isCurrent) setStreams(data);
      } catch (loadError) {
        if (!isCurrent) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to fetch streams from backend.",
        );
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    void loadStreams();
    return () => {
      isCurrent = false;
    };
  }, [item.id, item.type, season, episode, waitingForSeriesInfo]);

  const toggleWatchlist = async () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (!onToggleWatchlist) return;

    setWatchlistError(null);
    setWatchlistLoading(true);
    try {
      const ok = await onToggleWatchlist(item);
      if (!ok) setWatchlistError("Could not update your watchlist.");
    } catch (toggleError) {
      console.error("Watchlist toggle failed:", toggleError);
      setWatchlistError(
        toggleError instanceof Error ? toggleError.message : "Could not update your watchlist.",
      );
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleCopyMagnet = async (magnet: string, index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(magnet);
      setCopiedIndex(index);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedIndex(null), 1800);
    } catch (copyError) {
      console.error("Could not copy magnet link:", copyError);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleSeasonChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSeason = Number(event.target.value);
    setSeason(nextSeason);
    setEpisode(getEpisodesForSeason(seriesDetails, nextSeason)[0]?.episodeNumber ?? 1);
  };

  const playStream = (stream: TorrentStream, info: ReturnType<typeof parseStreamTitle>) => {
    onPlayStream(stream, `${item.name} (${info.quality})`, {
      mediaId: item.id,
      title: item.name,
      mediaType: item.type,
      seasonNum: item.type === "series" ? season : undefined,
      episodeNum: item.type === "series" ? episode : undefined,
      posterUrl: item.poster,
    });
  };

  const qualityBase =
    "flex h-9.5 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 font-['Instrument_Sans',sans-serif] text-[clamp(12px,0.95vw,16px)] font-normal text-white transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),rgba(78,33,40,0.72)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid max-[720px]:h-9 max-[720px]:text-xs motion-reduce:transition-none motion-reduce:hover:transform-none";

  const qualityActive =
    "relative mt-1 z-10 h-8.5 border border-(--glass-border-strong) -translate-y-0.5 scale-[1.03] bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),rgba(92,29,38,0.9)] shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 isolate z-70 overflow-x-hidden overflow-y-auto bg-[radial-gradient(ellipse_at_14%_8%,rgba(251,44,54,0.14),transparent_44%),radial-gradient(ellipse_at_58%_26%,rgba(111,46,103,0.48)_0%,rgba(65,28,78,0.28)_31%,transparent_61%),radial-gradient(ellipse_at_42%_42%,rgba(86,33,90,0.2),transparent_50%),linear-gradient(115deg,#110f1c_0%,#171126_46%,#0e0d13_100%)] text-white before:pointer-events-none before:fixed before:inset-[-10%] before:z-[-2] before:scale-[1.04] before:[background-image:var(--detail-backdrop,none)] before:bg-cover before:bg-center before:opacity-50 before:blur-lg before:saturate-[1.4] before:content-[''] after:pointer-events-none after:fixed after:inset-0 after:z-[-1] after:bg-[linear-gradient(180deg,rgba(10,8,15,0.32),transparent_30%,rgba(12,12,13,0.46)_100%)] after:content-[''] motion-reduce:before:scale-100 motion-reduce:before:blur-none"
      style={
        { "--detail-backdrop": backdrop ? `url("${backdrop}")` : "none" } as React.CSSProperties
      }
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} streams`}
    >
      <div className="mx-[6.3vw] mt-[clamp(88px,9vh,132px)] mr-[3.75vw] mb-18 grid grid-cols-[minmax(260px,438px)_minmax(0,1fr)] items-start gap-[clamp(34px,3.75vw,72px)] max-[1100px]:mt-24 max-[1100px]:grid-cols-[minmax(210px,31vw)_minmax(0,1fr)] max-[1100px]:gap-8 max-[720px]:mx-4.5 max-[720px]:mt-18 max-[720px]:mb-14 max-[720px]:flex max-[720px]:flex-col max-[720px]:gap-6.5">
        <aside className="w-full max-w-109.5 max-[720px]:mx-0 max-[720px]:w-[min(58vw,245px)]">
          <div className="relative aspect-2/3 w-full overflow-hidden rounded-[23px] border border-(--glass-border-strong) bg-[linear-gradient(145deg,rgba(255,255,255,0.1),transparent_42%),var(--glass-bg)] shadow-[0_24px_70px_rgba(0,0,0,0.46),inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturate) after:pointer-events-none after:absolute after:inset-0 after:z-1 after:rounded-[inherit] after:bg-[linear-gradient(160deg,rgba(255,255,255,0.12),transparent_42%)] after:shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] after:content-[''] max-[720px]:rounded-[14px] [&_img]:object-cover">
            {item.poster ? (
              <Image
                src={item.poster}
                alt={`${item.name} poster`}
                fill
                unoptimized
                sizes="(max-width: 720px) 58vw, 438px"
              />
            ) : (
              <div className="grid h-full w-full place-items-center p-2.5 text-center font-['Instrument_Serif',Georgia,serif] text-xl text-[rgba(255,255,255,0.75)]">
                {item.name}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 pt-0.5 max-[720px]:w-full">
          <div className="relative flex items-start justify-between gap-6">
            <span className="block font-['Instrument_Serif',Georgia,serif] text-[clamp(24px,2.77vw,53px)] leading-none text-[rgba(255,255,255,0.96)] max-[720px]:text-2xl">
              {getYear(item.releaseInfo)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`m-0 grid h-8 w-8 cursor-pointer place-items-center rounded-[7px] border border-(--glass-border) bg-(--glass-bg) p-0 text-(--text-muted) shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[background-color,border-color,color,transform] duration-160 ease-out hover:border-(--glass-border-strong) hover:bg-white/14 hover:text-white active:scale-[0.92] motion-reduce:transition-none ${inWatchlist ? "border-(--glass-border-strong) bg-white/14 text-white" : ""}`}
                onClick={() => void toggleWatchlist()}
                disabled={watchlistLoading}
                aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Bookmark size={15} fill={inWatchlist ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                className="m-0 grid h-8 w-8 cursor-pointer place-items-center rounded-[7px] border border-(--glass-border) bg-(--glass-bg) p-0 text-(--text-muted) shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[background-color,border-color,color,transform] duration-160 ease-out hover:border-(--glass-border-strong) hover:bg-white/14 hover:text-white active:scale-[0.92] motion-reduce:transition-none"
                onClick={onClose}
                aria-label={`Close ${item.name} details`}
                title="Close details"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <h1 className="m-0 font-['Instrument_Serif','Times_New_Roman',serif] text-[clamp(56px,9vw,176px)] leading-[0.97] font-normal tracking-[-0.045em] wrap-anywhere text-white max-[720px]:text-[clamp(48px,11vw,72px)]">
            {item.name}
          </h1>

          <div className="mt-0 flex min-h-8.5 items-center justify-between gap-4.5 font-['Instrument_Serif',Georgia,serif] text-[clamp(15px,1.8vw,35px)] leading-[1.15] text-[rgba(255,255,255,0.94)] max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-1.25 max-[720px]:text-[17px]">
            <span>{item.type === "series" ? "Series" : "Movie"}</span>
            {item.genre && item.genre.length > 0 && (
              <span className="text-right max-[720px]:text-left">
                {item.genre.slice(0, 3).join(" | ")}
              </span>
            )}
          </div>

          {watchlistError && <p className="mt-2.5 text-[11px] text-[#e7b878]">{watchlistError}</p>}

          {isSeries && (
            <>
              {effectiveSeriesLoading ? (
                <div className="mt-2.5 text-[11px] text-[#e7b878]">
                  Loading seasons and episodes…
                </div>
              ) : (
                <div className="mt-4.5 grid grid-cols-2 gap-2.5 max-[720px]:grid-cols-2 max-[420px]:grid-cols-1">
                  <select
                    className="h-10.5 min-w-0 rounded-lg border border-(--glass-border) bg-(--glass-bg) px-3 font-[inherit] text-xs text-white shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[border-color,background-color] duration-160 ease-out outline-none hover:border-(--glass-border-strong) hover:bg-(--glass-bg-strong) focus-visible:border-(--glass-border-strong) focus-visible:bg-(--glass-bg-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid motion-reduce:transition-none [&_option]:bg-[#17131e] [&_option]:text-white"
                    value={season}
                    onChange={handleSeasonChange}
                    aria-label="Select season"
                  >
                    {selectableSeasons.length > 0
                      ? selectableSeasons.map((entry) => (
                          <option key={entry.seasonNumber} value={entry.seasonNumber}>
                            {entry.name}
                          </option>
                        ))
                      : Array.from({ length: 50 }, (_, index) => index + 1).map((entry) => (
                          <option key={entry} value={entry}>
                            Season {entry}
                          </option>
                        ))}
                  </select>
                  <select
                    className="h-10.5 min-w-0 rounded-lg border border-(--glass-border) bg-(--glass-bg) px-3 font-[inherit] text-xs text-white shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[border-color,background-color] duration-160 ease-out outline-none hover:border-(--glass-border-strong) hover:bg-(--glass-bg-strong) focus-visible:border-(--glass-border-strong) focus-visible:bg-(--glass-bg-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid motion-reduce:transition-none [&_option]:bg-[#17131e] [&_option]:text-white"
                    value={episode}
                    onChange={(event) => setEpisode(Number(event.target.value))}
                    aria-label="Select episode"
                  >
                    {episodesForSeason.length > 0
                      ? episodesForSeason.map((entry) => (
                          <option key={entry.episodeNumber} value={entry.episodeNumber}>
                            Episode {entry.episodeNumber}: {entry.name}
                          </option>
                        ))
                      : Array.from({ length: 100 }, (_, index) => index + 1).map((entry) => (
                          <option key={entry} value={entry}>
                            Episode {entry}
                          </option>
                        ))}
                  </select>
                </div>
              )}
              {effectiveSeriesError && (
                <p className="mt-2.5 text-[11px] text-[#e7b878]">
                  {effectiveSeriesError} Manual selection is available.
                </p>
              )}
            </>
          )}

          <div className="mt-[clamp(36px,4vw,56px)] max-[720px]:mt-7">
            <div className="mb-2.5 flex items-center justify-between font-['Instrument_Sans',sans-serif] text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
              <span>
                Available streams
                {!loading && !error && ` (${filteredStreams.length})`}
              </span>
            </div>
            <div
              className={`grid grid-cols-4 gap-1 rounded-full p-1 ${glassPanel}`}
              aria-label="Filter stream quality"
            >
              {QUALITY_FILTERS.map((quality) => (
                <button
                  key={quality}
                  type="button"
                  className={`${qualityBase} ${selectedQuality === quality ? qualityActive : ""}`}
                  onClick={() => setSelectedQuality(selectedQuality === quality ? null : quality)}
                  aria-pressed={selectedQuality === quality}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>

          <section
            className="mt-5.5 flex max-h-[min(52vh,560px)] scrollbar-thin [scrollbar-color:rgba(255,255,255,0.22)_transparent] flex-col gap-2.5 overflow-y-auto overscroll-contain max-[720px]:max-h-[56vh] max-[720px]:gap-2 max-[720px]:pb-10 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.22)]"
            aria-label="Available torrent streams"
          >
            {loading ? (
              <div
                className={`flex min-h-30 flex-col items-center justify-center gap-2.5 rounded-[14px] p-5.5 text-center text-xs text-(--text-muted) backdrop-blur-(--glass-blur) [-webkit-backdrop-filter:blur(var(--glass-blur))] ${glassPanel}`}
              >
                <Loader2 className="animate-spin" size={24} />
                <span>Fetching torrent streams from MagnetIO…</span>
              </div>
            ) : error ? (
              <div
                className={`flex min-h-30 flex-col items-center justify-center gap-2.5 rounded-[14px] border border-[rgba(255,110,120,0.32)] bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg)] p-5.5 text-center text-xs text-[#ff9ca4] shadow-(--glass-shadow) backdrop-blur-(--glass-blur) [-webkit-backdrop-filter:blur(var(--glass-blur))]`}
              >
                <AlertCircle size={22} />
                <span>{error}</span>
              </div>
            ) : streams.length === 0 ? (
              <div
                className={`flex min-h-30 flex-col items-center justify-center gap-2.5 rounded-[14px] p-5.5 text-center text-xs text-(--text-muted) backdrop-blur-(--glass-blur) [-webkit-backdrop-filter:blur(var(--glass-blur))] ${glassPanel}`}
              >
                No active torrent streams found for this title.
              </div>
            ) : filteredStreams.length === 0 ? (
              <div
                className={`flex min-h-30 flex-col items-center justify-center gap-2.5 rounded-[14px] p-5.5 text-center text-xs text-(--text-muted) backdrop-blur-(--glass-blur) [-webkit-backdrop-filter:blur(var(--glass-blur))] ${glassPanel}`}
              >
                No streams over 50 seeders match this quality. Select another quality or clear the
                filter.
              </div>
            ) : (
              filteredStreams.map(({ stream, index, info }) => (
                <article
                  className="group mt-0.5 mr-3 ml-3 flex min-h-19 cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-(--glass-border) bg-[linear-gradient(120deg,var(--glass-highlight),transparent_42%),var(--glass-bg)] py-3 pr-3.5 pl-4.5 shadow-[var(--glass-shadow),inset_3px_0_0_rgba(251,44,54,0.38)] backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturate) transition-[border-color,background-color,transform,box-shadow] duration-160 ease-out hover:-translate-y-0.5 hover:scale-[1.012] hover:border-(--glass-border-strong) hover:bg-[linear-gradient(120deg,var(--glass-highlight),transparent_42%),var(--glass-bg-strong)] hover:shadow-[0_18px_44px_rgba(0,0,0,0.46),inset_3px_0_0_var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid motion-reduce:transition-none motion-reduce:hover:transform-none max-[1100px]:pl-4 max-[720px]:min-h-18.5 max-[720px]:gap-2 max-[720px]:rounded-xl max-[720px]:py-2.5 max-[720px]:pr-2.5 max-[720px]:pl-3.5"
                  key={`${stream.infoHash}-${index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => playStream(stream, info)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      playStream(stream, info);
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span
                      className="overflow-hidden font-['Instrument_Sans',sans-serif] text-[clamp(12px,0.95vw,16px)] leading-[1.35] font-medium text-ellipsis whitespace-nowrap text-white max-[720px]:max-w-full max-[720px]:text-xs"
                      title={info.rawTitle}
                    >
                      {info.rawTitle}
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5 font-['Instrument_Sans',sans-serif] text-[clamp(10px,0.78vw,12px)] text-(--text-subtle) max-[720px]:gap-1.75 max-[720px]:text-[10px] [&_span]:whitespace-nowrap">
                      {info.size !== "—" && (
                        <span className="inline-flex items-center gap-1">
                          <HardDrive size={13} /> {info.size}
                        </span>
                      )}
                      {info.seeders !== "—" && (
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} /> {info.seeders} seeders
                        </span>
                      )}
                      <span className="inline-flex h-5.5 min-w-17 items-center justify-center overflow-hidden rounded-full border border-(--glass-border) bg-white/5 px-1.75 text-[10px] tracking-[0.04em] text-ellipsis text-(--text-muted) uppercase max-[720px]:h-5 max-[720px]:min-w-0 max-[720px]:px-1.5 max-[720px]:text-[9px]">
                        {info.provider}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 max-[720px]:gap-1.5">
                    <button
                      type="button"
                      className="grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] border border-(--glass-border) bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg)] p-0 text-(--text-muted) shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[color,background-color,border-color,transform] duration-150 ease-out hover:border-(--glass-border-strong) hover:bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg-strong)] hover:text-white active:scale-[0.94] motion-reduce:transition-none [&_svg]:h-4.5 [&_svg]:w-4.5 [&_svg]:stroke-[1.8]"
                      title={copiedIndex === index ? "Magnet link copied" : "Copy magnet link"}
                      aria-label={copiedIndex === index ? "Magnet link copied" : "Copy magnet link"}
                      onClick={(event) => void handleCopyMagnet(stream.magnet, index, event)}
                    >
                      {copiedIndex === index ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button
                      type="button"
                      className="grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] border border-[rgba(251,44,54,0.45)] bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),rgba(251,44,54,0.24)] p-0 text-white shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[color,background-color,border-color,transform] duration-150 ease-out hover:border-[rgba(251,44,54,0.7)] hover:bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),rgba(251,44,54,0.34)] hover:text-white active:scale-[0.94] motion-reduce:transition-none [&_svg]:h-4.5 [&_svg]:w-4.5 [&_svg]:fill-current [&_svg]:stroke-1"
                      title="Play this stream"
                      aria-label={`Play ${info.rawTitle}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        playStream(stream, info);
                      }}
                    >
                      <Play size={18} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
