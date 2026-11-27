"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { MediaItem, PlaybackMediaInfo, TorrentStream, WatchHistoryItem, WatchlistItem } from "@/types";
import {
  addToWatchlist,
  fetchPopularMedia,
  fetchWatchHistory,
  fetchWatchlist,
  removeFromWatchlist,
  searchMedia,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navbar, type NavTab } from "@/components/Navbar";
import { StreamSelectorModal } from "@/components/StreamSelectorModal";
import { VideoPlayerModal } from "@/components/VideoPlayerModal";
import { DirectStreamModal } from "@/components/DirectStreamModal";
import { AuthModal } from "@/components/AuthModal";
import { useEscapeKey, useTabChange } from "@/hooks/KeyBoardControls";
import { Bookmark, Clock, Film, History, Loader2, Play, Sparkles, X } from "lucide-react";
import styles from "./home.module.css";

function mapWatchlistItems(list: WatchlistItem[]): MediaItem[] {
  return list.map((item) => ({
    id: String(item.mediaId),
    imdb_id: String(item.mediaId),
    type: item.mediaType === "series" ? "series" : "movie",
    name: item.title,
    poster: item.posterUrl ?? undefined,
    releaseInfo: item.releaseInfo ?? undefined,
  }));
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function getYear(value?: string): string {
  if (!value) return "";
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? value;
}

export default function HomePage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("movie");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [historyItems, setHistoryItems] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const effectiveWatchlistIds = token ? watchlistIds : new Set<string>();
  const [watchlistBusyId, setWatchlistBusyId] = useState<string | null>(null);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const homeStageRef = useRef<HTMLElement | null>(null);
  const nextSkipRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const feedGenerationRef = useRef(0);

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [activeStream, setActiveStream] = useState<{
    stream: TorrentStream;
    title: string;
    mediaInfo?: PlaybackMediaInfo;
  } | null>(null);
  const [showDirectStream, setShowDirectStream] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleTabChange = (tab: NavTab) => {
    setSelectedItem(null);
    setActiveTab(tab);
    setSearchQuery("");
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  useEscapeKey(() => {
    if (activeStream) {
      setActiveStream(null);
      return;
    }
    if (showAuthModal) {
      setShowAuthModal(false);
      return;
    }
    if (showDirectStream) {
      setShowDirectStream(false);
      return;
    }
    if (selectedItem) {
      setSelectedItem(null);
    }
  });

  useTabChange((key) => {
    if (key === "m") handleTabChange("movie");
    if (key === "s") handleTabChange("series");
    if (key === "d") setShowDirectStream(true);
  });

  useTabChange((key) => {
    if (key === "w") handleTabChange("watchlist");
    if (key === "h") handleTabChange("history");
  }, !!token);

  useEffect(() => {
    if (!token) return;

    fetchWatchlist(token)
      .then((list) => setWatchlistIds(new Set(list.map((item) => String(item.mediaId)))))
      .catch((error) => console.error("Error loading watchlist ids:", error));
  }, [token]);

  useEffect(() => {
    let isCurrent = true;
    feedGenerationRef.current += 1;

    void (async () => {
      setLoading(true);
      setItems([]);
      setHasMore(false);
      setFeaturedId(null);
      nextSkipRef.current = 0;
      loadingMoreRef.current = false;

      try {
        if (searchQuery.trim()) {
          const type = activeTab === "series" ? "series" : "movie";
          const results = await searchMedia(searchQuery, type);
          if (isCurrent) {
            setItems(results);
            setFeaturedId(results[0]?.id ?? null);
          }
          return;
        }

        if (activeTab === "watchlist") {
          if (!token) {
            if (isCurrent) setItems([]);
            return;
          }

          const list = await fetchWatchlist(token);
          if (isCurrent) {
            const mapped = mapWatchlistItems(list);
            setItems(mapped);
            setWatchlistIds(new Set(list.map((item) => String(item.mediaId))));
            setFeaturedId(mapped[0]?.id ?? null);
          }
          return;
        }

        if (activeTab === "history") {
          if (!token) {
            if (isCurrent) setHistoryItems([]);
            return;
          }

          const history = await fetchWatchHistory(token);
          if (isCurrent) setHistoryItems(history);
          return;
        }

        const page = await fetchPopularMedia(activeTab, 0);

        if (isCurrent) {
          setItems(page.items);
          setFeaturedId(page.items[0]?.id ?? null);
          setHasMore(page.hasMore);
          nextSkipRef.current = page.items.length;
        }
      } catch (error) {
        console.error("Error loading media:", error);
        if (isCurrent) {
          setItems([]);
          setHasMore(false);
          if (activeTab === "history") setHistoryItems([]);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    })();

    return () => {
      isCurrent = false;
      feedGenerationRef.current += 1;
    };
  }, [activeTab, searchQuery, token]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || loading || !hasMore || searchQuery.trim() || items.length === 0) return;
    if (activeTab !== "movie" && activeTab !== "series") return;

    const generation = feedGenerationRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMoreRef.current) return;

        loadingMoreRef.current = true;
        void (async () => {
          try {
            const catalogType = activeTab === "series" ? "series" : "movie";
            const page = await fetchPopularMedia(catalogType, nextSkipRef.current);
            if (generation !== feedGenerationRef.current) return;

            setItems((current) => {
              const seen = new Set(current.map((item) => item.id));
              const unique = page.items.filter((item) => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              });
              return unique.length > 0 ? [...current, ...unique] : current;
            });
            nextSkipRef.current += page.items.length;
            setHasMore(page.hasMore && page.items.length > 0);
          } catch (error) {
            console.error("Error loading more media:", error);
            if (generation === feedGenerationRef.current) setHasMore(false);
          } finally {
            loadingMoreRef.current = false;
          }
        })();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMore, items.length, loading, searchQuery]);

  useEffect(() => {
    const stage = homeStageRef.current;
    if (!stage) return;

    let frame = 0;
    let hidden = false;

    const update = () => {
      frame = 0;
      const fadeDistance = Math.max(1, window.innerHeight * 0.8);
      const scrollY = Math.max(0, window.scrollY);
      const progress = Math.min(scrollY / fadeDistance, 1);
      const nextHidden = progress >= 1;

      if (nextHidden !== hidden) {
        hidden = nextHidden;
        stage.dataset.heroHidden = String(hidden);
      }

      if (hidden) return;

      stage.style.setProperty("--hero-progress", progress.toFixed(3));
      stage.style.setProperty("--hero-offset", `${(scrollY * 0.42).toFixed(1)}px`);
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [activeTab, searchQuery, loading, featuredId]);

  const handleToggleWatchlist = async (item: MediaItem): Promise<boolean> => {
    if (!token) {
      setShowAuthModal(true);
      return false;
    }
    if (!item.id || !item.name) return false;

    const alreadySaved = watchlistIds.has(item.id);
    setWatchlistBusyId(item.id);

    try {
      if (alreadySaved) {
        await removeFromWatchlist(token, item.id);
        setWatchlistIds((previous) => {
          const next = new Set(previous);
          next.delete(item.id);
          return next;
        });
        if (activeTab === "watchlist") {
          setItems((previous) => previous.filter((entry) => entry.id !== item.id));
        }
      } else {
        await addToWatchlist(token, {
          mediaId: item.id,
          title: item.name,
          mediaType: item.type,
          posterUrl: item.poster,
          releaseInfo: item.releaseInfo,
        });
        setWatchlistIds((previous) => new Set(previous).add(item.id));
      }
      return true;
    } catch (error) {
      console.error("Watchlist update failed:", error);
      throw error;
    } finally {
      setWatchlistBusyId(null);
    }
  };

  const handlePlayStream = (
    stream: TorrentStream,
    title: string,
    mediaInfo?: PlaybackMediaInfo,
  ) => {
    setSelectedItem(null);
    setActiveStream({ stream, title, mediaInfo });
  };

  const featured = items.find((item) => item.id === featuredId) ?? items[0] ?? null;

  return (
    <div className={styles.appShell}>
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSearch={handleSearch}
        onOpenDirectStream={() => setShowDirectStream(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        showMediaNav={!selectedItem}
      />

      {loading ? (
        <main className={styles.loadingState}>
          <Loader2 className={styles.loadingIcon} />
          <span>Finding something worth watching…</span>
        </main>
      ) : activeTab === "history" ? (
        <main className={styles.libraryPage}>
          <div className={styles.libraryHeading}>
            <span className={styles.eyebrow}>YOUR LIBRARY</span>
            <h1>Continue watching</h1>
          </div>
          {historyItems.length === 0 ? (
            <div className={styles.emptyState}>
              <History size={28} />
              <strong>No watch history yet</strong>
              <span>Movies and shows you watch will appear here.</span>
            </div>
          ) : (
            <div className={styles.historyGrid}>
              {historyItems.map((entry) => {
                const progress = entry.duration > 0 ? (entry.currentTime / entry.duration) * 100 : 0;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={styles.historyCard}
                    onClick={() =>
                      setSelectedItem({
                        id: entry.mediaId,
                        imdb_id: entry.mediaId,
                        name: entry.title,
                        type: entry.mediaType,
                        poster: entry.posterUrl ?? undefined,
                      })
                    }
                  >
                    <div className={styles.historyPoster}>
                      {entry.posterUrl ? (
                        <Image src={entry.posterUrl} alt={entry.title} fill unoptimized sizes="96px" />
                      ) : (
                        <Film size={26} />
                      )}
                    </div>
                    <div className={styles.historyCardBody}>
                      <span className={styles.historyType}>
                        {entry.mediaType}
                        {entry.seasonNum ? ` · S${entry.seasonNum}:E${entry.episodeNum}` : ""}
                      </span>
                      <strong>{entry.title}</strong>
                      <div className={styles.progressMeta}>
                        <span><Clock size={12} /> {formatTime(entry.currentTime)}</span>
                        <span>{entry.completed ? "Completed" : `${Math.round(progress)}%`}</span>
                      </div>
                      <div className={styles.progressTrack}>
                        <span style={{ width: `${Math.min(100, Math.max(4, progress))}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      ) : items.length === 0 || !featured ? (
        <main className={styles.emptyPage}>
          <div className={styles.emptyState}>
            <Sparkles size={28} />
            <strong>{activeTab === "watchlist" ? "Your watchlist is empty" : "Nothing found"}</strong>
            <span>
              {activeTab === "watchlist"
                ? "Save a title with the bookmark control and it will appear here."
                : "Try another title or search with an IMDb ID."}
            </span>
          </div>
        </main>
      ) : (
        <main className={styles.homeStage} ref={homeStageRef}>
          <div className={styles.heroSpacer} aria-hidden="true" />
          <div
            className={styles.heroBackdrop}
            style={{ backgroundImage: `url("${featured.background || featured.poster || ""}")` }}
            role="img"
            aria-label={`${featured.name} backdrop`}
          />
          <div className={styles.heroAtmosphere} />
          <div className={styles.heroShade} />

          <section className={styles.heroCopy} aria-label="Featured title">
            <span className={styles.heroYear}>{getYear(featured.releaseInfo)}</span>
            <button
              className={styles.heroTitleButton}
              type="button"
              onClick={() => setSelectedItem(featured)}
              aria-label={`View streams for ${featured.name}`}
            >
              <h1>{featured.name}</h1>
            </button>
            <div className={styles.heroMeta}>
              <span>{featured.genre?.slice(0, 3).join(" | ") || (featured.type === "series" ? "Series" : "Movie")}</span>
              {searchQuery && <span className={styles.searchContext}>SEARCH RESULTS</span>}
              {activeTab === "watchlist" && <span className={styles.searchContext}>YOUR WATCHLIST</span>}
            </div>
          </section>

          <section className={styles.posterArea} aria-label="Browse titles">
            <div className={styles.posterGrid}>
              {items.map((item) => {
                const isFeatured = item.id === featured.id;
                const saved = effectiveWatchlistIds.has(item.id);
                return (
                  <article
                    className={`${styles.posterCard} ${isFeatured ? styles.posterCardActive : ""}`}
                    key={item.id}
                    onMouseEnter={() => setFeaturedId(item.id)}
                  >
                    <button
                      type="button"
                      className={styles.posterSelect}
                      onClick={() => setSelectedItem(item)}
                      onFocus={() => setFeaturedId(item.id)}
                      aria-label={`Open ${item.name} details`}
                    >
                      {item.poster ? (
                        <Image
                          src={item.poster}
                          alt={item.name}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 108px, (max-width: 1200px) 14vw, 170px"
                        />
                      ) : (
                        <span className={styles.posterFallback}>{item.name}</span>
                      )}
                    </button>
                    <div className={styles.posterHoverOverlay}>
                      <button
                        type="button"
                        className={styles.posterPlayButton}
                        title={`View streams for ${item.name}`}
                        aria-label={`View streams for ${item.name}`}
                        onClick={() => setSelectedItem(item)}
                      >
                        <Play size={18} fill="currentColor" />
                      </button>
                      <div className={styles.posterHoverInfo}>
                        <strong className={styles.posterHoverName}>{item.name}</strong>
                        <span className={styles.posterHoverYear}>
                          {getYear(item.releaseInfo) || (item.type === "series" ? "Series" : "Movie")}
                        </span>
                      </div>
                    </div>
                    <div className={styles.posterActions}>
                      <button
                        type="button"
                        title={saved ? "Remove from watchlist" : "Add to watchlist"}
                        aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
                        disabled={watchlistBusyId === item.id}
                        onClick={() => void handleToggleWatchlist(item)}
                      >
                        <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {hasMore && (
              <div ref={loadMoreRef} className={styles.loadMoreSentinel} role="status">
                <Loader2 className={styles.loadingIcon} />
                <span>Loading more titles…</span>
              </div>
            )}
          </section>
        </main>
      )}

      {selectedItem && (
        <>
          <StreamSelectorModal
            item={selectedItem}
              inWatchlist={effectiveWatchlistIds.has(selectedItem.id)}
            onToggleWatchlist={handleToggleWatchlist}
            onRequireAuth={() => setShowAuthModal(true)}
            onPlayStream={handlePlayStream}
          />
          <button
            type="button"
            className={styles.closeStreamButton}
            onClick={() => setSelectedItem(null)}
            aria-label={`Close ${selectedItem.name} details`}
            title="Close details"
          >
            <X size={18} />
          </button>
        </>
      )}

      {showDirectStream && (
        <DirectStreamModal
          onClose={() => setShowDirectStream(false)}
          onPlayStream={handlePlayStream}
        />
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {activeStream && (
        <VideoPlayerModal
          stream={activeStream.stream}
          title={activeStream.title}
          mediaInfo={activeStream.mediaInfo}
          onClose={() => setActiveStream(null)}
        />
      )}

    </div>
  );
}
