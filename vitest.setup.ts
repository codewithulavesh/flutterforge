// jsdom implements neither ResizeObserver nor Element.scrollIntoView, but the
// workspace components (ThoughtLine auto-scroll) rely on them at mount time.

class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    // Fire once so layout-dependent effects initialise, as a real observer
    // would when the element first gets a size.
    const entry = {
      target,
      contentRect: { width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0, toJSON: () => ({}) },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* jsdom has no layout; nothing to scroll */
  };
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {
    /* jsdom has no layout */
  };
}
