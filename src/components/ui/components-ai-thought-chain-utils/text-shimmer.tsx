'use client';

/**
 * ShimmerText — animated gradient sweep across the text.
 *
 * Dependency helper for `components-ai-thought-chain.tsx` (shimmer label of the
 * active step). Colors adapt to the app theme: the workspace sets both the
 * `dark` class and `data-theme="dark"` on <html>, which Tailwind's darkMode
 * selector also honours, so plain CSS overrides below stay in sync.
 */

import React from 'react';

const STYLE = `
@keyframes ff-shimmer-sweep { to { background-position: -200% center; } }

.ff-shimmer-text {
  --ff-shimmer-base: #111827;
  --ff-shimmer-highlight: #9ca3af;
  background: linear-gradient(
    90deg,
    var(--ff-shimmer-base) 35%,
    var(--ff-shimmer-highlight) 50%,
    var(--ff-shimmer-base) 65%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: ff-shimmer-sweep 2s linear infinite;
}

.dark .ff-shimmer-text,
[data-theme="dark"] .ff-shimmer-text {
  --ff-shimmer-base: #f9fafb;
  --ff-shimmer-highlight: #6b7280;
}

@media (prefers-reduced-motion: reduce) {
  .ff-shimmer-text {
    animation: none;
    background: none;
    color: var(--ff-shimmer-base);
    -webkit-text-fill-color: currentColor;
  }
}
`;

export function ShimmerText({ text }: { text: string }) {
  return (
    <React.Fragment>
      <style>{STYLE}</style>
      <span className="ff-shimmer-text">{text}</span>
    </React.Fragment>
  );
}

export default ShimmerText;
