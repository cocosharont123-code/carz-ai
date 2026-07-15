// The default profile picture: a black car bobbing over an animated neon
// (green / blue / red) background. Used whenever a user has no photo set.

export function DefaultAvatar({
  size = 40,
  className = "",
  rounded = "9999px",
}: {
  size?: number;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`carz-neon-bg relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: rounded }}
      aria-label="Default avatar"
      role="img"
    >
      <svg
        className="carz-car"
        width={size * 0.74}
        viewBox="0 0 64 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* car body (black silhouette) */}
        <path
          d="M3 23 Q3 20.5 5.5 20 L13 18.5 Q17 12.5 25 11.5 L39 11.5 Q47.5 12.5 51.5 18.5 L58 20 Q61 20.7 61 23.2 L61 24.5 Q61 26 59 26 L5 26 Q3 26 3 24.5 Z"
          fill="#080808"
          stroke="#000"
          strokeWidth="0.5"
        />
        {/* windows (subtle sheen so it reads as a car) */}
        <path d="M21 17.5 L26.5 13.3 L37.5 13.3 L43 17.5 Z" fill="#20242b" />
        <path d="M21 17.5 L26.5 13.3 L31 13.3 L26 17.5 Z" fill="#2c333d" opacity="0.7" />

        {/* rear wheel */}
        <circle cx="18" cy="26" r="5.2" fill="#0a0a0a" />
        <g className="carz-wheel" style={{ transformOrigin: "18px 26px" }}>
          <circle cx="18" cy="26" r="5.2" fill="none" stroke="#1b1b1b" strokeWidth="1.4" />
          <circle cx="18" cy="26" r="1.5" fill="#333" />
          <path d="M18 21.2 V30.8 M13.2 26 H22.8 M14.6 22.6 L21.4 29.4 M21.4 22.6 L14.6 29.4" stroke="#2a2a2a" strokeWidth="0.7" />
        </g>

        {/* front wheel */}
        <circle cx="46" cy="26" r="5.2" fill="#0a0a0a" />
        <g className="carz-wheel" style={{ transformOrigin: "46px 26px" }}>
          <circle cx="46" cy="26" r="5.2" fill="none" stroke="#1b1b1b" strokeWidth="1.4" />
          <circle cx="46" cy="26" r="1.5" fill="#333" />
          <path d="M46 21.2 V30.8 M41.2 26 H50.8 M42.6 22.6 L49.4 29.4 M49.4 22.6 L42.6 29.4" stroke="#2a2a2a" strokeWidth="0.7" />
        </g>

        {/* headlight glow */}
        <circle cx="58.5" cy="22.2" r="1" fill="#bfefff" opacity="0.9" />
      </svg>
    </div>
  );
}

// Shows the user's uploaded picture, or the animated default if none.
export function Avatar({
  src,
  size = 40,
  className = "",
  rounded = "9999px",
}: {
  src?: string | null;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Profile"
        width={size}
        height={size}
        className={`object-cover ${className}`}
        style={{ width: size, height: size, borderRadius: rounded }}
      />
    );
  }
  return <DefaultAvatar size={size} className={className} rounded={rounded} />;
}
