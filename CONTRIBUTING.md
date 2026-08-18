# Beitragen / Contributing

## Deutsch

Danke für dein Interesse an Blogroll Curator.

1. Erstelle einen eigenen Branch.
2. Halte Änderungen klein und thematisch fokussiert.
3. Ergänze Tests für Parser-, Export- oder native Metadatenänderungen.
4. Führe `npm test`, `npm run build` und `cargo test --manifest-path src-tauri/Cargo.toml` aus.
5. Beschreibe im Pull Request Verhalten, Motivation und manuelle Prüfung.

Neue UI-Texte müssen gleichzeitig auf Deutsch und Englisch in `src/i18n.ts` ergänzt werden. Eigene OPML-Attribute beginnen mit `blogroll-` und müssen dokumentiert werden.

## English

Thank you for your interest in Blogroll Curator.

1. Create a dedicated branch.
2. Keep changes small and focused.
3. Add tests for parser, export, or native metadata changes.
4. Run `npm test`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml`.
5. Describe the behavior, motivation, and manual verification in the pull request.

New UI copy must be added in both German and English in `src/i18n.ts`. Custom OPML attributes must start with `blogroll-` and be documented.
