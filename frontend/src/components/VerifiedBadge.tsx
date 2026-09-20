export default function VerifiedBadge({ size = 16, title = "Verified 认证教练" }: { size?: number; title?: string }) {
  return (
    <span title={title} className="inline-flex shrink-0 items-center text-sky-500" aria-label="Verified">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#0ea5e9" />
        <path d="M7.5 12.3l3 3 6-6.2" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
