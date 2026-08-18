# Blogroll Curator

[Deutsch](#deutsch) · [English](#english)

## Deutsch

Blogroll Curator ist eine lokale Desktop-App zum Prüfen, Annotieren und Kuratieren von RSS-/Atom-Feedlisten. Sie importiert OPML, merkt sich bereits bekannte Feeds und exportiert nur die ausgewählte Sammlung. Es gibt kein Benutzerkonto und keinen zentralen Datenspeicher.

### Funktionen

- OPML-Import per Dateiauswahl oder Drag-and-drop
- Kategorien mit Ein-/Ausklappen
- Persistente Auswahl-, Kommentar- und Länderinformationen
- Prüfung der Feed-Erreichbarkeit
- Erkennung von RSS-/Atom-Logos und Website-Icons
- OPML-Export ausgewählter Feeds mit dokumentierten `blogroll-*`-Attributen
- Exportfilter nach Feed-Sprache und optionaler Export ohne Kategorien
- Deutsche und englische Oberfläche
- Lokale Datenspeicherung

### Entwicklung

Voraussetzungen: Node.js 20+, Rust stable und die [Tauri-Systemabhängigkeiten](https://v2.tauri.app/start/prerequisites/) für das jeweilige Betriebssystem.

```bash
npm install
npm run dev
npm test
npm run tauri dev
npm run tauri build
```

Frontend-Tests:

```bash
npm test
```

Native Tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Die OPML-Erweiterungen sind in [`docs/OPML_EXTENSIONS.md`](docs/OPML_EXTENSIONS.md) beschrieben.

### Datenschutz

Bibliothek, Historie und Metadaten verbleiben lokal. Netzwerkzugriffe erfolgen nur bei einer vom Nutzer ausgelösten Feed-Prüfung und richten sich direkt an den Feed beziehungsweise die zugehörige Website.

### Lizenz

Blogroll Curator wird unter der [MIT-Lizenz](LICENSE) veröffentlicht.

## English

Blogroll Curator is a local desktop application for checking, annotating, and curating RSS/Atom feed lists. It imports OPML, remembers previously seen feeds, and exports only the selected collection. It requires no account and uses no centralized data storage.

### Features

- OPML import via file picker or drag and drop
- Collapsible categories
- Persistent selection, comments, and country metadata
- Feed availability checks
- RSS/Atom logo and website-icon discovery
- Selected-feed OPML export with documented `blogroll-*` attributes
- Export filtering by feed language and optional export without categories
- German and English interface
- Local data storage

### Development

Requirements: Node.js 20+, stable Rust, and the platform-specific [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run dev
npm test
npm run tauri dev
npm run tauri build
```

Frontend tests:

```bash
npm test
```

Native tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

The OPML extensions are documented in [`docs/OPML_EXTENSIONS.md`](docs/OPML_EXTENSIONS.md).

### Privacy

The library, history, and metadata remain local. Network requests occur only when the user initiates a feed check and go directly to the feed or its associated website.

### License

Blogroll Curator is released under the [MIT License](LICENSE).
