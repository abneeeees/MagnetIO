import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_25%,rgba(251,44,54,0.12),transparent_47%),radial-gradient(ellipse_at_50%_25%,rgba(99,44,106,0.24),transparent_47%),#121212] px-6 py-16 text-center text-white">
      <p className="font-['Instrument_Sans',sans-serif] text-[11px] font-semibold tracking-[0.18em] text-(--text-subtle) uppercase">
        404
      </p>
      <h1 className="mt-3 font-['Instrument_Serif',Georgia,serif] text-[clamp(42px,6vw,76px)] leading-[0.96] font-normal tracking-[-0.045em] text-white">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-(--text-muted)">
        This page doesn’t exist, or it may have been moved.
      </p>
      <Link
        href="/"
        className="glass-button mt-8 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white"
      >
        Back to home
      </Link>
    </main>
  );
}
