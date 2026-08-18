import type { Library } from "./types";
import { deriveCountry, GENERIC_RSS_LOGO } from "./opml";

const KEY = "feed-curator-library-v1";
export const emptyLibrary: Library = { feeds: [] };

export function loadLibrary(): Library {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null") as Library | null;
    if (!stored) return emptyLibrary;
    return {
      ...stored,
      feeds: stored.feeds.map((feed) => ({
        ...feed,
        folder: feed.folder?.trim() || "",
        description: feed.description || "",
        language: feed.language || "",
        country: feed.country || deriveCountry(feed.folder, feed.xmlUrl),
        reachable: feed.reachable ?? null,
        logoUrl: feed.logoUrl || GENERIC_RSS_LOGO
      }))
    };
  }
  catch { return emptyLibrary; }
}

export function saveLibrary(library: Library) { localStorage.setItem(KEY, JSON.stringify(library)); }
