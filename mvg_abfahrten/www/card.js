/* MVG Abfahrten – Lovelace-Karte v1.9.0
 *
 * Wird vom Add-on selbst ausgeliefert (http://<ha-host>:8099/card.js).
 * Konfiguration (YAML):
 *
 *   type: custom:mvg-abfahrten-card
 *   # api_url: http://192.168.0.222:8099   # optional, Standard: <ha-host>:8099
 *   # global_id: de:09184:2400             # feste Haltestelle (deaktiviert Favoriten-Chips)
 *   # title: Ottobrunn                     # optionaler Titel bei global_id
 *   # favorites: true                      # Favoriten aus dem Add-on als Chips (Standard)
 *   # limit: 8                             # Anzahl Abfahrten
 *   # types: SBAHN,BUS                     # optionaler Verkehrsmittel-Filter
 *   # refresh: 30                          # Aktualisierung in Sekunden (min. 20)
 */
(() => {
  "use strict";

  const LINE_COLORS = {
    U1:"#438136", U2:"#C40C37", U3:"#F36E31", U4:"#0AB38D", U5:"#B8740E",
    U6:"#006CB3",
    S1:"#16BAE7", S2:"#76B82A", S3:"#951B81", S4:"#E30613", S5:"#005E82",
    S6:"#00975F", S7:"#943126", S8:"#262626", S20:"#ED6B83"
  };
  const LINE_GRADIENTS = {
    U7:"linear-gradient(135deg,#438136 50%,#C40C37 50%)",
    U8:"linear-gradient(135deg,#C40C37 50%,#F36E31 50%)"
  };
  const EXPRESS_GREEN = "#009A3D";
  const TYPE_COLORS = {
    UBAHN:"#0065B0", SBAHN:"#4C9046", TRAM:"#D82020",
    BUS:"#00586A", REGIONAL_BUS:"#0D5C70", BAHN:"#36397F", SEV:"#7A6A00"
  };
  const SHORT_LABELS = {
    "LUFTHANSA EXPRESS BUS": "LH Bus",
    "Lufthansa Express Bus": "LH Bus",
    "ERSATZVERKEHR": "SEV"
  };
  const TYPE_NAMES = {
    UBAHN:"U-Bahn", SBAHN:"S-Bahn", TRAM:"Tram",
    BUS:"Bus", REGIONAL_BUS:"Bus", BAHN:"Bahn"
  };
  const typesLabel = (ft) => [...new Set(
    (ft || "").split(",").filter(Boolean).map(t => TYPE_NAMES[t] || t)
  )].join("/");
  const favKey = (f) =>
    (f.globalId ?? "") + "|" + (f.filterTypes ?? "") + "|" + (f.platformFilter ?? "");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  const STYLE = `
    :host { display: block; }
    ha-card {
      overflow: hidden;
      color: var(--mvg-ink);
      font-variant-numeric: tabular-nums;
      --mvg-ink: var(--primary-text-color, #212121);
      --mvg-muted: var(--secondary-text-color, #727272);
      --mvg-line: var(--divider-color, rgba(127,127,127,0.2));
      --mvg-accent: var(--accent-color, #ff9800);
      --mvg-red: var(--error-color, #db4437);
      --mvg-chip-bg: var(--secondary-background-color, rgba(127,127,127,0.08));
      --mvg-chip-on: rgba(var(--rgb-accent-color, 255,152,0), 0.12);
    }
    ha-card.board {
      background: #0F1A29;
      --mvg-ink: #EDF2F8;
      --mvg-muted: #7E92AB;
      --mvg-line: #1E2E44;
      --mvg-accent: #FFB300;
      --mvg-red: #E5443B;
      --mvg-chip-bg: #131F30;
      --mvg-chip-on: rgba(255,179,0,0.08);
    }
    .head {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px 10px;
    }
    .head[hidden] { display: none; }
    .head h2 { margin: 0; font-size: 16px; font-weight: 700; }
    .head .place { color: var(--mvg-muted); font-size: 12.5px; }
    .head .clock { margin-left: auto; color: var(--mvg-accent); font-size: 16px; font-weight: 600; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
    .head[hidden] + .chips { padding-top: 14px; }
    .chip {
      padding: 4px 11px; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--mvg-line); background: var(--mvg-chip-bg);
      color: var(--mvg-muted); font-size: 12.5px; font-weight: 600; font-family: inherit;
    }
    .chip.on { color: var(--mvg-ink); border-color: var(--mvg-accent); background: var(--mvg-chip-on); }
    .chip:focus-visible { outline: 2px solid var(--mvg-accent); outline-offset: 1px; }
    .row {
      display: grid; align-items: center;
      grid-template-columns: minmax(52px, auto) 1fr auto auto;
      gap: 10px; padding: 9px 16px;
      border-top: 1px solid var(--mvg-line);
    }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 42px; max-width: 104px; padding: 3px 6px; border-radius: 6px;
      font-weight: 800; font-size: 13.5px; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .badge.long { font-size: 10.5px; letter-spacing: -0.01em; }
    .dest { min-width: 0; }
    .to { font-size: 14.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { color: var(--mvg-muted); font-size: 11.5px; }
    .meta .delay { color: var(--mvg-red); font-weight: 700; }
    .meta .sev { color: var(--mvg-accent); font-weight: 700; }
    .platform { color: var(--mvg-muted); font-size: 12px; white-space: nowrap; }
    .platform-changed { color: var(--mvg-accent); font-weight: 700; }
    .min { text-align: right; color: var(--mvg-accent); font-size: 18px; font-weight: 700; min-width: 62px; }
    .min small { font-size: 10.5px; font-weight: 600; color: var(--mvg-muted); margin-left: 2px; }
    .cancelled .to { text-decoration: line-through; color: var(--mvg-muted); }
    .cancelled .min { color: var(--mvg-red); font-size: 13px; }
    .info-btn {
      background: none; border: 0; cursor: pointer; padding: 0 2px;
      color: var(--mvg-red); font-size: 12px; line-height: 1; vertical-align: middle;
    }
    .note { padding: 18px 16px; color: var(--mvg-muted); font-size: 13px; border-top: 1px solid var(--mvg-line); }
    .note.err { color: var(--mvg-red); }
    .dir-bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      padding: 8px 16px; border-top: 1px solid var(--mvg-line);
    }
    .dir-bar[hidden] { display: none; }
    .dir-label { color: var(--mvg-muted); font-size: 11.5px; white-space: nowrap; }
    .dir-chip {
      display: flex; flex-direction: column; align-items: flex-start;
      padding: 5px 10px; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--mvg-line); background: var(--mvg-chip-bg);
      color: var(--mvg-muted); font-family: inherit; text-align: left;
    }
    .dir-chip .gleis { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; }
    .dir-chip .dest-list { font-size: 11px; color: var(--mvg-muted); }
    .dir-chip[aria-pressed="true"] {
      border-color: var(--mvg-accent); background: var(--mvg-chip-on);
      color: var(--mvg-ink);
    }
    .dir-chip[aria-pressed="true"] .dest-list { color: var(--mvg-ink); }
    .dir-clear {
      background: none; border: 0; color: var(--mvg-muted);
      font-size: 11px; cursor: pointer; padding: 3px 6px;
      border-radius: 6px; white-space: nowrap; margin-left: auto;
    }
    .dir-clear:hover { color: var(--mvg-ink); }
    .section-head {
      display: flex; align-items: baseline; gap: 8px;
      padding: 13px 16px 7px; border-top: 2px solid var(--mvg-line);
    }
    .section-head:first-child { border-top: 0; }
    .section-head h3 { margin: 0; font-size: 14px; font-weight: 700; }
    .section-head .tag { color: var(--mvg-accent); font-size: 11.5px; font-weight: 700; }
    .section-head .place2 { color: var(--mvg-muted); font-size: 11.5px; }
    @media (max-width: 420px) { .platform { display: none; } }
  `;

  class MvgAbfahrtenCard extends HTMLElement {

    static getStubConfig() {
      return { favorites: true, limit: 8 };
    }

    static async getConfigElement() {
      // ha-form laden, indem kurz ein Core-Editor instanziiert wird
      try {
        const helpers = await window.loadCardHelpers();
        const tmp = await helpers.createCardElement({ type: "entities", entities: [] });
        await tmp.constructor.getConfigElement();
      } catch (e) { /* ha-form ist meist ohnehin schon geladen */ }
      return document.createElement("mvg-abfahrten-card-editor");
    }

    setConfig(config) {
      this._config = Object.assign({ favorites: true, limit: 8, refresh: 30 }, config);
      this._apiUrl = (config.api_url ||
        `${location.protocol}//${location.hostname}:8099`).replace(/\/+$/, "");
      this._storageKey = "mvg-card:" + (config.global_id || "favs");
      this._current = null;
      this._favorites = [];

      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>${STYLE}</style>
        <ha-card>
          <div class="head" id="head">
            <div id="titleWrap"><h2 id="name">MVG Abfahrten</h2><div class="place" id="place"></div></div>
            <div class="clock" id="clock"></div>
          </div>
          <div class="chips" id="chips" hidden></div>
          <div class="dir-bar" id="dirBar" hidden>
            <span class="dir-label">Richtung</span>
            <div id="dirChips" style="display:flex;flex-wrap:wrap;gap:6px;flex:1"></div>
            <button class="dir-clear" id="dirClear">✕</button>
          </div>
          <div id="rows"><div class="note">Lade …</div></div>
        </ha-card>`;
      this._els = {
        card: this.shadowRoot.querySelector("ha-card"),
        head: this.shadowRoot.getElementById("head"),
        titleWrap: this.shadowRoot.getElementById("titleWrap"),
        name: this.shadowRoot.getElementById("name"),
        place: this.shadowRoot.getElementById("place"),
        clock: this.shadowRoot.getElementById("clock"),
        chips: this.shadowRoot.getElementById("chips"),
        dirBar: this.shadowRoot.getElementById("dirBar"),
        dirChips: this.shadowRoot.getElementById("dirChips"),
        dirClear: this.shadowRoot.getElementById("dirClear"),
        rows: this.shadowRoot.getElementById("rows"),
      };
      this._dirFilter = new Set(); // aktive Richtungen (1=H, 2=R)
      // Design: HA-Theme (Standard) oder dunkle Anzeigetafel
      this._els.card.classList.toggle("board", this._config.design === "board");
      // Titel und Uhr optional
      this._showTitle = this._config.show_title !== false;
      this._showClock = this._config.show_clock !== false;
      this._els.titleWrap.style.display = this._showTitle ? "" : "none";
      this._els.clock.style.display = this._showClock ? "" : "none";
      this._els.head.hidden = !this._showTitle && !this._showClock;
    }

    connectedCallback() {
      this._init();
      const refresh = Math.max(20, Number(this._config.refresh) || 30);
      this._timer = setInterval(() => {
        if (!document.hidden) this._refresh();
      }, refresh * 1000);
      if (this._showClock) {
        this._clockTimer = setInterval(() => this._tick(), 1000);
        this._tick();
      }
      this._els.dirClear.addEventListener("click", () => {
        this._dirFilter.clear();
        this._els.dirChips.querySelectorAll(".dir-chip")
          .forEach(c => c.setAttribute("aria-pressed", "false"));
        this._renderRows(this._lastDeps || []);
      });
    }

    disconnectedCallback() {
      clearInterval(this._timer);
      clearInterval(this._clockTimer);
    }

    _refresh() {
      if (this._config.layout === "list" && !this._config.global_id) this._loadAll();
      else this._loadDepartures();
    }

    _tick() {
      const d = new Date();
      this._els.clock.textContent =
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0");
    }

    async _init() {
      if (this._config.global_id) {
        this._current = {
          globalId: this._config.global_id,
          name: this._config.title || this._config.global_id,
          place: "",
          filterTypes: this._config.types || "",
        };
        this._renderHead();
        this._loadDepartures();
        return;
      }
      // Favoriten aus dem Add-on
      let rawFavs;
      try {
        const resp = await fetch(this._apiUrl + "/api/favorites");
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        rawFavs = await resp.json();
      } catch (err) {
        this._error("Add-on-API nicht erreichbar: " + esc(String(err)) +
          "<br><small>URL: " + esc(this._apiUrl) + "</small>");
        return;
      }
      if (!Array.isArray(rawFavs)) {
        this._error("Ungültige Antwort von der Add-on-API (kein Array).");
        return;
      }
      this._favorites = rawFavs;
      if (!this._favorites.length) {
        this._error("Keine Favoriten vorhanden – im Add-on eine Haltestelle suchen und mit ★ speichern.");
        return;
      }
      if (this._config.layout === "list") {
        this._els.name.textContent = "MVG Abfahrten";
        this._els.place.textContent = "";
        this._els.chips.hidden = true;
        this._loadAll();
        return;
      }
      const savedKey = localStorage.getItem(this._storageKey);
      // Migration: alter Key hatte nur 2 Segmente (globalId|filterTypes)
      // neuer Key hat 4 Segmente (globalId|filterTypes|lineFilter|directionFilter)
      this._current =
        this._favorites.find(f => favKey(f) === savedKey) ||
        this._favorites.find(f => (f.globalId + "|" + (f.filterTypes ?? "")) === savedKey) ||
        this._favorites[0];
      // gespeicherten Key auf neues Format aktualisieren
      if (this._current) localStorage.setItem(this._storageKey, favKey(this._current));
      this._renderChips();
      this._renderHead();
      this._loadDepartures();
    }

    _renderChips() {
      if (this._config.favorites === false || this._favorites.length < 2) {
        this._els.chips.hidden = true;
        return;
      }
      this._els.chips.hidden = false;
      this._els.chips.innerHTML = "";
      for (const f of this._favorites) {
        const b = document.createElement("button");
        b.className = "chip" + (favKey(f) === favKey(this._current || {}) ? " on" : "");
        b.textContent = f.name
          + (f.filterTypes    ? " · " + typesLabel(f.filterTypes) : "")
          + (f.lineFilter     ? " · " + esc(f.lineFilter) : "")
          + (f.directionFilter ? " → " + esc(f.directionFilter) : "");
        b.addEventListener("click", () => {
          this._current = f;
          localStorage.setItem(this._storageKey, favKey(f));
          this._renderChips();
          this._renderHead();
          this._els.rows.innerHTML = '<div class="note">Lade …</div>';
          this._loadDepartures();
        });
        this._els.chips.appendChild(b);
      }
    }

    _renderHead() {
      const tag = this._current.filterTypes ? " · " + typesLabel(this._current.filterTypes) : "";
      this._els.name.textContent = this._current.name + tag;
      this._els.place.textContent = this._current.place || "";
    }

    async _fetchRaw(globalId, types) {
      const limit = Math.min(80, Math.max(30, (this._config.limit || 8) * 4));
      const params = new URLSearchParams({ limit });
      if (types) params.set("types", types);
      const resp = await fetch(this._apiUrl + "/api/departures/" +
        encodeURIComponent(globalId) + "?" + params);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return (await resp.json()).departures || [];
    }

    _applyDirFilter(deps, savedPf) {
      let filtered = deps;
      if (savedPf?.size)       filtered = filtered.filter(d => savedPf.has(d.direction));
      if (this._dirFilter?.size) filtered = filtered.filter(d => this._dirFilter.has(d.direction));
      return filtered.slice(0, this._config.limit || 8);
    }

    _parsePlatformFilter(pf) {
      if (!pf) return null;
      const nums = String(pf).split(",").map(Number).filter(Boolean);
      return nums.length ? new Set(nums) : null;
    }

    _updateDirBar(deps) {
      const byDir = new Map();
      for (const d of deps) {
        if (!d.direction) continue;
        if (!byDir.has(d.direction)) byDir.set(d.direction, new Set());
        byDir.get(d.direction).add(d.destination);
      }
      if (byDir.size < 2) { this._els.dirBar.hidden = true; return; }
      this._els.dirChips.innerHTML = "";
      for (const [dir, dests] of [...byDir.entries()].sort((a,b) => a[0]-b[0])) {
        const label = dir === 1 ? "H · Hinfahrt" : "R · Rückfahrt";
        const sub = [...dests].slice(0, 3).join(", ");
        const btn = document.createElement("button");
        btn.className = "dir-chip";
        btn.setAttribute("aria-pressed", this._dirFilter.has(dir) ? "true" : "false");
        btn.innerHTML = `<span class="gleis">${esc(label)}</span>
                         <span class="dest-list">${esc(sub)}</span>`;
        btn.addEventListener("click", () => {
          if (this._dirFilter.has(dir)) this._dirFilter.delete(dir);
          else this._dirFilter.add(dir);
          btn.setAttribute("aria-pressed", this._dirFilter.has(dir) ? "true" : "false");
          const pf = this._parsePlatformFilter(this._current?.platformFilter);
          this._els.rows.innerHTML = this._rowsHtml(this._applyDirFilter(this._lastDeps || [], pf));
        });
        this._els.dirChips.appendChild(btn);
      }
      this._els.dirBar.hidden = false;
    }

    async _loadDepartures() {
      if (!this._current) return;
      const types = this._current.filterTypes || this._config.types || "";
      const pf = this._parsePlatformFilter(this._current.platformFilter);
      try {
        const raw = await this._fetchRaw(this._current.globalId, types);
        this._lastDeps = raw;
        this._updateDirBar(raw);
        this._els.rows.innerHTML = this._rowsHtml(this._applyDirFilter(raw, pf));
      } catch (err) {
        this._error("Fehler beim Laden: " + esc(String(err)));
      }
    }

    // Listen-Layout: alle Favoriten untereinander
    async _loadAll() {
      const raws = await Promise.allSettled(
        this._favorites.map(f =>
          this._fetchRaw(f.globalId, f.filterTypes || this._config.types || ""))
      );
      this._els.rows.innerHTML = this._favorites.map((f, i) => {
        const tag = f.filterTypes    ? `<span class="tag">${esc(typesLabel(f.filterTypes))}</span>` : "";
        const plf = f.platformFilter
          ? `<span class="tag">${f.platformFilter.split(",").map(v => v === "1" ? "H" : v === "2" ? "R" : esc(v)).join("/")}</span>`
          : "";
        const head = `<div class="section-head"><h3>${esc(f.name)}</h3>${tag}${plf}
          <span class="place2">${esc(f.place || "")}</span></div>`;
        const res = raws[i];
        if (res.status !== "fulfilled") return head + '<div class="note err">Nicht erreichbar.</div>';
        const pf = this._parsePlatformFilter(f.platformFilter);
        const deps = this._applyDirFilter(res.value, pf);
        return head + this._rowsHtml(deps);
      }).join("");
    }

    _badge(label, type) {
      const shown = SHORT_LABELS[label] || label || "?";
      let bg = LINE_GRADIENTS[label] || LINE_COLORS[label] || TYPE_COLORS[type] || "#36428D";
      if (!LINE_GRADIENTS[label] && !LINE_COLORS[label] && /^X\d+/.test(label || "")) bg = EXPRESS_GREEN;
      const fg = (label === "S8") ? "#F8C300" : "#fff";
      const cls = shown.length > 4 ? "badge long" : "badge";
      return `<span class="${cls}" style="background:${bg};color:${fg}" title="${esc(label || "")}">${esc(shown)}</span>`;
    }

    _rowsHtml(deps) {
      if (!deps.length) {
        return '<div class="note">Keine Abfahrten.</div>';
      }
      const now = Date.now();
      return deps.map(d => {
        const mins = Math.max(0, Math.round((d.realtime - now) / 60000));
        const planned = new Date(d.planned).toLocaleTimeString("de-DE",
          { hour: "2-digit", minute: "2-digit" });
        const delay = d.delay > 0 ? ` <span class="delay">+${d.delay}</span>` : "";
        const sev = d.sev ? ' <span class="sev">SEV</span>' : "";
        const hasInfo = (d.infos && d.infos.length > 0) || (d.messages && d.messages.length > 0);
        const infoTip = hasInfo
          ? [...(d.infos||[]).map(i => i.message), ...(d.messages||[])].join(" · ")
          : "";
        const infoBadge = hasInfo
          ? `<span class="info-btn" title="${esc(infoTip)}">ⓘ</span>` : "";
        const occIcon = {"LOW":"🟢","MEDIUM":"🟡","HIGH":"🔴","FULL":"🔴"}[d.occupancy] || "";
        const platformTxt = d.platform != null
          ? (d.platformChanged ? `⚠ Gleis ${esc(d.platform)}` : `Gleis ${esc(d.platform)}`)
          : "";
        const minHtml = d.cancelled
          ? '<span class="min">entfällt</span>'
          : `<span class="min">${mins}<small>min</small></span>`;
        return `<div class="row${d.cancelled ? " cancelled" : ""}">
          ${this._badge(d.label, d.transportType)}
          <div class="dest">
            <div class="to">${esc(d.destination)}${infoBadge}</div>
            <div class="meta">${planned}${delay}${sev}${occIcon ? ' ' + occIcon : ''}</div>
          </div>
          <span class="platform${d.platformChanged ? ' platform-changed' : ''}">${platformTxt}</span>
          ${minHtml}
        </div>`;
      }).join("");
    }

    _error(msg) {
      this._els.rows.innerHTML = `<div class="note err">${msg}</div>`;
    }

    getCardSize() {
      const perStation = 1 + Math.ceil((Number(this._config?.limit) || 8) / 2);
      if (this._config?.layout === "list" && !this._config?.global_id) {
        return perStation * Math.max(1, (this._favorites || []).length || 2);
      }
      return perStation;
    }
  }

  customElements.define("mvg-abfahrten-card", MvgAbfahrtenCard);

  /* ---------------------------------------------------------------- Editor */

  const TYPE_OPTIONS = [
    { value: "UBAHN",        label: "U-Bahn" },
    { value: "SBAHN",        label: "S-Bahn" },
    { value: "TRAM",         label: "Tram" },
    { value: "BUS",          label: "Bus" },
    { value: "REGIONAL_BUS", label: "Regionalbus" },
    { value: "BAHN",         label: "Bahn" },
  ];

  const LABELS = {
    station: "Haltestelle",
    layout: "Darstellung der Favoriten",
    design: "Design",
    show_title: "Titel (Haltestellenname) anzeigen",
    show_clock: "Uhrzeit anzeigen",
    limit: "Anzahl Abfahrten",
    types: "Verkehrsmittel (leer = alle)",
    refresh: "Aktualisierung",
    api_url: "API-URL (leer = Standard)",
  };
  const HELPERS_TXT = {
    station: "Favoriten verwaltest du im Add-on (★) – inkl. Beförderungsart.",
    layout: "Tabs: eine Haltestelle, umschaltbar. Untereinander: alle Favoriten als eigene Blöcke.",
    design: "Dashboard-Theme passt sich deinem HA-Theme an.",
    api_url: "Standard: http://<ha-host>:8099",
  };
  const LAYOUT_OPTIONS = [
    { value: "tabs", label: "Tabs (umschaltbar)" },
    { value: "list", label: "Untereinander" },
  ];
  const DESIGN_OPTIONS = [
    { value: "auto",  label: "Dashboard-Theme (Standard)" },
    { value: "board", label: "Anzeigetafel (dunkel)" },
  ];

  const EDITOR_STYLE = `
    .search-wrap { position: relative; margin-bottom: 4px; }
    .search-wrap input {
      width: 100%; box-sizing: border-box;
      padding: 8px 12px; border-radius: 8px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--secondary-background-color, #f5f5f5);
      color: var(--primary-text-color); font-size: 14px;
      font-family: inherit; outline: none;
    }
    .search-wrap input:focus { border-color: var(--accent-color, #ff9800); }
    .search-drop {
      position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 99;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #ccc); border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15); overflow: hidden;
      max-height: 260px; overflow-y: auto; display: none;
    }
    .search-drop button {
      display: flex; width: 100%; align-items: center; gap: 8px;
      padding: 9px 12px; background: none; border: 0;
      border-bottom: 1px solid var(--divider-color, #eee);
      color: var(--primary-text-color); font-size: 13px;
      text-align: left; cursor: pointer;
    }
    .search-drop button:last-child { border-bottom: 0; }
    .search-drop button:hover { background: var(--secondary-background-color, #f5f5f5); }
    .search-drop .sname { flex: 1; }
    .search-drop .splace { color: var(--secondary-text-color, #727272); font-size: 12px; white-space: nowrap; }
    .selected-id {
      font-size: 11px; color: var(--secondary-text-color, #727272);
      padding: 2px 4px; font-family: monospace;
    }
  `;

  class MvgAbfahrtenCardEditor extends HTMLElement {

    set hass(h) { this._hass = h; this._render(); }

    setConfig(config) {
      this._config = Object.assign({}, config);
      this._apiUrl = (config.api_url ||
        `${location.protocol}//${location.hostname}:8099`).replace(/\/+$/, "");
      if (!this._favorites) this._loadFavorites();
      this._render();
    }

    async _loadFavorites() {
      try {
        const resp = await fetch(this._apiUrl + "/api/favorites");
        this._favorites = await resp.json();
        this._favError = false;
      } catch (e) {
        this._favorites = [];
        this._favError = true;
      }
      this._render();
    }

    async _searchStations(query) {
      if (query.length < 2) return [];
      try {
        const r = await fetch(this._apiUrl + "/api/search?q=" + encodeURIComponent(query));
        return await r.json();
      } catch { return []; }
    }

    _currentStationValue() {
      if (!this._config.global_id) return "__favs__";
      return (this._config.global_id) + "|" + (this._config.types || "") + "|";
    }

    _schema() {
      const current = this._currentStationValue();
      const stationOptions = [
        { value: "__favs__", label: "★ Alle Favoriten" },
        ...(this._favorites || []).map(f => ({
          value: favKey(f),
          label: f.name
            + (f.filterTypes    ? ` · ${typesLabel(f.filterTypes)}` : "")
            + (f.platformFilter
              ? ` · ${f.platformFilter.split(",").map(v => v === "1" ? "H" : v === "2" ? "R" : v).join("/")}`
              : "")
            + (f.place ? ` (${f.place})` : ""),
        })),
      ];
      if (current !== "__favs__" && !stationOptions.some(o => o.value === current)) {
        stationOptions.push({ value: current, label: "Aktuell: " + (this._config.title || this._config.global_id) });
      }
      const fields = [];
      if (!this._favError && this._favorites?.length) {
        fields.push({ name: "station", selector: { select: { mode: "dropdown", options: stationOptions } } });
      }
      if (current === "__favs__" && !this._favError) {
        fields.push({ name: "layout", selector: { select: { mode: "dropdown", options: LAYOUT_OPTIONS } } });
      }
      fields.push(
        { name: "design",     selector: { select: { mode: "dropdown", options: DESIGN_OPTIONS } } },
        { name: "show_title", selector: { boolean: {} } },
        { name: "show_clock", selector: { boolean: {} } },
        { name: "limit",      selector: { number: { min: 1, max: 20, step: 1, mode: "slider" } } },
        { name: "types",      selector: { select: { multiple: true, mode: "list", options: TYPE_OPTIONS } } },
        { name: "refresh",    selector: { number: { min: 20, max: 300, step: 5, mode: "box", unit_of_measurement: "s" } } },
        { name: "api_url",    selector: { text: {} } },
      );
      return fields;
    }

    _formData() {
      return {
        station: this._currentStationValue(),
        global_id: this._config.global_id || "",
        layout: this._config.layout || "tabs",
        design: this._config.design || "auto",
        show_title: this._config.show_title !== false,
        show_clock: this._config.show_clock !== false,
        limit: Number(this._config.limit) || 8,
        types: (this._config.types || "").split(",").map(s => s.trim()).filter(Boolean),
        refresh: Number(this._config.refresh) || 30,
        api_url: this._config.api_url || "",
      };
    }

    _render() {
      if (!this._hass || !this._config) return;

      if (!this._root) {
        this.innerHTML = `<style>${EDITOR_STYLE}</style>`;
        // Suchbereich für manuelle/feste Haltestelle
        this._searchWrap = document.createElement("div");
        this._searchWrap.className = "search-wrap";
        this._searchWrap.innerHTML = `
          <input type="text" placeholder="Haltestelle suchen …" autocomplete="off">
          <div class="search-drop"></div>
          <div class="selected-id"></div>`;
        this._searchInput = this._searchWrap.querySelector("input");
        this._searchDrop  = this._searchWrap.querySelector(".search-drop");
        this._selectedId  = this._searchWrap.querySelector(".selected-id");
        let debounce;
        this._searchInput.addEventListener("input", () => {
          clearTimeout(debounce);
          const q = this._searchInput.value.trim();
          if (q.length < 2) { this._searchDrop.style.display = "none"; return; }
          debounce = setTimeout(async () => {
            const results = await this._searchStations(q);
            this._renderSearchDrop(results);
          }, 300);
        });
        document.addEventListener("click", (e) => {
          if (!this._searchWrap.contains(e.target)) this._searchDrop.style.display = "none";
        }, { capture: true });

        this._form = document.createElement("ha-form");
        this._form.addEventListener("value-changed", (e) => this._valueChanged(e));
        this._root = document.createDocumentFragment();
        this.appendChild(this._searchWrap);
        this.appendChild(this._form);
      }

      // Such-Widget nur bei fester Haltestelle (oder wenn Favoriten nicht erreichbar) zeigen
      const showSearch = !this._favorites?.length || this._favError || !!this._config.global_id;
      this._searchWrap.style.display = showSearch ? "block" : "none";
      if (showSearch && this._config.global_id) {
        this._searchInput.placeholder = this._config.title || this._config.global_id;
        this._selectedId.textContent = this._config.global_id;
      } else if (showSearch) {
        this._searchInput.value = "";
        this._selectedId.textContent = "";
      }

      this._form.hass = this._hass;
      this._form.schema = this._schema();
      this._form.data = this._formData();
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.computeHelper = (s) => HELPERS_TXT[s.name] || "";
    }

    _renderSearchDrop(results) {
      this._searchDrop.innerHTML = "";
      if (!results.length) {
        this._searchDrop.innerHTML = '<button disabled style="opacity:.5">Keine Ergebnisse</button>';
      } else {
        for (const st of results) {
          const b = document.createElement("button");
          b.type = "button";
          b.innerHTML = `<span class="sname">${esc(st.name)}</span><span class="splace">${esc(st.place || "")}</span>`;
          b.addEventListener("click", () => {
            this._searchDrop.style.display = "none";
            this._searchInput.value = st.name;
            this._selectedId.textContent = st.globalId;
            // direkt ins Config übernehmen
            const cfg = Object.assign({}, this._config);
            cfg.global_id = st.globalId;
            cfg.title = st.name;
            this._config = cfg;
            this.dispatchEvent(new CustomEvent("config-changed", {
              detail: { config: cfg }, bubbles: true, composed: true,
            }));
            this._render();
          });
          this._searchDrop.appendChild(b);
        }
      }
      this._searchDrop.style.display = "block";
    }

    _valueChanged(e) {
      e.stopPropagation();
      const v = e.detail.value || {};
      const cfg = Object.assign({}, this._config);
      const prevStation = this._currentStationValue();
      const stationChanged = v.station !== undefined && v.station !== prevStation;

      if (v.station !== undefined) {
        if (v.station && v.station !== "__favs__") {
          const [gid, ftypes] = v.station.split("|");
          cfg.global_id = gid;
          const fav = (this._favorites || []).find(f => favKey(f) === v.station);
          cfg.title = fav ? fav.name : (this._config.title || gid);
          if (stationChanged && ftypes) cfg.types = ftypes;
          else if (stationChanged) delete cfg.types;
        } else {
          delete cfg.global_id; delete cfg.title;
          if (stationChanged) delete cfg.types;
        }
      }

      if (v.layout && v.layout !== "tabs") cfg.layout = v.layout; else delete cfg.layout;
      if (v.design && v.design !== "auto") cfg.design = v.design; else delete cfg.design;
      if (v.show_title === false) cfg.show_title = false; else delete cfg.show_title;
      if (v.show_clock === false) cfg.show_clock = false; else delete cfg.show_clock;

      cfg.limit = Number(v.limit) || 8;
      cfg.refresh = Number(v.refresh) || 30;

      if (!stationChanged) {
        const types = Array.isArray(v.types) ? v.types.filter(Boolean) : [];
        if (types.length) cfg.types = types.join(","); else delete cfg.types;
      }

      if ((v.api_url || "").trim()) cfg.api_url = v.api_url.trim(); else delete cfg.api_url;

      this._config = cfg;
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: cfg }, bubbles: true, composed: true,
      }));
      this._render();
    }
  }

  customElements.define("mvg-abfahrten-card-editor", MvgAbfahrtenCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mvg-abfahrten-card",
    name: "MVG Abfahrten",
    description: "Abfahrtstafel im Anzeigetafel-Stil, gespeist vom MVG-Abfahrten-Add-on (inkl. Favoriten).",
  });
})();
