"use client";

import React, { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchBar, useEscapeKey } from "@/hooks/KeyBoardControls";
import {
  Bookmark,
  Film,
  History,
  LogOut,
  Magnet,
  Search,
  Tv,
  UserRound,
  X,
} from "lucide-react";
import styles from "@/app/home.module.css";

export type NavTab = "movie" | "series" | "watchlist" | "history";

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSearch: (query: string) => void;
  onOpenDirectStream: () => void;
  onOpenAuth: () => void;
  showMediaNav?: boolean;
}

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

  return (
    <>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.brand}
          onClick={() => {
            setSearchInput("");
            onSearch("");
            onTabChange("movie");
          }}
          aria-label="MagnetIO home"
        >
          <Magnet className={styles.brandMagnet} size={26} strokeWidth={1.8} aria-hidden="true" />
          <span className={styles.brandText}>
            Magnet<span className={styles.brandAccent}>IO</span>
          </span>
        </button>

        <form className={styles.searchForm} onSubmit={handleSubmit} role="search">
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchRef}
            className={styles.searchInput}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Press Ctrl + k, ⌘ + k, or / to search"
            aria-label="Search movies and series"
            type="search"
          />
          {searchInput && (
            <button
              className={styles.clearSearch}
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>

        <div className={styles.topbarActions}>
          <button className={styles.directButton} type="button" onClick={onOpenDirectStream}>
            <Magnet className={styles.directMagnet} size={16} strokeWidth={2} aria-hidden="true" />
            Direct
          </button>

          <div className={styles.accountWrap}>
            <button
              className={styles.accountButton}
              type="button"
              title={user ? "Account menu" : "Sign in"}
              aria-label={user ? "Open account menu" : "Sign in"}
              aria-expanded={user ? userDropdownOpen : undefined}
              onClick={() => (user ? setUserDropdownOpen((open) => !open) : onOpenAuth())}
            >
              {user ? <span>{user.email?.[0]?.toUpperCase() ?? "U"}</span> : <UserRound size={22} />}
            </button>

            {user && userDropdownOpen && (
              <div className={styles.accountMenu}>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange("watchlist");
                    setUserDropdownOpen(false);
                  }}
                >
                  <Bookmark size={15} /> Watchlist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange("history");
                    setUserDropdownOpen(false);
                  }}
                >
                  <History size={15} /> Watch history
                </button>
                <div className={styles.menuDivider} />
                <button
                  className={styles.signOutButton}
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
        <nav className={styles.mediaNav} aria-label="Media type">
          <button
            type="button"
            className={`${styles.mediaNavButton} ${activeTab === "movie" ? styles.mediaNavButtonActive : ""}`}
            onClick={() => onTabChange("movie")}
            data-tooltip="[m]"
            aria-label="Movies"
            aria-pressed={activeTab === "movie"}
          >
            <Film size={19} />
          </button>
          <button
            type="button"
            className={`${styles.mediaNavButton} ${activeTab === "series" ? styles.mediaNavButtonActive : ""}`}
            onClick={() => onTabChange("series")}
            data-tooltip="[s]"
            aria-label="Series"
            aria-pressed={activeTab === "series"}
          >
            <Tv size={19} />
          </button>
          {user && (
            <>
              <button
                type="button"
                className={`${styles.mediaNavButton} ${activeTab === "watchlist" ? styles.mediaNavButtonActive : ""}`}
                onClick={() => onTabChange("watchlist")}
                data-tooltip="[w]"
                aria-label="Watchlist"
                aria-pressed={activeTab === "watchlist"}
              >
                <Bookmark size={19} />
              </button>
              <button
                type="button"
                className={`${styles.mediaNavButton} ${activeTab === "history" ? styles.mediaNavButtonActive : ""}`}
                onClick={() => onTabChange("history")}
                data-tooltip="[h]"
                aria-label="History"
                aria-pressed={activeTab === "history"}
              >
                <History size={19} />
              </button>
            </>
          )}
        </nav>
      )}
    </>
  );
}
