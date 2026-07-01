import { describe, expect, it } from "vitest";

import { parseOpenCodeConfigDocument } from "./openCodeConfigParse.ts";

describe("parseOpenCodeConfigDocument", () => {
  it("parses JSONC with line comments", () => {
    const config = parseOpenCodeConfigDocument(`{
      // upstream proxy
      "provider": {
        "my-proxy": { "models": { "gpt-4o": { "name": "GPT-4o" } } }
      }
    }`);
    expect(config?.provider).toBeTruthy();
  });
});
