#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FeedCheck {
    reachable: bool,
    status: Option<u16>,
    message: String,
    logo_url: String,
    language: Option<String>,
}

const GENERIC_RSS_LOGO: &str = "urn:blogroll:generic-rss";

#[derive(Default)]
struct FeedMetadata {
    logo: Option<String>,
    site: Option<String>,
    language: Option<String>,
}

fn validated_http_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value.trim()).map_err(|_| "Invalid URL".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Only HTTP and HTTPS URLs are supported".into());
    }
    if url.host_str().is_none() {
        return Err("URL must include a host".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("URLs with embedded credentials are not supported".into());
    }
    Ok(url)
}

fn resolved_url(value: &str, base_url: &reqwest::Url) -> Option<String> {
    base_url.join(value).ok().and_then(|url| validated_http_url(url.as_str()).ok()).map(|url| url.to_string())
}

fn atom_link(element: &quick_xml::events::BytesStart<'_>, base_url: &reqwest::Url) -> Option<String> {
    let mut href = None;
    let mut relation = None;
    for attribute in element.attributes().flatten() {
        let name = String::from_utf8_lossy(attribute.key.local_name().as_ref()).to_lowercase();
        let value = attribute.normalized_value(quick_xml::XmlVersion::Implicit1_0).ok()?.into_owned();
        if name == "href" { href = Some(value); }
        else if name == "rel" { relation = Some(value); }
    }
    if relation.as_deref().is_none_or(|rel| rel == "alternate") {
        href.and_then(|value| resolved_url(&value, base_url))
    } else { None }
}

