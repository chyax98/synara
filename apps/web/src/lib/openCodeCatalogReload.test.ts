import { describe, expect, it, vi } from "vitest";

import {
  maybeRefreshOpenCodeCatalog,
  maybeReloadOpenCodeCatalogAfterMutation,
} from "./openCodeCatalogReload";
import * as openCodeCatalogReactQuery from "./openCodeCatalogReactQuery";

describe("openCodeCatalogReload", () => {
  it("skips catalog invalidation when autoReload is false", async () => {
    const invalidate = vi
      .spyOn(openCodeCatalogReactQuery, "reloadOpenCodeCatalogAfterMutation")
      .mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);

    await maybeReloadOpenCodeCatalogAfterMutation({} as never, false);
    await maybeRefreshOpenCodeCatalog(false, refresh);

    expect(invalidate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    invalidate.mockRestore();
  });

  it("runs catalog invalidation when autoReload is true", async () => {
    const invalidate = vi
      .spyOn(openCodeCatalogReactQuery, "reloadOpenCodeCatalogAfterMutation")
      .mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);

    await maybeReloadOpenCodeCatalogAfterMutation({} as never, true);
    await maybeRefreshOpenCodeCatalog(true, refresh);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    invalidate.mockRestore();
  });
});
