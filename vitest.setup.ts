import "@testing-library/jest-dom/vitest";
import ResizeObserver from "resize-observer-polyfill";

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserver as unknown as typeof globalThis.ResizeObserver;
}