fn extract_feed_metadata(xml: &[u8], base_url: &reqwest::Url) -> FeedMetadata {
    let mut reader = quick_xml::Reader::from_reader(xml);
    reader.config_mut().trim_text(true);
    let mut stack: Vec<String> = Vec::new();
    let mut metadata = FeedMetadata::default();
    loop {
        match reader.read_event() {
            Ok(quick_xml::events::Event::Start(element)) => {
                let name = String::from_utf8_lossy(element.local_name().as_ref()).to_lowercase();
                if name == "feed" && metadata.language.is_none() {
                    for attribute in element.attributes().flatten() {
                        if attribute.key.as_ref().eq_ignore_ascii_case(b"xml:lang") {
                            metadata.language = attribute.normalized_value(quick_xml::XmlVersion::Implicit1_0).ok().map(|value| value.split(['-', '_']).next().unwrap_or_default().to_lowercase()).filter(|value| !value.is_empty());
                        }
                    }
                }
                if name == "link" && metadata.site.is_none() && stack.last().is_some_and(|parent| parent == "feed") {
                    metadata.site = atom_link(&element, base_url);
                }
                stack.push(name);
            }
            Ok(quick_xml::events::Event::Empty(element)) => {
                let name = String::from_utf8_lossy(element.local_name().as_ref()).to_lowercase();
                if name == "link" && metadata.site.is_none() && stack.last().is_some_and(|parent| parent == "feed") {
                    metadata.site = atom_link(&element, base_url);
                }
            }
            Ok(quick_xml::events::Event::Text(text)) => {
                let is_atom_logo = matches!(stack.last().map(String::as_str), Some("icon" | "logo"));
                let is_rss_image = stack.len() >= 2 && stack[stack.len() - 2] == "image" && stack.last().is_some_and(|name| name == "url");
                let is_rss_site = stack.last().is_some_and(|name| name == "link") && stack.iter().any(|name| name == "channel") && !stack.iter().any(|name| name == "item");
                let is_rss_language = stack.last().is_some_and(|name| name == "language") && stack.iter().any(|name| name == "channel");
                if let Ok(value) = text.decode() {
                    let value = value.trim();
                    if !value.is_empty() {
                        if metadata.logo.is_none() && (is_atom_logo || is_rss_image) { metadata.logo = resolved_url(value, base_url); }
                        if metadata.site.is_none() && is_rss_site { metadata.site = resolved_url(value, base_url); }
                        if metadata.language.is_none() && is_rss_language { metadata.language = value.split(['-', '_']).next().map(str::to_lowercase).filter(|value| !value.is_empty()); }
                    }
                }
            }
            Ok(quick_xml::events::Event::End(_)) => { stack.pop(); }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }
    metadata
}

fn html_icon(html: &str, base_url: &reqwest::Url) -> Option<String> {
    let tag_pattern = regex::Regex::new(r"(?is)<link\b[^>]*>").ok()?;
    let attr_pattern = regex::Regex::new(r#"(?i)\b(rel|href)\s*=\s*["']([^"']+)["']"#).ok()?;
    for tag in tag_pattern.find_iter(html) {
        let mut rel = None;
        let mut href = None;
        for captures in attr_pattern.captures_iter(tag.as_str()) {
            if captures[1].eq_ignore_ascii_case("rel") { rel = Some(captures[2].to_string()); }
            if captures[1].eq_ignore_ascii_case("href") { href = Some(captures[2].to_string()); }
        }
        if rel.as_deref().is_some_and(|value| value.to_lowercase().split_whitespace().any(|part| part == "icon" || part.starts_with("apple-touch-icon"))) {
            if let Some(icon) = href.and_then(|value| resolved_url(&value, base_url)) { return Some(icon); }
        }
    }
    None
}

async fn discover_site_logo(client: &reqwest::Client, site_url: &str) -> Option<String> {
    let response = client.get(site_url).send().await.ok()?;
    if !response.status().is_success() || response.content_length().unwrap_or(0) > 2_000_000 { return None; }
    let final_url = response.url().clone();
    let body = response.bytes().await.ok()?;
    if let Ok(html) = std::str::from_utf8(&body) {
        if let Some(icon) = html_icon(html, &final_url) { return Some(icon); }
    }
    let favicon = final_url.join("/favicon.ico").ok()?;
    let response = client.get(favicon.clone()).send().await.ok()?;
    if response.status().is_success() { Some(favicon.to_string()) } else { None }
}

#[cfg(test)]
mod tests {
    use super::{extract_feed_metadata, html_icon, validated_http_url};

    #[test]
    fn accepts_http_feed_urls() {
        assert!(validated_http_url("https://example.com/feed.xml").is_ok());
        assert!(validated_http_url("http://localhost:8080/feed").is_ok());
    }

    #[test]
    fn rejects_unsafe_or_malformed_feed_urls() {
        assert!(validated_http_url("file:///etc/passwd").is_err());
        assert!(validated_http_url("javascript:alert(1)").is_err());
        assert!(validated_http_url("https://user:secret@example.com/feed").is_err());
        assert!(validated_http_url("not a url").is_err());
    }

    #[test]
    fn extracts_rss_image_url() {
        let xml = br#"<rss><channel><title>Example</title><image><url>https://example.com/rss.png</url></image></channel></rss>"#;
        let base = reqwest::Url::parse("https://example.com/feed.xml").unwrap();
        assert_eq!(extract_feed_metadata(xml, &base).logo.as_deref(), Some("https://example.com/rss.png"));
    }

    #[test]
    fn resolves_relative_atom_icon() {
        let xml = br#"<feed xmlns="http://www.w3.org/2005/Atom"><title>Example</title><icon>/icon.png</icon></feed>"#;
        let base = reqwest::Url::parse("https://example.com/feeds/main.xml").unwrap();
        assert_eq!(extract_feed_metadata(xml, &base).logo.as_deref(), Some("https://example.com/icon.png"));
    }

    #[test]
    fn finds_html_icons() {
        let html = r#"<html><head><link rel="apple-touch-icon" href="/apple.png"></head></html>"#;
        let base = reqwest::Url::parse("https://example.com/about").unwrap();
        assert_eq!(html_icon(html, &base).as_deref(), Some("https://example.com/apple.png"));
    }

    #[test]
    fn extracts_feed_languages() {
        let base = reqwest::Url::parse("https://example.com/feed").unwrap();
        assert_eq!(extract_feed_metadata(br#"<rss><channel><language>de-DE</language></channel></rss>"#, &base).language.as_deref(), Some("de"));
        assert_eq!(extract_feed_metadata(br#"<feed xml:lang="en-GB"></feed>"#, &base).language.as_deref(), Some("en"));
    }
}

#[tauri::command]
async fn check_feed(url: String, html_url: Option<String>) -> FeedCheck {
    let feed_url = match validated_http_url(&url) {
        Ok(url) => url,
        Err(message) => return FeedCheck { reachable: false, status: None, message, logo_url: GENERIC_RSS_LOGO.into(), language: None },
    };
    let html_url = html_url.and_then(|url| validated_http_url(&url).ok()).map(|url| url.to_string());
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("BlogrollCurator/0.2 (+local feed validation)")
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
    {
        Ok(client) => client,
        Err(error) => return FeedCheck { reachable: false, status: None, message: error.to_string(), logo_url: GENERIC_RSS_LOGO.into(), language: None },
    };

    match client.get(feed_url).send().await {
        Ok(response) => {
            let status = response.status();
            let base_url = response.url().clone();
            let (logo_url, language) = if status.is_success() && response.content_length().unwrap_or(0) <= 5_000_000 {
                match response.bytes().await {
                    Ok(body) => {
                        let metadata = extract_feed_metadata(&body, &base_url);
                        let logo = match metadata.logo {
                            Some(logo) => logo,
                            None => {
                                let site = html_url.as_deref().or(metadata.site.as_deref());
                                match site {
                                    Some(site) => discover_site_logo(&client, site).await.unwrap_or_else(|| GENERIC_RSS_LOGO.into()),
                                    None => GENERIC_RSS_LOGO.into(),
                                }
                            }
                        };
                        (logo, metadata.language)
                    },
                    Err(_) => (GENERIC_RSS_LOGO.into(), None),
                }
            } else {
                (GENERIC_RSS_LOGO.into(), None)
            };
            FeedCheck {
                reachable: status.is_success(),
                status: Some(status.as_u16()),
                message: status.canonical_reason().unwrap_or("HTTP response").to_string(),
                logo_url,
                language,
            }
        }
        Err(error) => FeedCheck { reachable: false, status: None, message: error.to_string(), logo_url: GENERIC_RSS_LOGO.into(), language: None },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_feed])
        .build(tauri::generate_context!())
        .expect("error while building Blogroll Curator");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Ready = event {
            tauri::WebviewWindowBuilder::new(
                app_handle,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Blogroll Curator")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 620.0)
            .build()
            .expect("error while opening the Blogroll Curator window");
        }
    });
}
