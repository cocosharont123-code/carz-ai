"use client";

import React from "react";

/**
 * Liquid glass: a backdrop that refracts rather than only blurring.
 *
 * The trick worth having here is GlassFilter. Blur alone reads as frosted
 * plastic; real glass bends what is behind it. feTurbulence builds a static
 * noise field, feDisplacementMap pushes the backdrop around using it, and
 * feSpecularLighting adds the highlight a curved edge would catch. Applied to a
 * layer that already carries backdrop-filter, the displacement acts on the
 * blurred backdrop — which is what makes it look like a lens instead of a pane.
 *
 * The filter is global by id, so exactly one GlassFilter belongs in the tree.
 * The app mounts it in the nav, which is on every page.
 */

interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
}

interface DockIcon {
  src: string;
  alt: string;
  onClick?: () => void;
}

const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
}) => {
  const glassStyle = {
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const content = (
    <div
      className={`relative flex font-semibold overflow-hidden text-black cursor-pointer transition-all duration-700 ${className}`}
      style={glassStyle}
    >
      {/* Glass layers, back to front: the refracted backdrop, a milky tint to
          give it body, then the inner bevel that reads as thickness. */}
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded-3xl"
        style={{
          backdropFilter: "blur(3px)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
        }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{ background: "rgba(255, 255, 255, 0.25)" }}
      />
      <div
        className="absolute inset-0 z-20 rounded-3xl overflow-hidden"
        style={{
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
        }}
      />

      <div className="relative z-30">{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
};

const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({ icons, href }) => (
  <GlassEffect href={href} className="rounded-3xl p-3 hover:p-4">
    <div className="flex items-center justify-center gap-2 rounded-3xl p-3 py-0 px-0.5 overflow-hidden">
      {icons.map((icon, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          className="w-16 h-16 transition-all duration-700 hover:scale-110 cursor-pointer"
          style={{
            transformOrigin: "center center",
            transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
          }}
          onClick={icon.onClick}
        />
      ))}
    </div>
  </GlassEffect>
);

const GlassButton: React.FC<{ children: React.ReactNode; href?: string }> = ({
  children,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl px-10 py-6 hover:px-11 hover:py-7 overflow-hidden"
  >
    <div
      className="transition-all duration-700 hover:scale-95"
      style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)" }}
    >
      {children}
    </div>
  </GlassEffect>
);

/**
 * The filter itself. Renders nothing visible — it only defines `#glass-distortion`
 * for anything that wants to reference it.
 *
 * `scale` is the whole character of the effect: it is how many pixels the
 * backdrop is pushed around. The reference value of 200 is a full-screen
 * showpiece; on a control the size of a tab bar it turns the background to
 * soup, so the app mounts this with a far smaller one.
 */
const GlassFilter: React.FC<{ scale?: number }> = ({ scale = 200 }) => (
  <svg style={{ display: "none" }} aria-hidden>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale={scale}
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);

export { GlassEffect, GlassDock, GlassButton, GlassFilter };
export type { GlassEffectProps, DockIcon };
