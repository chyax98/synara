import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relativeTime";

describe("formatRelativeTime", () => {
  it('returns "刚刚" for timestamps less than 1 minute ago', () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("刚刚");
  });

  it("returns minutes for timestamps under an hour", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5分钟");
  });

  it("returns hours for timestamps under a day", () => {
    const iso = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("3小时");
  });

  it("returns days for timestamps over a day", () => {
    const iso = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("2天");
  });

  it('returns "刚刚" for future timestamps caused by clock skew', () => {
    const iso = new Date(Date.now() + 60_000).toISOString();
    expect(formatRelativeTime(iso)).toBe("刚刚");
  });
});
