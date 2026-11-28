"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type {
  MediaItem,
  PlaybackMediaInfo,
  TorrentStream,
  WatchHistoryItem,
  WatchlistItem,
} from "@/types";
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

const glassPanel =
  "border border-(--glass-border) bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg)] shadow-(--glass-shadow) backdrop-blur-(--glass-blur) [-webkit-backdrop-filter:blur(var(--glass-blur))]";

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
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
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
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updatePointerType = () => setIsCoarsePointer(coarsePointerQuery.matches);

    updatePointerType();
    coarsePointerQuery.addEventListener("change", updatePointerType);

    return () => coarsePointerQuery.removeEventListener("change", updatePointerType);
  }, []);

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
    <div className="min-h-svh overflow-x-hidden bg-[radial-gradient(ellipse_at_78%_-8%,rgba(251,44,54,0.1),transparent_44%),radial-gradient(ellipse_at_10%_4%,rgba(139,61,105,0.12),transparent_42%),#121212] font-['Instrument_Sans',var(--font-geist-sans),Arial,sans-serif] text-white [--magnet-red:#c85f66]">
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSearch={handleSearch}
        onOpenDirectStream={() => setShowDirectStream(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        showMediaNav={!selectedItem}
      />

      {loading ? (
        <main className="min-h-100svh flex flex-col items-center justify-center gap-2.5 bg-[radial-gradient(ellipse_at_50%_25%,rgba(251,44,54,0.12),transparent_47%),radial-gradient(ellipse_at_50%_25%,rgba(99,44,106,0.24),transparent_47%),#121212] px-6 pt-27.5 pb-15 text-[13px] text-[rgba(255,255,255,0.5)]">
          <Loader2 className="h-7 w-7 animate-spin text-[rgba(255,255,255,0.7)] motion-reduce:animate-none" />
          <span>Finding something worth watching…</span>
        </main>
      ) : activeTab === "history" ? (
        <main className="min-h-100svh bg-[radial-gradient(ellipse_at_66%_18%,rgba(90,36,103,0.28),transparent_42%),#121212] px-[6.3vw] pt-37.5 pb-28 max-[720px]:px-4.5 max-[720px]:pt-27.5 max-[720px]:pb-13.75">
          <div className="mb-7">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-(--text-subtle)">
              YOUR LIBRARY
            </span>
            <h1 className="mt-1.75 font-['Instrument_Serif',Georgia,serif] text-[clamp(38px,5vw,72px)] font-normal">
              Continue watching
            </h1>
          </div>
          {historyItems.length === 0 ? (
            <div
              className={`flex min-h-57.5 flex-col items-center justify-center gap-2.25 rounded-[18px] p-7.5 text-center text-(--text-subtle) ${glassPanel}`}
            >
              <History size={28} />
              <strong className="text-sm font-medium text-white">No watch history yet</strong>
              <span className="text-xs text-(--text-muted)">
                Movies and shows you watch will appear here.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5 max-[720px]:grid-cols-1">
              {historyItems.map((entry) => {
                const progress =
                  entry.duration > 0 ? (entry.currentTime / entry.duration) * 100 : 0;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="flex min-w-0 cursor-pointer gap-3.5 rounded-xl border border-(--glass-border) bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg-strong)] p-3 text-left text-white shadow-(--glass-shadow) backdrop-blur-(--glass-blur) transition-[border-color,background-color,transform] duration-160 ease-out [-webkit-backdrop-filter:blur(var(--glass-blur))] hover:-translate-y-0.5 hover:border-(--glass-border-strong) hover:bg-white/12 active:translate-y-0 motion-reduce:transition-none"
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
                    <div className="relative grid h-24 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-[#252027] text-[rgba(255,255,255,0.4)] [&_img]:object-cover">
                      {entry.posterUrl ? (
                        <Image
                          src={entry.posterUrl}
                          alt={entry.title}
                          fill
                          unoptimized
                          sizes="96px"
                        />
                      ) : (
                        <Film size={26} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.75">
                      <span className="text-[9px] tracking-[0.12em] text-[#e66e7a] uppercase">
                        {entry.mediaType}
                        {entry.seasonNum ? ` · S${entry.seasonNum}:E${entry.episodeNum}` : ""}
                      </span>
                      <strong className="overflow-hidden text-[13px] font-medium text-ellipsis whitespace-nowrap text-[rgba(255,255,255,0.94)]">
                        {entry.title}
                      </strong>
                      <div className="flex justify-between text-[10px] text-(--text-subtle)">
                        <span className="inline-flex items-center gap-1.25">
                          <Clock size={12} /> {formatTime(entry.currentTime)}
                        </span>
                        <span>{entry.completed ? "Completed" : `${Math.round(progress)}%`}</span>
                      </div>
                      <div className="h-0.75 overflow-hidden rounded-full bg-white/12">
                        <span
                          className="block h-full rounded-[inherit] bg-[#e8e1ed]"
                          style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      ) : items.length === 0 || !featured ? (
        <main className="min-h-100svh flex flex-col items-center justify-center gap-2.5 bg-[radial-gradient(ellipse_at_50%_25%,rgba(251,44,54,0.12),transparent_47%),radial-gradient(ellipse_at_50%_25%,rgba(99,44,106,0.24),transparent_47%),#121212] px-6 pt-27.5 pb-15 text-[13px] text-[rgba(255,255,255,0.5)]">
          <div
            className={`flex min-h-57.5 w-full max-w-xl flex-col items-center justify-center gap-2.25 rounded-[18px] p-7.5 text-center text-(--text-subtle) ${glassPanel}`}
          >
            <Sparkles size={28} />
            <strong className="text-sm font-medium text-white">
              {activeTab === "watchlist" ? "Your watchlist is empty" : "Nothing found"}
            </strong>
            <span className="text-xs text-(--text-muted)">
              {activeTab === "watchlist"
                ? "Save a title with the bookmark control and it will appear here."
                : "Try another title or search with an IMDb ID."}
            </span>
          </div>
        </main>
      ) : (
        // Main body
        <main
          className="group/stage min-h-100svh relative isolate overflow-x-hidden overflow-y-visible bg-[#121212] pb-28 [--hero-offset:0px] [--hero-progress:0] max-[720px]:pb-26"
          ref={homeStageRef}
        >
          {/* background image */}
          <div
            className="absolute top-0 left-0 z-[-3] h-svh w-full scale-[1.008] transform-[translate3d(0,var(--hero-offset),0)_scale(1.008)] bg-[#121212] mask-[linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0.95)_45%,rgba(0,0,0,0.55)_72%,rgba(0,0,0,0.15)_88%,transparent_100%)] bg-cover bg-position-[center_30%] bg-no-repeat opacity-[calc(1-var(--hero-progress))] will-change-[transform,opacity] [-webkit-mask-image:linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0.95)_45%,rgba(0,0,0,0.55)_72%,rgba(0,0,0,0.15)_88%,transparent_100%)] group-data-[hero-hidden=true]/stage:hidden motion-reduce:transform-none max-[720px]:h-[70svh] max-[720px]:bg-position-[center_24%]"
            style={{ backgroundImage: `url("${featured.background || featured.poster || ""}")` }}
            role="img"
            aria-label={`${featured.name} backdrop`}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[-2] h-svh transform-[translate3d(0,var(--hero-offset),0)] bg-[linear-gradient(90deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.28)_38%,transparent_72%),linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.18)_28%,transparent_60%)] opacity-[calc(1-var(--hero-progress))] will-change-[transform,opacity] group-data-[hero-hidden=true]/stage:hidden motion-reduce:transform-none max-[720px]:h-[73svh]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[-1] h-svh transform-[translate3d(0,var(--hero-offset),0)] bg-[linear-gradient(180deg,transparent_30%,rgba(18,18,18,0.08)_45%,rgba(18,18,18,0.35)_60%,rgba(18,18,18,0.72)_76%,rgba(18,18,18,0.94)_90%,#121212_100%)] opacity-[calc(1-var(--hero-progress))] will-change-[transform,opacity] group-data-[hero-hidden=true]/stage:hidden motion-reduce:transform-none max-[720px]:h-[73svh] max-[720px]:bg-[linear-gradient(180deg,transparent_20%,rgba(18,18,18,0.1)_38%,rgba(18,18,18,0.5)_58%,rgba(18,18,18,0.88)_78%,#121212_100%)]" />

          {/* Date, Title and Genre */}
          <section
            className="absolute top-[39.3svh] left-[3.33%] z-6 w-[min(76vw,1050px)] text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.62),0_1px_3px_rgba(0,0,0,0.5)] max-[1100px]:w-[84vw] max-[720px]:top-[35svh] max-[720px]:left-[5%] max-[720px]:w-[90%]"
            aria-label="Featured title"
          >
            {/* Release Date */}
            <span className="mb-[-0.12em] block font-['Instrument_Serif',Georgia,serif] text-[clamp(23px,2.77vw,53px)] leading-[1.05] font-normal text-[rgba(255,255,255,0.94)] max-[720px]:text-[25px]">
              {getYear(featured.releaseInfo)}
            </span>

            {/* Title */}
            <button
              className="block max-w-full cursor-pointer border-0 bg-transparent p-0 text-left text-inherit"
              type="button"
              onClick={() => setSelectedItem(featured)}
              aria-label={`View streams for ${featured.name}`}
            >
              <h1 className="m-0 font-['Instrument_Serif','Times_New_Roman',serif] text-[clamp(48px,min(7.55vw,9.2vh),145px)] leading-[0.96] font-normal tracking-[-0.045em] text-balance hover:[text-shadow:0_2px_18px_rgba(0,0,0,0.62),0_1px_3px_rgba(0,0,0,0.5),0_3px_30px_rgba(255,255,255,0.16)] max-[720px]:text-[clamp(38px,min(9.2vw,8.4vh),68px)] max-[720px]:tracking-[-0.04em]">
                {featured.name}
              </h1>
            </button>

            {/* Genre */}
            <div className="mt-2 flex flex-wrap items-center gap-[clamp(18px,2.1vw,40px)] font-['Instrument_Serif',Georgia,serif] text-[clamp(15px,1.8vw,35px)] leading-[1.15] font-normal text-[rgba(255,255,255,0.93)] max-[720px]:mt-1.75 max-[720px]:gap-3.25 max-[720px]:text-base">
              <span>
                {featured.genre?.slice(0, 3).join(" | ") ||
                  (featured.type === "series" ? "Series" : "Movie")}
              </span>
              {searchQuery && (
                <span className="font-['Instrument_Sans',sans-serif] text-[11px] tracking-[0.16em] text-[rgba(255,255,255,0.72)]">
                  SEARCH RESULTS
                </span>
              )}
              {activeTab === "watchlist" && (
                <span className="font-['Instrument_Sans',sans-serif] text-[11px] tracking-[0.16em] text-[rgba(255,255,255,0.72)]">
                  YOUR WATCHLIST
                </span>
              )}
            </div>
          </section>

          {/* Movie/Seires tile section  */}
          <section
            className="relative z-5 mx-[3.33%] mt-[65svh] pb-14 max-[720px]:mx-[5%] max-[720px]:mt-[54svh] max-[720px]:pb-12"
            aria-label="Browse titles"
          >
            <div className="relative z-20 grid w-full grid-cols-[repeat(auto-fill,minmax(clamp(108px,10vw,170px),1fr))] gap-x-[clamp(12px,1.5vw,29px)] gap-y-[clamp(16px,2vw,30px)] overflow-x-hidden pt-4 pr-4 pl-4 max-[720px]:grid-cols-[repeat(auto-fill,minmax(104px,1fr))] max-[720px]:gap-3">
              {items.map((item) => {
                const isFeatured = item.id === featured.id;
                const saved = effectiveWatchlistIds.has(item.id);
                return (
                  <article
                    className={`group/card relative aspect-2/3 w-full overflow-hidden rounded-[14px] border border-(--glass-border) bg-[#171717] shadow-[0_10px_28px_rgba(0,0,0,0.32),inset_0_1px_0_var(--glass-highlight)] transition-[border-color,transform,box-shadow] duration-180 ease-out hover:z-4 hover:-translate-y-1 hover:border-[rgba(255,255,255,0.68)] motion-reduce:transition-none motion-reduce:hover:transform-none ${isFeatured ? "border-(--glass-border-strong) shadow-[0_0_0_1px_var(--glass-highlight),0_12px_36px_rgba(0,0,0,0.46),0_0_30px_var(--accent-soft)]" : ""}`}
                    key={item.id}
                    onMouseEnter={() => {
                      if (!isCoarsePointer) setFeaturedId(item.id);
                    }}
                  >
                    <button
                      type="button"
                      className="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-[#181818] p-0 [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-240 [&_img]:ease-out group-hover/card:[&_img]:scale-[1.045] motion-reduce:[&_img]:transition-none"
                      onClick={() => {
                        if (isCoarsePointer) {
                          setFeaturedId(item.id);
                        } else {
                          setSelectedItem(item);
                        }
                      }}
                      onFocus={() => setFeaturedId(item.id)}
                      aria-label={
                        isCoarsePointer
                          ? `Set ${item.name} as featured`
                          : `Open ${item.name} details`
                      }
                    >
                      {/* Posters */}
                      {item.poster ? (
                        <Image
                          src={item.poster}
                          alt={item.name}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 108px, (max-width: 1200px) 14vw, 170px"
                        />
                      ) : (
                        // If poster is not available
                        <span className="grid h-full w-full place-items-center p-2.5 text-center font-['Instrument_Serif',Georgia,serif] text-xl text-[rgba(255,255,255,0.75)]">
                          {item.name}
                        </span>
                      )}
                    </button>
                    <div className="pointer-events-none absolute inset-0 z-3 flex items-center justify-center bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.56))] opacity-0 transition-opacity duration-160 ease-out group-focus-within/card:opacity-100 group-hover/card:opacity-100 motion-reduce:transition-none">
                      <button
                        type="button"
                        className="pointer-events-auto grid h-11.5 w-11.5 cursor-pointer place-items-center rounded-full border border-(--glass-border-strong) bg-[rgba(18,16,24,0.55)] text-white shadow-[0_8px_26px_rgba(0,0,0,0.42),inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturate) transition-[transform,background-color,border-color] duration-160 ease-out [-webkit-backdrop-filter:blur(var(--glass-blur))_saturate(var(--glass-saturate))] hover:scale-[1.08] hover:border-[rgba(255,255,255,0.9)] hover:bg-[rgba(251,44,54,0.72)] active:scale-[0.94] motion-reduce:transition-none max-[720px]:h-10 max-[720px]:w-10"
                        title={`View streams for ${item.name}`}
                        aria-label={`View streams for ${item.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedItem(item);
                        }}
                      >
                        <Play size={18} fill="currentColor" />
                      </button>
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col gap-0.5 rounded-lg border border-(--glass-border) bg-[rgba(10,10,12,0.58)] px-2.5 py-2 shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-[18px] backdrop-saturate-(--glass-saturate) [-webkit-backdrop-filter:blur(18px)_saturate(var(--glass-saturate))] max-[720px]:inset-x-1.5 max-[720px]:bottom-1.5 max-[720px]:px-2 max-[720px]:py-1.5">
                        <strong className="overflow-hidden text-xs leading-[1.2] font-semibold text-ellipsis whitespace-nowrap text-white max-[720px]:text-[11px]">
                          {item.name}
                        </strong>
                        <span className="text-[10px] tracking-[0.08em] text-(--text-subtle)">
                          {getYear(item.releaseInfo) ||
                            (item.type === "series" ? "Series" : "Movie")}
                        </span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 z-4 flex -translate-y-1.25 justify-end gap-1.25 opacity-0 transition-[opacity,transform] duration-160 ease-out group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 group-hover/card:translate-y-0 group-hover/card:opacity-100 motion-reduce:transition-none pointer-coarse:translate-y-0 pointer-coarse:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
                      <button
                        type="button"
                        title={saved ? "Remove from watchlist" : "Add to watchlist"}
                        aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
                        disabled={watchlistBusyId === item.id}
                        onClick={() => void handleToggleWatchlist(item)}
                        className="grid h-7.5 w-7.5 cursor-pointer place-items-center rounded-md border border-(--glass-border) bg-(--glass-bg-strong) text-white shadow-[inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) transition-[background-color,border-color,transform] duration-160 ease-out [-webkit-backdrop-filter:blur(var(--glass-blur))] hover:border-(--glass-border-strong) hover:bg-white/20 active:scale-[0.92] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex min-h-18 items-center justify-center gap-2.5 text-[11px] tracking-widest text-[rgba(255,255,255,0.5)] uppercase"
                role="status"
              >
                <Loader2 className="h-7 w-7 animate-spin text-[rgba(255,255,255,0.7)] motion-reduce:animate-none" />
                <span>Loading more ……</span>
              </div>
            )}
          </section>
        </main>
      )}

      {selectedItem && (
        <StreamSelectorModal
          item={selectedItem}
          inWatchlist={effectiveWatchlistIds.has(selectedItem.id)}
          onToggleWatchlist={handleToggleWatchlist}
          onRequireAuth={() => setShowAuthModal(true)}
          onClose={() => setSelectedItem(null)}
          onPlayStream={handlePlayStream}
        />
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
