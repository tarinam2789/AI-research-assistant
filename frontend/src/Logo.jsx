import { useId } from "react";

export default function Logo({ size = 40, ring = false }) {
  const id = useId().replace(/:/g, "");
  const fill = `url(#g${id})`;
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Research Lab logo"
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent2)" }} />
        </linearGradient>
      </defs>
      {ring && (
        <polygon className="ring" points="32,1 59,16.5 59,47.5 32,63 5,47.5 5,16.5" />
      )}
      <polygon
        className="hex"
        points="32,6 54,19 54,45 32,58 10,45 10,19"
        fill="none"
        stroke={fill}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        className="brk"
        d="M26 23H21V41H26M38 23H43V41H38"
        fill="none"
        stroke={fill}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path className="spark" d="M32 22L34 30L37 32L34 34L32 42L30 34L27 32L30 30Z" fill={fill} />
      <circle className="node" cx="54" cy="19" r="3.2" fill="var(--accent2)" />
    </svg>
  );
}
