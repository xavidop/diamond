import { describe, it, expect, afterEach, vi } from "vitest";
import { isDocumentPipSupported, getDocPip } from "./pip";

afterEach(() => {
  // remove anything we stubbed onto window
  delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
  vi.restoreAllMocks();
});

describe("pip support detection", () => {
  it("is false when the API is absent (jsdom)", () => {
    expect(isDocumentPipSupported()).toBe(false);
    expect(getDocPip()).toBeUndefined();
  });
  it("is true when documentPictureInPicture exists", () => {
    (window as unknown as { documentPictureInPicture: unknown }).documentPictureInPicture = {
      requestWindow: async () => window,
    };
    expect(isDocumentPipSupported()).toBe(true);
    expect(getDocPip()).toBeDefined();
  });
});
