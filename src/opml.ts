import type { Feed, Library } from "./types";

export const GENERIC_RSS_LOGO = "urn:blogroll:generic-rss";

export type ExportOptions = {
  languages?: string[];
  includeCategories?: boolean;
};

function normalizeLanguage(value?: string | null): string {
  return value?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

function idFor(url: string): string {
  let hash = 2166136261;
  for (const char of url) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `feed-${(hash >>> 0).toString(36)}`;
}

const countryNames = (() => {
  const names = new Map<string, string>();
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first, second);
      const name = display.of(code);
      if (name && name !== code) names.set(name.toLowerCase(), code);
    }
  } catch { /* Country-name recognition is optional; country attributes still work. */ }
  return names;
})();

function countryFrom(node: Element): string {
  for (const attribute of Array.from(node.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim();
    if (/^(data-)?country(-?code)?$/.test(name) || name.endsWith("-country") || name.endsWith(":country") || name.endsWith(":countrycode")) {
      if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
      const named = countryNames.get(value.toLowerCase());
      if (named) return named;
    }
    if ((name === "xml:lang" || name === "language") && /^[a-z]{2}[-_][a-z]{2}$/i.test(value)) return value.slice(-2).toUpperCase();
  }
  const label = (node.getAttribute("title") || node.getAttribute("text") || "").trim();
  if (/^[A-Z]{2}$/.test(label)) return label;
  return countryNames.get(label.toLowerCase()) ?? "";
}

export function deriveCountry(folder = "", xmlUrl = ""): string {
  const labels = folder.split(/\s*\/\s*/).reverse();
  for (const label of labels) {
    if (/^[A-Z]{2}$/.test(label)) return label;
    const named = countryNames.get(label.toLowerCase());
    if (named) return named;
  }
  try {
    const suffix = new URL(xmlUrl).hostname.split(".").pop() ?? "";
    if (/^[a-z]{2}$/i.test(suffix)) return suffix.toUpperCase();
  } catch { /* An invalid URL simply provides no country hint. */ }
  return "";
}

export function parseOpml(xml: string, existing: Library = { feeds: [] }, now = new Date().toISOString()): Library {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("This file is not valid XML.");
  const body = document.querySelector("opml > body");
  if (!body) throw new Error("This XML file does not contain an OPML body.");
  const known = new Map(existing.feeds.map((feed) => [normalizeUrl(feed.xmlUrl), feed]));
  const imported = new Map<string, Feed>();

  function visit(node: Element, folders: string[], inheritedCountry = "") {
    const xmlUrl = node.getAttribute("xmlUrl")?.trim();
    const label = node.getAttribute("title") || node.getAttribute("text") || "Untitled";
    const derivedCountry = countryFrom(node) || inheritedCountry;
    if (xmlUrl) {
      const canonical = normalizeUrl(xmlUrl);
      const previous = known.get(canonical);
      const categoryAttribute = node.getAttribute("category")?.trim();
      const effectiveFolders = folders.length ? folders : categoryAttribute ? categoryAttribute.split(/\s*\/\s*/).filter(Boolean) : [];
      imported.set(canonical, {
        id: previous?.id ?? idFor(canonical),
        title: label,
        xmlUrl,
        htmlUrl: node.getAttribute("htmlUrl") || undefined,
        description: node.getAttribute("description") ?? previous?.description ?? "",
        language: normalizeLanguage(node.getAttribute("blogroll-language") || node.getAttribute("language") || node.getAttribute("xml:lang") || previous?.language),
        folder: effectiveFolders.join(" / "),
        selected: previous?.selected ?? false,
        country: previous?.country || derivedCountry || deriveCountry(effectiveFolders.join(" / "), xmlUrl),
        comment: previous?.comment ?? node.getAttribute("blogroll-comment") ?? node.getAttribute("data-comment") ?? "",
        reachable: previous?.reachable ?? (node.getAttribute("blogroll-reachable") === "true" ? true : node.getAttribute("blogroll-reachable") === "false" ? false : null),
        checkedAt: previous?.checkedAt ?? node.getAttribute("blogroll-checked-at") ?? undefined,
        checkMessage: previous?.checkMessage,
        logoUrl: previous?.logoUrl ?? node.getAttribute("blogroll-logo-url") ?? GENERIC_RSS_LOGO,
        firstSeenAt: previous?.firstSeenAt ?? now,
        lastSeenAt: now,
        isNew: !previous
      });
    } else {
      const nextFolders = label === "Untitled" ? folders : [...folders, label];
      Array.from(node.children).filter((child) => child.tagName === "outline").forEach((child) => visit(child, nextFolders, derivedCountry));
    }
  }

  Array.from(body.children).filter((node) => node.tagName === "outline").forEach((node) => visit(node, []));
  const missing = existing.feeds.filter((feed) => !imported.has(normalizeUrl(feed.xmlUrl))).map((feed) => ({ ...feed, isNew: false }));
  return { feeds: [...imported.values(), ...missing], lastImportAt: now };
}

export function exportOpml(feeds: Feed[], options: ExportOptions = {}): string {
  const allowedLanguages = options.languages ? new Set(options.languages) : null;
  const selected = feeds.filter((feed) => feed.selected && (!allowedLanguages || allowedLanguages.has(feed.language || "")));
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const groups = new Map<string, Feed[]>();
  selected.forEach((feed) => groups.set(feed.folder, [...(groups.get(feed.folder) ?? []), feed]));
  const line = (feed: Feed, indent: string) => `${indent}<outline type="rss" text="${escape(feed.title)}" title="${escape(feed.title)}" xmlUrl="${escape(feed.xmlUrl)}"${feed.htmlUrl ? ` htmlUrl="${escape(feed.htmlUrl)}"` : ""}${feed.description ? ` description="${escape(feed.description)}"` : ""}${feed.language ? ` language="${escape(feed.language)}" blogroll-language="${escape(feed.language)}"` : ""}${feed.country ? ` blogroll-country="${escape(feed.country)}"` : ""}${feed.comment ? ` blogroll-comment="${escape(feed.comment)}"` : ""}${feed.reachable !== null ? ` blogroll-reachable="${feed.reachable}"` : ""}${feed.checkedAt ? ` blogroll-checked-at="${escape(feed.checkedAt)}"` : ""}${feed.logoUrl ? ` blogroll-logo-url="${escape(feed.logoUrl)}"` : ""} />`;
  const outlines = options.includeCategories === false
    ? selected.map((feed) => line(feed, "    ")).join("\n")
    : [...groups.entries()].flatMap(([folder, items]) => folder ? [`    <outline text="${escape(folder)}" title="${escape(folder)}">`, ...items.map((feed) => line(feed, "      ")), "    </outline>"] : items.map((feed) => line(feed, "    "))).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>Selected feeds</title><dateCreated>${new Date().toUTCString()}</dateCreated></head>\n  <body>\n${outlines}\n  </body>\n</opml>\n`;
}
