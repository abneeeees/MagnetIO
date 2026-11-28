"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchBar, useEscapeKey } from "@/hooks/KeyBoardControls";
import { Bookmark, Film, History, LogOut, Magnet, Search, Tv, UserRound, X } from "lucide-react";

export type NavTab = "movie" | "series" | "watchlist" | "history";

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSearch: (query: string) => void;
  onOpenDirectStream: () => void;
  onOpenAuth: () => void;
  showMediaNav?: boolean;
}

const glassPanel =
  "border border-[var(--glass-border)] bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] backdrop-saturate-[var(--glass-saturate)]";

export function Navbar({
  activeTab,
  onTabChange,
  onSearch,
  onOpenDirectStream,
  onOpenAuth,
  showMediaNav = true,
}: NavbarProps) {
  const { user, signOut } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const accountWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userDropdownOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!accountWrapRef.current?.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [userDropdownOpen]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onTabChange(activeTab === "series" ? "series" : "movie");
    onSearch(searchInput.trim());
  };

  useSearchBar((key) => {
    if (key === "k" || key === "/") searchRef.current?.focus();
  });

  useEscapeKey(() => {
    searchRef.current?.blur();
    setUserDropdownOpen(false);
  });

  const clearSearch = () => {
    setSearchInput("");
    onSearch("");
  };

  const navButtonBase =
    "relative grid h-9.5 w-9 shrink-0 place-items-center rounded-full border border-transparent bg-transparent p-0 text-[var(--text-subtle)] cursor-pointer transition-[color,background-color,border-color,transform] duration-150 ease-out hover:border-[var(--glass-border-strong)] hover:bg-white/14 hover:text-white hover:shadow-[inset_0_1px_0_var(--glass-highlight)] active:scale-[0.94] focus-visible:border-[var(--glass-border-strong)] focus-visible:bg-white/14 focus-visible:text-white after:content-[attr(data-tooltip)] after:absolute after:bottom-[calc(100%+8px)] after:left-1/2 after:-translate-x-1/2 after:translate-y-1 after:rounded-full after:border after:border-[var(--glass-border)] after:bg-[var(--glass-bg-strong)] after:px-1.75 after:py-1 after:text-[10px] after:leading-none after:whitespace-nowrap after:text-white after:opacity-0 after:pointer-events-none after:shadow-[var(--glass-shadow)] after:backdrop-blur-[var(--glass-blur)] after:backdrop-saturate-[var(--glass-saturate)] after:transition-[opacity,transform] after:duration-[140ms] after:ease-out hover:after:opacity-100 hover:after:translate-y-0 focus-visible:after:opacity-100 focus-visible:after:translate-y-0 motion-reduce:after:transition-none motion-reduce:transition-none";
  const navButtonActive =
    "border-[var(--glass-border-strong)] bg-white/14 text-white shadow-[inset_0_1px_0_var(--glass-highlight)] [&_svg]:text-white";

  return (
    <>
      <header className="pointer-events-none absolute top-5.5 right-[3.8%] left-[3.33%] z-50 flex h-11.25 items-center gap-0 before:fixed before:inset-x-0 before:top-0 before:z-[-1] max-[720px]:top-3.5 max-[720px]:right-4 max-[720px]:left-4.5 max-[720px]:grid max-[720px]:h-auto max-[720px]:grid-cols-[minmax(0,1fr)_auto] max-[720px]:items-center max-[720px]:gap-x-0 max-[720px]:gap-y-2.5 max-[720px]:[grid-template-areas:'brand_actions'_'search_search']">
        <button
          type="button"
          className="pointer-events-auto inline-flex w-auto shrink-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-['Instrument_Sans',sans-serif] text-[clamp(17px,1.29vw,25px)] leading-none font-normal tracking-[-0.045em] text-[rgba(255,255,255,0.94)] max-[720px]:mr-0 max-[720px]:gap-1.5 max-[720px]:text-[17px] max-[720px]:[grid-area:brand]"
          onClick={() => {
            setSearchInput("");
            onSearch("");
            onTabChange("movie");
          }}
          aria-label="MagnetIO home"
        >
          <Magnet
            className="h-7 w-7 shrink-0 rotate-45 text-red-500"
            size={26}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span className="font-mono text-lg font-bold tracking-tight text-white sm:inline">
            Magnet<span className="text-red-500">IO</span>
          </span>
        </button>

        <form
          className={`search-form pointer-events-auto relative ml-7.5 flex h-11.25 w-[min(42.92vw,824px)] flex-[0_1_824px] items-center gap-4.25 rounded-full px-5 ring-0 transition-[border-color,background-color,box-shadow] duration-160 ease-out outline-none focus-within:ring-0 focus-within:outline-none motion-reduce:transition-none max-[1100px]:ml-6 max-[1100px]:w-[min(44vw,620px)] max-[720px]:ml-0 max-[720px]:h-10 max-[720px]:w-full max-[720px]:min-w-0 max-[720px]:flex-[initial] max-[720px]:gap-2 max-[720px]:px-2.75 max-[720px]:[grid-area:search] ${glassPanel}`}
          onSubmit={handleSubmit}
          role="search"
        >
          <Search
            className="h-3.75 w-3.75 shrink-0 stroke-[1.45] text-(--text-muted)"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            className="search-input focus-visible: w-full min-w-0 border-0 bg-transparent p-0 font-[inherit] text-[clamp(11px,0.95vw,18px)] font-normal text-white ring-0 outline-none placeholder:text-(--text-subtle) placeholder:opacity-100 focus-visible:ring-0 focus-visible:outline-none max-[720px]:text-xs [&::-webkit-search-cancel-button]:hidden"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Press Ctrl + k, ⌘ + k, or / to search"
            aria-label="Search movies and series"
            type="search"
          />
          {searchInput && (
            <button
              className="grid h-5.5 w-5.5 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-white/14 p-0 text-white transition-[background-color,transform] duration-160 ease-out hover:scale-[1.06] hover:bg-white/24 motion-reduce:transition-none"
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>

        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-4.5 max-[720px]:ml-0 max-[720px]:gap-2 max-[720px]:[grid-area:actions]">
          <button
            className={`inline-flex h-11.25 w-31.75 cursor-pointer items-center justify-center gap-1.75 rounded-full px-4.5 font-[inherit] text-base font-normal text-white/80 transition-[background-color,color,border-color,transform] duration-160 ease-out hover:-translate-y-px hover:border-(--glass-border-strong) hover:bg-[linear-gradient(145deg,var(--glass-highlight),transparent_45%),var(--glass-bg-strong)] hover:text-white active:translate-y-0 motion-reduce:transition-none max-[720px]:h-10 max-[720px]:w-17 max-[720px]:gap-1 max-[720px]:px-1.75 max-[720px]:text-[11px] ${glassPanel}`}
            type="button"
            onClick={onOpenDirectStream}
          >
            <Magnet
              className="h-4 w-4 shrink-0 rotate-18 text-red-500 max-[720px]:h-3.25 max-[720px]:w-3.25"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
            Direct
          </button>

          <div className="relative shrink-0" ref={accountWrapRef}>
            <button
              className="grid h-11.25 w-11.25 cursor-pointer place-items-center overflow-hidden rounded-full border border-(--glass-border-strong) bg-[rgba(244,241,245,0.94)] p-0 font-[inherit] text-[15px] font-bold text-[#28232d] shadow-[0_8px_24px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.6)] transition-[transform,background-color,box-shadow] duration-160 ease-out hover:scale-[1.04] hover:bg-white motion-reduce:transition-none max-[720px]:h-10 max-[720px]:w-10 [&_svg]:h-6.25 [&_svg]:w-6.25 [&_svg]:fill-[#28232d] [&_svg]:stroke-[1.6]"
              type="button"
              title={user ? "Account menu" : "Sign in"}
              aria-label={user ? "Open account menu" : "Sign in"}
              aria-expanded={user ? userDropdownOpen : undefined}
              onClick={() => (user ? setUserDropdownOpen((open) => !open) : onOpenAuth())}
            >
              {user ? (
                <span>{user.email?.[0]?.toUpperCase() ?? "U"}</span>
              ) : (
                <UserRound size={22} strokeWidth={1.8} />
              )}
            </button>

            {user && userDropdownOpen && (
              <div className="absolute top-[calc(100%+12px)] right-0 flex w-47.5 flex-col gap-0.5 rounded-[14px] border border-(--glass-border) bg-[linear-gradient(145deg,var(--glass-highlight),transparent_10%),var(--glass-bg-strong)] p-1.75 shadow-[0_24px_60px_rgba(0,0,0,0.48),inset_0_1px_0_var(--glass-highlight)] backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturate)">
                <button
                  type="button"
                  className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left font-[inherit] text-xs text-white/80 hover:bg-white/8 hover:text-white"
                  onClick={() => {
                    onTabChange("watchlist");
                    setUserDropdownOpen(false);
                  }}
                >
                  <Bookmark size={15} /> Watchlist
                </button>
                <button
                  type="button"
                  className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left font-[inherit] text-xs text-white/80 hover:bg-white/8 hover:text-white"
                  onClick={() => {
                    onTabChange("history");
                    setUserDropdownOpen(false);
                  }}
                >
                  <History size={15} /> Watch history
                </button>
                <div className="mx-0.5 my-1 h-px bg-white/10" />
                <button
                  className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left font-[inherit] text-xs text-[#ff7b83] hover:bg-white/8 hover:text-[#ff7b83]"
                  type="button"
                  onClick={() => {
                    void signOut();
                    setUserDropdownOpen(false);
                  }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showMediaNav && (
        <nav
          className={`fixed bottom-[calc(3vh+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex h-11.5 w-max min-w-21.5 -translate-x-1/2 items-center justify-center gap-0.75 rounded-full p-0.75 max-[720px]:bottom-[calc(18px+env(safe-area-inset-bottom,0px))] ${glassPanel}`}
          aria-label="Media type"
        >
          <button
            type="button"
            className={`${navButtonBase} ${activeTab === "movie" ? navButtonActive : ""}`}
            onClick={() => onTabChange("movie")}
            data-tooltip="[M]"
            aria-label="Movies"
            aria-pressed={activeTab === "movie"}
          >
            <Film size={18} />
          </button>
          <button
            type="button"
            className={`${navButtonBase} ${activeTab === "series" ? navButtonActive : ""}`}
            onClick={() => onTabChange("series")}
            data-tooltip="[S]"
            aria-label="Series"
            aria-pressed={activeTab === "series"}
          >
            <Tv size={18} />
          </button>
          {user && (
            <>
              <button
                type="button"
                className={`${navButtonBase} ${activeTab === "watchlist" ? navButtonActive : ""}`}
                onClick={() => onTabChange("watchlist")}
                data-tooltip="[W]"
                aria-label="Watchlist"
                aria-pressed={activeTab === "watchlist"}
              >
                <Bookmark size={18} />
              </button>
              <button
                type="button"
                className={`${navButtonBase} ${activeTab === "history" ? navButtonActive : ""}`}
                onClick={() => onTabChange("history")}
                data-tooltip="[H]"
                aria-label="History"
                aria-pressed={activeTab === "history"}
              >
                <History size={18} />
              </button>
            </>
          )}
        </nav>
      )}
    </>
  );
}
