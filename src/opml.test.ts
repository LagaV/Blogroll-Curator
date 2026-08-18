import { describe, expect, it } from "vitest";
import { exportOpml, normalizeUrl, parseOpml } from "./opml";

const input = `<?xml version="1.0"?><opml version="2.0"><body><outline text="Tech"><outline text="Example" type="rss" xmlUrl="HTTPS://Example.com/feed/" htmlUrl="https://example.com"/></outline></body></opml>`;

describe("OPML", () => {
  it("parses nested feeds and normalizes their identity", () => {
    const library = parseOpml(input, { feeds: [] }, "2026-01-01T00:00:00Z");
    expect(library.feeds[0]).toMatchObject({ title: "Example", folder: "Tech", isNew: true });
    expect(normalizeUrl(library.feeds[0].xmlUrl)).toBe("https://example.com/feed");
  });
  it("retains user metadata on re-import", () => {
    const first = parseOpml(input);
    first.feeds[0] = { ...first.feeds[0], selected: true, country: "DE", comment: "Keeper" };
    const second = parseOpml(input, first);
    expect(second.feeds[0]).toMatchObject({ selected: true, country: "DE", comment: "Keeper", isNew: false });
  });
  it("exports only selected feeds", () => {
    const library = parseOpml(input);
    library.feeds[0].selected = true;
    library.feeds[0].country = "DE";
    expect(exportOpml(library.feeds)).toContain('blogroll-country="DE"');
  });
  it("derives country codes from feed and category metadata", () => {
    const categorized = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="Germany"><outline text="Inherited" type="rss" xmlUrl="https://example.de/feed" /></outline>
      <outline text="Direct" type="rss" xmlUrl="https://example.at/feed" countryCode="AT" />
      <outline text="Language" type="rss" xmlUrl="https://example.ch/feed" xml:lang="de-CH" />
    </body></opml>`;
    const feeds = parseOpml(categorized).feeds;
    expect(feeds.map((feed) => [feed.title, feed.country])).toEqual([
      ["Inherited", "DE"], ["Direct", "AT"], ["Language", "CH"]
    ]);
  });
  it("uses category attributes and country-code domains as fallbacks", () => {
    const attributed = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="News" description="Independent local reporting" type="rss" category="Journalism / Local" xmlUrl="https://example.fr/feed" />
    </body></opml>`;
    expect(parseOpml(attributed).feeds[0]).toMatchObject({ folder: "Journalism / Local", country: "FR", description: "Independent local reporting" });
  });
  it("round-trips blogroll metadata", () => {
    const library = parseOpml(input);
    library.feeds[0] = { ...library.feeds[0], comment: "Useful", reachable: true, checkedAt: "2026-08-18T09:00:00Z", logoUrl: "https://example.com/icon.png" };
    const output = exportOpml(library.feeds.map((feed) => ({ ...feed, selected: true })));
    expect(output).toContain('blogroll-comment="Useful"');
    expect(output).toContain('blogroll-reachable="true"');
    expect(output).toContain('blogroll-checked-at="2026-08-18T09:00:00Z"');
    expect(output).toContain('blogroll-logo-url="https://example.com/icon.png"');
  });
  it("filters exports by language and can omit categories", () => {
    const multilingual = parseOpml(`<?xml version="1.0"?><opml version="2.0"><body><outline text="News">
      <outline text="Deutsch" type="rss" xmlUrl="https://example.de/feed" language="de-DE" />
      <outline text="English" type="rss" xmlUrl="https://example.com/feed" blogroll-language="en" />
    </outline></body></opml>`);
    multilingual.feeds = multilingual.feeds.map((feed) => ({ ...feed, selected: true }));
    const output = exportOpml(multilingual.feeds, { languages: ["de"], includeCategories: false });
    expect(output).toContain('title="Deutsch"');
    expect(output).toContain('blogroll-language="de"');
    expect(output).not.toContain('title="English"');
    expect(output).not.toContain('<outline text="News"');
  });
});
