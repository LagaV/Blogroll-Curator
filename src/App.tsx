import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Download, FileUp, Folder, Inbox, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { exportOpml, GENERIC_RSS_LOGO, parseOpml } from "./opml";
import { loadLibrary, saveLibrary } from "./storage";
import type { Feed, Library } from "./types";
import { translate, type Language } from "./i18n";
import packageInfo from "../package.json";
import { greaderPlan, mergeGReader, type GReaderSubscription } from "./greader";

type Filter = "all" | "new" | "selected";
type FeedCheckResult = { reachable: boolean; status?: number; message: string; logoUrl: string; language?: string };
const LEGACY_PREFERENCE_PREFIX = ["block", "roll"].join("");
const preference = (name: string) => localStorage.getItem(`blogroll-${name}`) ?? localStorage.getItem(`${LEGACY_PREFERENCE_PREFIX}-${name}`);
function safeRemoteUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function logoSrc(value?: string): string {
  return value === GENERIC_RSS_LOGO ? "/rss-logo.svg" : safeRemoteUrl(value) || "/rss-logo.svg";
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => (preference("language") as Language) || (navigator.language.toLowerCase().startsWith("de") ? "de" : "en"));
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [library, setLibrary] = useState<Library>(() => loadLibrary());
  const [activeId, setActiveId] = useState<string | null>(() => loadLibrary().feeds[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [checking, setChecking] = useState<Set<string>>(() => new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [greader, setGreader] = useState<{ baseUrl: string; username: string; password: string } | null>(null);
  const [includeCategories, setIncludeCategories] = useState(() => preference("export-categories") !== "false");
  const [excludedExportLanguages, setExcludedExportLanguages] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(preference("export-excluded-languages") || "[]")); }
    catch { return new Set(); }
  });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => saveLibrary(library), [library]);
  useEffect(() => localStorage.setItem("blogroll-language", language), [language]);
  useEffect(() => localStorage.setItem("blogroll-export-categories", String(includeCategories)), [includeCategories]);
  useEffect(() => localStorage.setItem("blogroll-export-excluded-languages", JSON.stringify([...excludedExportLanguages])), [excludedExportLanguages]);

  const selectedCount = library.feeds.filter((feed) => feed.selected).length;
  const exportLanguages = useMemo(() => [...new Set(library.feeds.filter((feed) => feed.selected).map((feed) => feed.language || ""))].sort(), [library.feeds]);
  const includedExportLanguages = exportLanguages.filter((value) => !excludedExportLanguages.has(value));
  const exportCount = library.feeds.filter((feed) => feed.selected && includedExportLanguages.includes(feed.language || "")).length;
  const newCount = library.feeds.filter((feed) => feed.isNew).length;
  const visible = useMemo(() => library.feeds.filter((feed) => {
    if (filter === "new" && !feed.isNew) return false;
    if (filter === "selected" && !feed.selected) return false;
    const haystack = `${feed.title} ${feed.xmlUrl} ${feed.folder} ${feed.country} ${feed.comment}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [library.feeds, filter, query]);
  const active = library.feeds.find((feed) => feed.id === activeId);
  const groups = useMemo(() => {
    const result = new Map<string, Feed[]>();
    visible.forEach((feed) => {
      const category = feed.folder || t("uncategorized");
      result.set(category, [...(result.get(category) ?? []), feed]);
    });
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible, language]);

  function toggleCategory(category: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const next = parseOpml(await file.text(), library);
      next.importName = file.name;
      setLibrary(next);
      setActiveId(next.feeds.find((feed) => feed.isNew)?.id ?? next.feeds[0]?.id ?? null);
      setFilter(next.feeds.some((feed) => feed.isNew) ? "new" : "all");
      setError("");
    } catch { setError(t("invalidFile")); }
  }

  function updateFeed(id: string, patch: Partial<Feed>) {
    setLibrary((current) => ({ ...current, feeds: current.feeds.map((feed) => feed.id === id ? { ...feed, ...patch } : feed) }));
  }

  async function checkOne(feed: Feed) {
    setChecking((current) => new Set(current).add(feed.id));
    try {
      const result = await invoke<FeedCheckResult>("check_feed", { url: feed.xmlUrl, htmlUrl: feed.htmlUrl ?? null });
      updateFeed(feed.id, {
        reachable: result.reachable,
        checkedAt: new Date().toISOString(),
        checkMessage: result.status ? `HTTP ${result.status} · ${result.message}` : result.message,
        logoUrl: result.logoUrl,
        language: result.language || feed.language
      });
    } catch (cause) {
      updateFeed(feed.id, { reachable: false, checkedAt: new Date().toISOString(), checkMessage: cause instanceof Error ? cause.message : String(cause), logoUrl: GENERIC_RSS_LOGO });
    } finally {
      setChecking((current) => { const next = new Set(current); next.delete(feed.id); return next; });
    }
  }

  async function checkAll() {
    for (let index = 0; index < library.feeds.length; index += 6) {
      await Promise.all(library.feeds.slice(index, index + 6).map(checkOne));
    }
  }

  async function loadGReader() {
    const baseUrl = window.prompt(language === "de" ? "GReader API-Adresse" : "GReader API URL", preference("greader-url") || "")?.trim(); if (!baseUrl) return;
    const username = window.prompt(language === "de" ? "Benutzername" : "Username", preference("greader-user") || "")?.trim(); if (!username) return;
    const password = window.prompt(language === "de" ? "API-Passwort (wird nicht gespeichert)" : "API password (not stored)") || ""; if (!password) return;
    try { const subscriptions = await invoke<GReaderSubscription[]>("greader_load", { baseUrl, username, password }); const next = mergeGReader(subscriptions, library); setLibrary(next); setActiveId(next.feeds[0]?.id ?? null); setGreader({ baseUrl, username, password }); localStorage.setItem("blogroll-greader-url", baseUrl); localStorage.setItem("blogroll-greader-user", username); setError(""); } catch (cause) { setError(String(cause)); }
  }

  async function syncGReader() {
    if (!greader) return; const operations = greaderPlan(library.feeds); if (!operations.length || !window.confirm(`${operations.length} ${language === "de" ? "Änderungen am Server anwenden?" : "changes apply to server?"}`)) return;
    try { await invoke("greader_apply", { ...greader, operations }); const subscriptions = await invoke<GReaderSubscription[]>("greader_load", greader); setLibrary((current) => mergeGReader(subscriptions, current)); } catch (cause) { setError(String(cause)); }
  }

  function toggleExportLanguage(value: string) {
    setExcludedExportLanguages((current) => {
      const next = new Set(current);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }

  function languageName(value: string): string {
    if (!value) return t("exportUnknown");
    try { return new Intl.DisplayNames([language], { type: "language" }).of(value) || value.toUpperCase(); }
    catch { return value.toUpperCase(); }
  }

  function download() {
    const blob = new Blob([exportOpml(library.feeds, { languages: includedExportLanguages, includeCategories })], { type: "text/x-opml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = href; link.download = "selected-feeds.opml"; link.click();
    URL.revokeObjectURL(href);
    setExportOpen(false);
  }

  if (!library.feeds.length) return <EmptyState input={input} importFile={importFile} error={error} language={language} setLanguage={setLanguage} />;

  return <main className="app" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); importFile(event.dataTransfer.files[0]); }}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">BC</span><div><strong>Blogroll Curator</strong><small>{library.importName ?? t("localLibrary")}</small></div></div>
      <div className="top-actions">
        <button className="button secondary" onClick={loadGReader}>GReader</button>
        {greader && <button className="button secondary" disabled={!greaderPlan(library.feeds).length} onClick={syncGReader}>{language === "de" ? "Synchronisieren" : "Sync"} ({greaderPlan(library.feeds).length})</button>}
        <button className="button secondary" onClick={() => input.current?.click()}><FileUp size={16}/> {t("importOpml")}</button>
        <button className="button secondary" disabled={checking.size > 0} onClick={checkAll}><RefreshCw className={checking.size ? "spin" : ""} size={16}/> {checking.size ? `${checking.size} ${t("checking")}` : t("checkFeeds")}</button>
        <div className="export-control">
          <button className="button primary" disabled={!selectedCount} onClick={() => setExportOpen((open) => !open)}><Download size={16}/> {t("export")} {selectedCount || ""}</button>
          {exportOpen && <div className="export-popover">
            <div className="export-popover-heading"><strong>{t("exportOptions")}</strong><button onClick={() => setExportOpen(false)}><X size={16}/></button></div>
            <fieldset><legend>{t("exportLanguages")}</legend>
              {exportLanguages.map((value) => <label key={value || "unknown"}><input type="checkbox" checked={!excludedExportLanguages.has(value)} onChange={() => toggleExportLanguage(value)}/><span>{languageName(value)}</span><b>{library.feeds.filter((feed) => feed.selected && (feed.language || "") === value).length}</b></label>)}
            </fieldset>
            <label className="export-category-option"><input type="checkbox" checked={includeCategories} onChange={(event) => setIncludeCategories(event.target.checked)}/><span><strong>{t("exportCategories")}</strong><small>{t("exportCategoriesHelp")}</small></span></label>
            {!exportCount && <p className="export-warning">{t("noExportFeeds")}</p>}
            <div className="export-actions"><button className="button secondary" onClick={() => setExportOpen(false)}>{t("cancel")}</button><button className="button primary" disabled={!exportCount} onClick={download}><Download size={14}/>{t("exportNow")} ({exportCount})</button></div>
          </div>}
        </div>
      </div>
      <input ref={input} hidden type="file" accept=".opml,.xml,text/xml" onChange={(event) => importFile(event.target.files?.[0])}/>
    </header>
    {error && <div className="error"><span>{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}
    <section className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">{t("library")}</p>
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")} icon={<Inbox/>} label={t("allFeeds")} count={library.feeds.length}/>
        <FilterButton active={filter === "new"} onClick={() => setFilter("new")} icon={<Sparkles/>} label={t("newImport")} count={newCount}/>
        <FilterButton active={filter === "selected"} onClick={() => setFilter("selected")} icon={<Check/>} label={t("selected")} count={selectedCount}/>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><strong>{t("dataLocal")}</strong><p>{t("dataLocalDetail")}</p></div>
          <div className="sidebar-language"><span>{t("uiLanguage")}</span><LanguageSwitch language={language} setLanguage={setLanguage}/></div>
          <div className="app-version">Blogroll Curator<br/>v{packageInfo.version}</div>
        </div>
      </aside>
      <section className="feed-panel">
        <div className="panel-heading"><div><p className="eyebrow">{t(filter)}</p><h1>{filter === "new" ? t("newHeading") : filter === "selected" ? t("selectedHeading") : t("allHeading")}</h1></div><div className="category-tools"><span>{visible.length} {t("feeds")}</span><button onClick={() => setCollapsed(new Set(groups.map(([category]) => category)))}>{t("collapseAll")}</button><button onClick={() => setCollapsed(new Set())}>{t("expandAll")}</button></div></div>
        <label className="search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")}/>{query && <button onClick={() => setQuery("")}><X size={15}/></button>}</label>
        <div className="feed-list">
          {groups.map(([category, feeds]) => <section className="category" key={category}>
            <button className="category-heading" onClick={() => toggleCategory(category)} aria-expanded={!collapsed.has(category)}>
              {collapsed.has(category) ? <ChevronRight size={15}/> : <ChevronDown size={15}/>}<Folder size={14}/><span>{category}</span><b>{feeds.length}</b>
            </button>
            {!collapsed.has(category) && feeds.map((feed) => <button key={feed.id} className={`feed-row ${activeId === feed.id ? "active" : ""}`} onClick={() => setActiveId(feed.id)}>
            <span className={`checkbox ${feed.selected ? "checked" : ""}`} role="checkbox" aria-checked={feed.selected} onClick={(event) => { event.stopPropagation(); updateFeed(feed.id, { selected: !feed.selected }); }}>{feed.selected && <Check size={13}/>}</span>
            <img className="feed-logo" src={logoSrc(feed.logoUrl)} alt="" loading="lazy" onError={(event) => { event.currentTarget.src = "/rss-logo.svg"; }}/>
            <span className="feed-copy"><span className="feed-title">{feed.title}{feed.isNew && <em>{t("newTag")}</em>}</span><span className="feed-meta">{feed.description}</span></span>
            {feed.reachable !== null && <span className={`reachability-tag ${feed.reachable ? "reachable" : "unreachable"}`}>{feed.reachable ? t("accessible") : t("failed")}</span>}
            {feed.language && <span className="language-pill">{feed.language.toUpperCase()}</span>}{feed.country && <span className="country-pill">{feed.country}</span>}<ChevronRight size={16}/>
          </button>)}
          </section>)}
          {!visible.length && <div className="no-results"><Search/><strong>{t("noMatches")}</strong><span>{t("noMatchesDetail")}</span></div>}
        </div>
      </section>
      <aside className="inspector">
        {active ? <>
          <div className="inspector-heading"><img className="feed-icon feed-logo-large" src={logoSrc(active.logoUrl)} alt="" onError={(event) => { event.currentTarget.src = "/rss-logo.svg"; }}/><div><p className="eyebrow">{t("feedDetails")}</p><h2>{active.title}</h2></div></div>
          <label className="toggle-row"><span><strong>{t("includeExport")}</strong><small>{t("remembered")}</small></span><button className={`switch ${active.selected ? "on" : ""}`} onClick={() => updateFeed(active.id, { selected: !active.selected })}><span/></button></label>
          <div className="availability"><div><span className={`status-dot ${active.reachable === true ? "ok" : active.reachable === false ? "bad" : "unknown"}`}/><span><strong>{active.reachable === true ? t("feedAccessible") : active.reachable === false ? t("feedUnavailable") : t("notChecked")}</strong><small>{active.checkMessage || (active.checkedAt ? new Date(active.checkedAt).toLocaleString(language) : "")}</small></span></div><button className="button secondary" disabled={checking.has(active.id)} onClick={() => checkOne(active)}><RefreshCw className={checking.has(active.id) ? "spin" : ""} size={14}/> {t("check")}</button></div>
          {active.greader && <><div className="field"><label>{language === "de" ? "GReader-Kategorie" : "GReader category"}</label><input value={active.folder} onChange={(event) => updateFeed(active.id, { folder: event.target.value })}/></div><label className="toggle-row"><span><strong>{language === "de" ? "Vom Server löschen" : "Delete from server"}</strong><small>{language === "de" ? "Erst bei Synchronisierung" : "Only when syncing"}</small></span><button className={`switch ${active.greader.deleted ? "on" : ""}`} onClick={() => updateFeed(active.id, { greader: { ...active.greader!, deleted: !active.greader!.deleted } })}><span/></button></label></>}
          <div className="field"><label>{t("countryCode")} <small>{t("optional")}</small></label><input maxLength={2} placeholder={t("countryExample")} value={active.country} onChange={(event) => updateFeed(active.id, { country: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}/><span>{t("countryHelp")}</span></div>
          <div className="field"><label>{t("feedLanguage")} <small>{t("optional")}</small></label><input maxLength={8} placeholder={t("languageExample")} value={active.language} onChange={(event) => updateFeed(active.id, { language: event.target.value.toLowerCase().replace(/[^a-z-]/g, "") })}/><span>{t("languageHelp")}</span></div>
          <div className="field"><label>{t("personalComment")} <small>{t("optional")}</small></label><textarea rows={5} placeholder={t("commentPlaceholder")} value={active.comment} onChange={(event) => updateFeed(active.id, { comment: event.target.value })}/></div>
          <div className="facts"><div><span>{t("feedUrl")}</span>{safeRemoteUrl(active.xmlUrl) ? <a href={safeRemoteUrl(active.xmlUrl)!} target="_blank" rel="noreferrer">{active.xmlUrl}</a> : <strong>{active.xmlUrl}</strong>}</div><div><span>{t("folder")}</span><strong>{active.folder || t("noFolder")}</strong></div><div><span>{t("firstSeen")}</span><strong>{new Date(active.firstSeenAt).toLocaleDateString(language)}</strong></div></div>
          <p className="saved"><Check size={14}/> {t("autoSave")}</p>
        </> : <div className="no-results"><strong>{t("selectFeed")}</strong></div>}
      </aside>
    </section>
  </main>;
}

function FilterButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return <button className={`filter-button ${active ? "active" : ""}`} onClick={onClick}><span>{icon}{label}</span><b>{count}</b></button>;
}

function LanguageSwitch({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  return <div className="language-switch" aria-label="Language / Sprache"><button className={language === "de" ? "active" : ""} onClick={() => setLanguage("de")}>DE</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button></div>;
}

function EmptyState({ input, importFile, error, language, setLanguage }: { input: React.RefObject<HTMLInputElement | null>; importFile: (file?: File) => void; error: string; language: Language; setLanguage: (language: Language) => void }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <main className="empty" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); importFile(event.dataTransfer.files[0]); }}>
    <div className="empty-brand"><span className="brand-mark">BC</span> Blogroll Curator <LanguageSwitch language={language} setLanguage={setLanguage}/></div>
    <section className="welcome"><span className="welcome-icon"><FileUp/></span><p className="eyebrow">{t("workspace")}</p><h1>{t("welcomeTitle1")}<br/>{t("welcomeTitle2")}</h1><p className="welcome-copy">{t("welcomeCopy")}</p><button className="button primary large" onClick={() => input.current?.click()}><FileUp size={18}/> {t("chooseFile")}</button><p className="drop-hint">{t("dropHint")}</p>{error && <p className="empty-error">{error}</p>}<input ref={input} hidden type="file" accept=".opml,.xml,text/xml" onChange={(event) => importFile(event.target.files?.[0])}/></section>
    <footer>{t("footer")}</footer>
  </main>;
}
