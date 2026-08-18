export type Language = "de" | "en";

export const messages = {
  en: {
    localLibrary: "Local library", importOpml: "Import OPML", checkFeeds: "Check feeds", checking: "being checked", export: "Export", exportOptions: "Export options", exportLanguages: "Languages", exportUnknown: "Unspecified language", exportCategories: "Include categories", exportCategoriesHelp: "Preserve OPML category outlines", exportNow: "Export OPML", cancel: "Cancel", noExportFeeds: "No feeds match these options",
    library: "Library", allFeeds: "All feeds", newImport: "New this import", selected: "Selected", dataLocal: "Your data stays here.", dataLocalDetail: "This library is stored locally on this device.", uiLanguage: "Interface language",
    all: "All", new: "New", allHeading: "All feeds", newHeading: "New discoveries", selectedHeading: "Selected feeds", feeds: "feeds", collapseAll: "Collapse all", expandAll: "Expand all",
    search: "Search feeds, descriptions, or notes", uncategorized: "Uncategorized", accessible: "Accessible", failed: "Error", noMatches: "No matching feeds", noMatchesDetail: "Try another search or library filter.",
    feedDetails: "Feed details", includeExport: "Include in export", remembered: "Selection is remembered", feedAccessible: "Feed is accessible", feedUnavailable: "Feed is not accessible", notChecked: "Not checked yet", check: "Check",
    countryCode: "Country code", optional: "optional", countryExample: "e.g. DE", countryHelp: "ISO 3166-1 two-letter code", feedLanguage: "Feed language", languageExample: "e.g. en", languageHelp: "ISO 639 language code used by export filters", personalComment: "Personal comment", commentPlaceholder: "Why is this feed useful?",
    feedUrl: "Feed URL", folder: "Folder", noFolder: "No folder", firstSeen: "First seen", autoSave: "Changes save automatically", selectFeed: "Select a feed", newTag: "New",
    workspace: "Your local feed workspace", welcomeTitle1: "Turn a crowded feed list", welcomeTitle2: "into a collection you value.", welcomeCopy: "Import an OPML file, annotate the feeds worth keeping, and export a focused collection. Your history stays on this device.", chooseFile: "Choose an OPML file", dropHint: "or drop one anywhere in this window", footer: "Private by design · No account required · Local history", invalidFile: "Could not import this file."
  },
  de: {
    localLibrary: "Lokale Bibliothek", importOpml: "OPML importieren", checkFeeds: "Feeds prüfen", checking: "werden geprüft", export: "Exportieren", exportOptions: "Exportoptionen", exportLanguages: "Sprachen", exportUnknown: "Sprache nicht angegeben", exportCategories: "Kategorien exportieren", exportCategoriesHelp: "OPML-Kategoriegliederung beibehalten", exportNow: "OPML exportieren", cancel: "Abbrechen", noExportFeeds: "Keine Feeds entsprechen diesen Optionen",
    library: "Bibliothek", allFeeds: "Alle Feeds", newImport: "Neu in diesem Import", selected: "Ausgewählt", dataLocal: "Deine Daten bleiben hier.", dataLocalDetail: "Diese Bibliothek wird lokal auf diesem Gerät gespeichert.", uiLanguage: "Sprache der Oberfläche",
    all: "Alle", new: "Neu", allHeading: "Alle Feeds", newHeading: "Neue Entdeckungen", selectedHeading: "Ausgewählte Feeds", feeds: "Feeds", collapseAll: "Alle einklappen", expandAll: "Alle ausklappen",
    search: "Feeds, Beschreibungen oder Notizen durchsuchen", uncategorized: "Ohne Kategorie", accessible: "Abrufbar", failed: "Fehler", noMatches: "Keine passenden Feeds", noMatchesDetail: "Versuche eine andere Suche oder einen anderen Filter.",
    feedDetails: "Feed-Details", includeExport: "In Export aufnehmen", remembered: "Auswahl wird gespeichert", feedAccessible: "Feed ist abrufbar", feedUnavailable: "Feed ist nicht abrufbar", notChecked: "Noch nicht geprüft", check: "Prüfen",
    countryCode: "Ländercode", optional: "optional", countryExample: "z. B. DE", countryHelp: "ISO 3166-1-Code mit zwei Buchstaben", feedLanguage: "Feed-Sprache", languageExample: "z. B. de", languageHelp: "ISO-639-Sprachcode für die Exportfilter", personalComment: "Persönlicher Kommentar", commentPlaceholder: "Warum ist dieser Feed nützlich?",
    feedUrl: "Feed-URL", folder: "Ordner", noFolder: "Kein Ordner", firstSeen: "Erstmals gesehen", autoSave: "Änderungen werden automatisch gespeichert", selectFeed: "Feed auswählen", newTag: "Neu",
    workspace: "Dein lokaler Feed-Arbeitsbereich", welcomeTitle1: "Aus einer vollen Feed-Liste wird", welcomeTitle2: "eine kuratierte Sammlung.", welcomeCopy: "Importiere eine OPML-Datei, ergänze die wichtigen Feeds und exportiere eine fokussierte Sammlung. Deine Historie bleibt auf diesem Gerät.", chooseFile: "OPML-Datei auswählen", dropHint: "oder irgendwo in dieses Fenster ziehen", footer: "Privat konzipiert · Kein Konto erforderlich · Lokale Historie", invalidFile: "Diese Datei konnte nicht importiert werden."
  }
} as const;

export type MessageKey = keyof typeof messages.en;
export const translate = (language: Language, key: MessageKey): string => messages[language][key];
