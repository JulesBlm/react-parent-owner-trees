// The producer toolkit: notation conventions both producers share. These
// pin the preview grammar so neither producer can drift from it again
// (truncation had already diverged 21 vs 24 chars before the module existed).
import { describe, expect, test } from "vitest";
import { describePortalTarget, previewValue } from "../src/lib/core/producer";

describe("previewValue", () => {
  test("named function", () => {
    expect(previewValue(function setQuery() {})).toBe("ƒ setQuery");
  });
  test("anonymous function", () => {
    expect(previewValue(() => {})).toMatch(/^ƒ /);
  });
  test("short string stays whole, quoted", () => {
    expect(previewValue("dark")).toBe('"dark"');
  });
  test("24-char string stays whole", () => {
    const s = "x".repeat(24);
    expect(previewValue(s)).toBe(JSON.stringify(s));
  });
  test("long string truncates to 21 chars + ellipsis", () => {
    expect(previewValue("abcdefghijklmnopqrstuvwxyz")).toBe(
      '"abcdefghijklmnopqrstu…"',
    );
  });
  test("array shows length, not contents", () => {
    expect(previewValue([1, 2, 3])).toBe("Array(3)");
  });
  test("object shows shape only", () => {
    expect(previewValue({ a: 1 })).toBe("{…}");
  });
  test("primitives stringify", () => {
    expect(previewValue(42)).toBe("42");
    expect(previewValue(null)).toBe("null");
    expect(previewValue(undefined)).toBe("undefined");
    expect(previewValue(true)).toBe("true");
  });
});

describe("describePortalTarget", () => {
  test("element with id", () => {
    expect(describePortalTarget({ tagName: "DIV", id: "modal-root" })).toBe(
      "div#modal-root",
    );
  });
  test("element without id", () => {
    expect(describePortalTarget({ tagName: "BODY" })).toBe("body");
  });
  test("non-element falls back to 'node'", () => {
    expect(describePortalTarget(null)).toBe("node");
    expect(describePortalTarget({})).toBe("node");
  });
});
