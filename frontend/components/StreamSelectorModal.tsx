"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { parseStreamTitle, type MediaItem, type SeriesDetails, type TorrentStream } from "@/types";
import { fetchStreams, getSeriesDetails } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle, Bookmark, Check, Copy, HardDrive, Loader2, Play, Users } from "lucide-react";
import styles from "@/app/home.module.css";

interface StreamSelectorModalProps {
  item: MediaItem;
  inWatchlist?: boolean;
  onToggleWatchlist?: (item: MediaItem) => Promise<boolean>;
  onRequireAuth?: () => void;
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
  const [selectedQuality, setSelectedQuality] = useState<string | null>("4K");
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

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
      window.setTimeout(() => setCopiedIndex(null), 1800);
    } catch (copyError) {
      console.error("Could not copy magnet link:", copyError);
    }
  };

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

  return (
    <div
      className={styles.streamScreen}
      style={{ "--detail-backdrop": backdrop ? `url("${backdrop}")` : "none" } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} streams`}
    >
      <div className={styles.detailLayout}>
        <aside className={styles.detailPosterColumn}>
          <div className={styles.detailPoster}>
            {item.poster ? (
              <Image src={item.poster} alt={`${item.name} poster`} fill unoptimized sizes="(max-width: 720px) 58vw, 438px" />
            ) : (
              <div className={styles.posterFallback}>{item.name}</div>
            )}
          </div>
        </aside>

        <section className={styles.detailContent}>
          <div className={styles.detailTopline}>
            <span className={styles.detailYear}>{getYear(item.releaseInfo)}</span>
            <button
              type="button"
              className={`${styles.watchlistButton} ${inWatchlist ? styles.watchlistButtonSaved : ""}`}
              onClick={() => void toggleWatchlist()}
              disabled={watchlistLoading}
              aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Bookmark size={15} fill={inWatchlist ? "currentColor" : "none"} />
            </button>
          </div>

          <h1 className={styles.detailTitle}>{item.name}</h1>

          <div className={styles.detailMeta}>
            <span>{item.type === "series" ? "Series" : "Movie"}</span>
            {item.genre && item.genre.length > 0 && (
              <span className={styles.detailGenre}>{item.genre.slice(0, 3).join(" | ")}</span>
            )}
          </div>

          {watchlistError && <p className={styles.seriesError}>{watchlistError}</p>}

          {isSeries && (
            <>
              {effectiveSeriesLoading ? (
                <div className={styles.seriesError}>Loading seasons and episodes…</div>
              ) : (
                <div className={styles.seriesControls}>
                  <select
                    className={styles.seriesSelect}
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
                          <option key={entry} value={entry}>Season {entry}</option>
                        ))}
                  </select>
                  <select
                    className={styles.seriesSelect}
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
                          <option key={entry} value={entry}>Episode {entry}</option>
                        ))}
                  </select>
                </div>
              )}
              {effectiveSeriesError && <p className={styles.seriesError}>{effectiveSeriesError} Manual selection is available.</p>}
            </>
          )}

          <div className={styles.qualityRow} aria-label="Filter stream quality">
            {QUALITY_FILTERS.map((quality) => (
              <button
                key={quality}
                type="button"
                className={`${styles.qualityButton} ${selectedQuality === quality ? styles.qualityButtonActive : ""}`}
                onClick={() => setSelectedQuality(selectedQuality === quality ? null : quality)}
                aria-pressed={selectedQuality === quality}
              >
                {quality}
              </button>
            ))}
          </div>

          <section className={styles.streamsSection} aria-label="Available torrent streams">
            <div className={styles.streamSectionLabel}>
              <span>Available streams</span>
              {!loading && !error && <span>{filteredStreams.length} found</span>}
            </div>

            {loading ? (
              <div className={styles.streamMessage}>
                <Loader2 className="animate-spin" size={24} />
                <span>Fetching torrent streams from MagnetIO…</span>
              </div>
            ) : error ? (
              <div className={`${styles.streamMessage} ${styles.streamMessageError}`}>
                <AlertCircle size={22} />
                <span>{error}</span>
              </div>
            ) : streams.length === 0 ? (
              <div className={styles.streamMessage}>No active torrent streams found for this title.</div>
            ) : filteredStreams.length === 0 ? (
              <div className={styles.streamMessage}>
                No streams over 50 seeders match this quality. Select another quality or clear the filter.
              </div>
            ) : (
              filteredStreams.map(({ stream, index, info }) => (
                <article
                  className={styles.streamCard}
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
                  <div className={styles.streamDescription}>
                    <span className={styles.streamTitle} title={info.rawTitle}>{info.rawTitle}</span>
                    <div className={styles.streamMeta}>
                      {info.size !== "—" && (
                        <span><HardDrive size={13} /> {info.size}</span>
                      )}
                      {info.seeders !== "—" && (
                        <span><Users size={13} /> {info.seeders} seeders</span>
                      )}
                      <span className={styles.providerTag}>{info.provider}</span>
                    </div>
                  </div>

                  <div className={styles.streamActions}>
                    <button
                      type="button"
                      className={styles.copyButton}
                      title="Copy magnet link"
                      aria-label="Copy magnet link"
                      onClick={(event) => void handleCopyMagnet(stream.magnet, index, event)}
                    >
                      {copiedIndex === index ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button
                      type="button"
                      className={styles.playButton}
                      title="Play this stream"
                      aria-label="Play this stream"
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
