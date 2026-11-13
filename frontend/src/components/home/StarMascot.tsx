/**
 * 小北 — the white star mascot.
 * Pure SVG, no client JS. Each pose pairs a different action with a facial
 * expression so the mascot feels alive across the page.
 */

export type StarPose = "wave" | "backpack" | "flag" | "sit" | "think" | "point";

const INK = "#22312A";
const BLUSH = "#F4A9C4";
const STAR_POINTS =
  "80,30 94.7,61.8 129.5,65.9 103.8,89.7 110.6,124.1 80,107 49.4,124.1 56.2,89.7 30.5,65.9 65.3,61.8";

const stroke = {
  fill: "none",
  stroke: INK,
  strokeWidth: 4.5,
  strokeLinecap: "round",
} as const;

function Face({ kind }: { kind: "happy" | "smile" | "calm" }) {
  return (
    <g>
      {kind === "happy" ? (
        <>
          <path d="M61 79q6-8 12 0" {...stroke} strokeWidth={3.4} />
          <path d="M87 79q6-8 12 0" {...stroke} strokeWidth={3.4} />
          <path d="M70 88q10 12 20 0-10 4-20 0z" fill={INK} />
        </>
      ) : (
        <>
          <circle cx={66} cy={77} r={3.6} fill={INK} />
          <circle cx={94} cy={77} r={3.6} fill={INK} />
          {kind === "smile" ? (
            <path d="M72 89q8 8 16 0" {...stroke} strokeWidth={3.4} />
          ) : (
            <path d="M75 91q5 4 10 0" {...stroke} strokeWidth={3.2} />
          )}
        </>
      )}
      <ellipse cx={57} cy={89} rx={5.5} ry={3.2} fill={BLUSH} opacity={0.75} />
      <ellipse cx={103} cy={89} rx={5.5} ry={3.2} fill={BLUSH} opacity={0.75} />
    </g>
  );
}

function Feet() {
  return (
    <>
      <path d="M62 121l-3 12" {...stroke} />
      <path d="M98 121l3 12" {...stroke} />
    </>
  );
}

/** Small four-point twinkle used as decoration around the mascots. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2c.7 4.8 2.2 6.3 7 7-4.8.7-6.3 2.2-7 7-.7-4.8-2.2-6.3-7-7 4.8-.7 6.3-2.2 7-7z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function StarMascot({
  pose = "wave",
  className,
}: {
  pose?: StarPose;
  className?: string;
}) {
  const face =
    pose === "wave" || pose === "flag"
      ? "happy"
      : pose === "think"
        ? "calm"
        : "smile";

  return (
    <svg
      viewBox="0 0 160 160"
      className={`h-auto ${className ?? ""}`}
      role="img"
      aria-hidden="true"
    >
      {/* Props drawn behind the star body */}
      {pose === "backpack" && (
        <g>
          <rect
            x={14}
            y={64}
            width={27}
            height={35}
            rx={9}
            fill="#BFDCC2"
            stroke={INK}
            strokeWidth={3.5}
          />
          <rect
            x={20}
            y={79}
            width={15}
            height={13}
            rx={4.5}
            fill="#A6CAA9"
            stroke={INK}
            strokeWidth={3}
          />
          <circle cx={27.5} cy={71} r={2.4} fill={INK} />
        </g>
      )}

      <g transform={pose === "sit" ? "translate(0,-6)" : undefined}>
        <polygon
          points={STAR_POINTS}
          fill="#FFFFFF"
          stroke={INK}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <Face kind={face} />
      </g>

      {/* Arms, legs and props in front */}
      {pose === "wave" && (
        <g>
          <path d="M38 72q-12 4-15 16" {...stroke} />
          <path d="M121 68q13-6 17-21" {...stroke} />
          <path d="M145 34q4-3 6-8" {...stroke} strokeWidth={3} />
          <path d="M153 45q5-1 9-5" {...stroke} strokeWidth={3} />
          <Feet />
        </g>
      )}

      {pose === "backpack" && (
        <g>
          <path d="M121 70q13 2 18 12" {...stroke} />
          <path d="M52 60q-8 20 2 38" {...stroke} strokeWidth={4} />
          <path d="M62 120l-10 14" {...stroke} />
          <path d="M98 120l12 11" {...stroke} />
        </g>
      )}

      {pose === "flag" && (
        <g>
          <path d="M38 72q-11 5-13 15" {...stroke} />
          <path d="M121 68q12-4 15-12" {...stroke} />
          <path d="M136 60V16" {...stroke} />
          <path
            d="M136 18l31 9.5-31 9.5z"
            fill="#3E5C4B"
            stroke={INK}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Feet />
        </g>
      )}

      {pose === "sit" && (
        <g>
          <path d="M40 68q8 16 24 22" {...stroke} />
          <path d="M120 68q-8 16-24 22" {...stroke} />
          <rect
            x={58}
            y={96}
            width={44}
            height={31}
            rx={5}
            fill="#FFFFFF"
            stroke={INK}
            strokeWidth={3.5}
          />
          <path
            d="M80 104c.5 3.4 1.6 4.5 5 5-3.4.5-4.5 1.6-5 5-.5-3.4-1.6-4.5-5-5 3.4-.5 4.5-1.6 5-5z"
            fill="#3E5C4B"
          />
          <rect x={50} y={127} width={60} height={7} rx={3.5} fill={INK} />
        </g>
      )}

      {pose === "think" && (
        <g>
          <path d="M40 74q-10 6-12 14" {...stroke} />
          <path d="M120 74q-2 18-22 24" {...stroke} />
          <circle
            cx={95}
            cy={99}
            r={4.5}
            fill="#FFFFFF"
            stroke={INK}
            strokeWidth={3}
          />
          <circle cx={126} cy={44} r={2.6} fill="#FFFFFF" stroke={INK} strokeWidth={2.4} />
          <circle cx={136} cy={31} r={3.4} fill="#FFFFFF" stroke={INK} strokeWidth={2.4} />
          <circle cx={148} cy={15} r={4.4} fill="#FFFFFF" stroke={INK} strokeWidth={2.4} />
          <Feet />
        </g>
      )}

      {pose === "point" && (
        <g>
          <path d="M38 72q-12 3-13 14" {...stroke} />
          <path d="M121 68l22-13" {...stroke} />
          <circle
            cx={147}
            cy={53}
            r={4.5}
            fill="#FFFFFF"
            stroke={INK}
            strokeWidth={3}
          />
          <Feet />
        </g>
      )}
    </svg>
  );
}
