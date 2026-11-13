import XiaobeiStar from "./XiaobeiStar";

type WordmarkProps = {
  className?: string;
  markClassName?: string;
};

export default function Wordmark({
  className = "",
  markClassName = "h-8 w-8",
}: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#166634]">
        <XiaobeiStar className={markClassName} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-[#166634]">
        pathway
        <span className="ml-1 font-medium text-[#1f2937]">知途</span>
      </span>
    </span>
  );
}
