type XiaobeiStarProps = {
  className?: string;
};

/** 小北 — cream star from the Pathway 知途 brand board. */
export default function XiaobeiStar({ className = "h-16 w-16" }: XiaobeiStarProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M60 8 L73.5 40.5 L108 44 L82 66.5 L90.5 102 L60 84.5 L29.5 102 L38 66.5 L12 44 L46.5 40.5 Z"
        fill="#faf6f3"
        stroke="#1f2937"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="54" r="3.1" fill="#1f2937" />
      <circle cx="70" cy="54" r="3.1" fill="#1f2937" />
      <path
        d="M50 66 Q60 74 70 66"
        fill="none"
        stroke="#1f2937"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="40" cy="64" r="4" fill="#f3b7a8" opacity="0.85" />
      <circle cx="80" cy="64" r="4" fill="#f3b7a8" opacity="0.85" />
    </svg>
  );
}
