"use client";

import React from "react";

/**
 * Catches anything the viewfinder throws.
 *
 * A camera screen touches more platform surface than the rest of this app put
 * together — getUserMedia, MediaRecorder, canvas, pointer events, a <video>
 * element driven by a live stream — and any of it can be missing or broken in a
 * given browser. Without a boundary, one throw takes the whole route down and
 * the page renders empty: indistinguishable from a failed deploy or no network.
 *
 * On a throw it tells the page, which falls back to the upload document. The
 * scan still works; only the live preview is lost.
 */
export class CameraBoundary extends React.Component<
  { children: React.ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("camera failed, falling back to upload:", error);
    this.props.onFail();
  }

  render() {
    // Nothing of its own while it hands over: the page re-renders into the
    // document on the next tick, and a flash of a second error state on the way
    // there would be worse than a blank frame.
    if (this.state.failed) return null;
    return this.props.children;
  }
}
