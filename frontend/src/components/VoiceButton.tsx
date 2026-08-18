"use client";

interface VoiceButtonProps {
  listening: boolean;
  supported: boolean;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
}

export default function VoiceButton({
  listening,
  supported,
  onClick,
  className = "",
  size = "md",
}: VoiceButtonProps) {
  if (!supported) return null;

  const dim = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={listening ? "停止录音" : "语音输入"}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full transition-all ${
        listening
          ? "bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200"
          : "bg-brand-light text-muted-foreground hover:bg-brand-border hover:text-brand"
      } ${className}`}
    >
      {listening ? (
        <svg
          className={`${icon}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="22" />
        </svg>
      ) : (
        <svg
          className={`${icon}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v.5a7 7 0 0 1-14 0V10" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  );
}
