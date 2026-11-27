"use client";

import React, { useState } from "react";
import { TorrentStream } from "@/types";
import { X, Play, Magnet } from "lucide-react";

interface DirectStreamModalProps {
  onClose: () => void;
  onPlayStream: (stream: TorrentStream, title: string) => void;
}

export function DirectStreamModal({ onClose, onPlayStream }: DirectStreamModalProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleStartStream = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) {
      setError("Please enter a magnet link or 40-character infoHash");
      return;
    }

    let infoHash = raw;
    let magnet = raw;

    // Check if it's a magnet link
    if (raw.startsWith("magnet:?")) {
      const match = raw.match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
      if (match) {
        infoHash = match[1];
      }
    } else if (/^[a-fA-F0-9]{40}$/.test(raw)) {
      infoHash = raw;
      magnet = `magnet:?xt=urn:btih:${raw}`;
    }

    onPlayStream(
      {
        title: "Direct Stream",
        infoHash,
        magnet,
      },
      `Direct Stream (${infoHash.slice(0, 8)}...)`,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#05060a]/45 p-4 backdrop-blur-[18px]"
      role="dialog"
      aria-modal="true"
      aria-label="Direct stream"
    >
      <div className="glass-panel relative w-full max-w-lg overflow-hidden rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 bg-white/4 px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Magnet className="h-4 w-4 rotate-45 text-red-500" />
            Direct Stream
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close direct stream dialog"
            className="glass-button rounded-lg p-1.5 text-[#c8cedb] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleStartStream} className="space-y-4 p-6">
          <div>
            <label htmlFor="direct-magnet" className="mb-1.5 block text-xs font-medium text-[#8e97ab]">
              Magnet Link or 40-character InfoHash
            </label>
            <textarea
              id="direct-magnet"
              rows={3}
              autoFocus
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="magnet:?xt=urn:btih:... or 03dd34fea0ff15a451c1723062a901aa3a0ad458"
              className="glass-field w-full rounded-xl p-3 font-mono text-xs text-white placeholder-[#98a1b4]"
            />
          </div>

          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="glass-button rounded-lg px-4 py-2 text-xs font-medium text-[#c8cedb] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-600/85 px-5 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(220,38,38,.14)] transition-colors hover:bg-red-500"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Stream Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
