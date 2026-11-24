"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchBar, useEscapeKey } from "@/hooks/KeyBoardControls";
import {
  Film,
  Tv,
  Play,
  Search,
  Magnet,
  X,
  Bookmark,
  History,
  User as UserIcon,
  LogOut,
} from "lucide-react";

export type NavTab = "movie" | "series" | "watchlist" | "history";

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSearch: (query: string) => void;
  onOpenDirectStream: () => void;
  onOpenAuth: () => void;
}

export function Navbar({
  activeTab,
  onTabChange,
  onSearch,
  onOpenDirectStream,
  onOpenAuth,
}: NavbarProps) {
  const { user, signOut } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const searchRef = useRef<HTMLInputElement>(null);

  useSearchBar((key) => {
    switch (key) {
      case "k":
        searchRef.current?.focus();
        break;
      case "/":
        searchRef.current?.focus();
        break;
    }
  });

  useEscapeKey(() => {
    searchRef.current?.blur();
  });

  const handleClear = () => {
    setSearchInput("");
    onSearch("");
  };

  const SearchSkeleton = () => (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex gap-3">
          <div className="h-20 w-14 rounded-md bg-[#252a38]" />

          <div className="flex-1 space-y-2 py-2">
            <div className="h-3 w-3/4 rounded bg-[#252a38]" />
            <div className="h-3 w-1/2 rounded bg-[#252a38]" />
            <div className="h-3 w-1/4 rounded bg-[#252a38]" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0b0c10]/45 shadow-[0_10px_40px_rgba(0,0,0,.12)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 items-center gap-4 px-4 sm:px-5">
          {/* Brand Logo */}
          <div
            onClick={() => onTabChange("movie")}
            className="flex shrink-0 cursor-pointer items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-red-400 shadow-[0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-xl">
              <Magnet className="h-5 w-5 rotate-45 fill-current" />
            </div>
            <span className="hidden font-mono text-lg font-bold tracking-tight text-white sm:inline">
              Magnet<span className="text-red-500">IO</span>
            </span>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
            <div className="relative">
              <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#656d81]" />
              <input
                ref={searchRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Press Ctrl + K, ⌘ + K, or / to search"
                className="h-10 w-full rounded-xl border border-white/8 bg-white/5 pr-9 pl-10 text-xs text-[#e6e8ec] placeholder-[#7e879b] shadow-inner shadow-black/10 backdrop-blur-xl transition-colors focus:border-red-500/35 focus:bg-white/7 focus:ring-1 focus:ring-red-500/15 focus:outline-none"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[#656d81] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div></div>
              )}
            </div>
          </form>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onOpenDirectStream}
              title="Direct magnet"
              className="flex h-10 items-center gap-1.5 rounded-xl border border-white/8 bg-white/5 px-3 text-xs font-medium text-[#c4cad7] backdrop-blur-xl transition-colors hover:border-white/15 hover:bg-white/8 hover:text-white"
            >
              <Magnet className="h-4 w-4 fill-current text-red-500" />
              <span className="hidden lg:inline">Direct</span>
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  title="Account"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-red-400 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/8"
                >
                  {user.email?.[0].toUpperCase() || "U"}
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-white/15 bg-[#171c2b]/25 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xs backdrop-saturate-150">
                    <button
                      onClick={() => {
                        onTabChange("watchlist");
                        setUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#c4cad7] hover:bg-[#191e2c]/70 hover:text-white"
                    >
                      <Bookmark className="h-3.5 w-3.5" /> Watchlist
                    </button>
                    <button
                      onClick={() => {
                        onTabChange("history");
                        setUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#c4cad7] hover:bg-[#191e2c]/70 hover:text-white"
                    >
                      <History className="h-3.5 w-3.5" /> History
                    </button>
                    <div className="my-1 border-t border-[#1b202e]" />
                    <button
                      onClick={() => {
                        signOut();
                        setUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                title="Sign in"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_8px_24px_rgba(220,38,38,.18)] transition-colors hover:bg-red-500 active:scale-95"
              >
                <UserIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <nav aria-label="Media tabs" className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-[#10131c]/55 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-2xl">
          {(
            [
              ["movie", "Movies", Film, "M"],
              ["series", "Series", Tv, "S"],
              ["watchlist", "Watchlist", Bookmark, "W"],
              ["history", "History", History, "H"],
            ] as const
          )
            .filter((tab) => (tab[0] !== "watchlist" && tab[0] !== "history") || !!user)
            .map(([tab, label, Icon, key]) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                title={`${label} (${key})`}
                className={`group relative flex h-12 w-12 items-center justify-center gap-1.5 rounded-xl transition-all duration-200 sm:h-11 sm:w-14 ${
                  activeTab === tab
                    ? "border border-white/8 bg-white/12 text-white shadow-[0_6px_18px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.08)]"
                    : "border border-transparent text-[#8d96aa] hover:border-white/6 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${activeTab === tab ? "text-red-400" : ""}`} />
                <span className="pointer-events-none absolute bottom-[calc(100%+8px)] rounded-md border border-[#262d40] bg-[#151925] px-2 py-1 text-[10px] whitespace-nowrap text-[#d7dae3] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {key}
                </span>
              </button>
            ))}
        </div>
      </nav>
    </>
  );
}
