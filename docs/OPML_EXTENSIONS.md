# Blogroll OPML extensions / OPML-Erweiterungen

Blogroll Curator preserves standard OPML fields and adds optional attributes to RSS/Atom `outline` elements. Unknown attributes should be ignored by other OPML processors as required by OPML's extensible model.

Blogroll Curator erhält OPML-Standardfelder und ergänzt optionale Attribute an RSS-/Atom-`outline`-Elementen. Andere OPML-Anwendungen sollten unbekannte Attribute entsprechend dem erweiterbaren OPML-Modell ignorieren.

| Attribute | Meaning / Bedeutung |
|---|---|
| `blogroll-country` | ISO 3166-1 alpha-2 country code / Ländercode |
| `blogroll-language` | ISO 639 language code used for export filtering / Sprachcode für Exportfilter |
| `blogroll-comment` | Private user comment / Persönlicher Kommentar |
| `blogroll-reachable` | Last availability result (`true` or `false`) / Letztes Prüfergebnis |
| `blogroll-checked-at` | ISO-8601 timestamp of the last check / Zeitpunkt der letzten Prüfung |
| `blogroll-logo-url` | Discovered logo URL or `urn:blogroll:generic-rss` / Erkannte Logo-URL oder generischer Platzhalter |

Example / Beispiel:

```xml
<outline
  type="rss"
  text="Example"
  title="Example"
  xmlUrl="https://example.com/feed.xml"
  htmlUrl="https://example.com/"
  description="Independent reporting"
  blogroll-country="DE"
  blogroll-comment="Read weekly"
  blogroll-reachable="true"
  blogroll-checked-at="2026-08-18T09:00:00.000Z"
  blogroll-logo-url="https://example.com/icon.png" />
```
