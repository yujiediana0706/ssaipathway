"use client";

/** Coach（原 Mentor）专属皇冠徽标：金色皇冠 + "Coach" 标签 */
export default function CoachBadge({ size = 15 }: { size?: number }) {
  return (
    <span
      title="Coach：已通过职业资格审核与 1v1 面试认证"
      className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold leading-none text-amber-700"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#d97706" stroke="#b45309" strokeWidth="1">
        <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8z" />
      </svg>
      Coach
    </span>
  );
}
