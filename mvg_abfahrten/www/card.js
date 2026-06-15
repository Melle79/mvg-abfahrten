window.MVG_API_URL = null; // wird von run.sh durch interne IP ersetzt
/* MVG Abfahrten – Lovelace-Karte v2.2.25
 *
 * Wird vom Add-on selbst ausgeliefert (/local/mvg-abfahrten-card.js).
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
      grid-template-columns: minmax(52px, auto) 1fr;
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
    .to { font-size: 14.5px; font-weight: 500; display: flex; align-items: baseline; gap: 6px; }
    .to-dest { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { color: var(--mvg-muted); font-size: 11.5px; display: flex; align-items: center; gap: 4px; overflow: hidden; }
    .meta .delay { color: var(--mvg-red); font-weight: 700; flex-shrink: 0; }
    .meta .sev { color: var(--mvg-accent); font-weight: 700; flex-shrink: 0; }
    .meta .meta-time { flex-shrink: 0; }
    .meta .ticker-wrap {
      flex: 1; overflow: hidden; min-width: 0;
    }
    .ticker {
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      color: var(--mvg-accent);
      white-space: nowrap;
      padding-left: 100%;
      animation: ticker 20s linear infinite;
    }
    @keyframes ticker {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-100%); }
    }
    .platform { color: var(--mvg-muted); font-size: 12px; white-space: nowrap; }
    .platform-changed { color: var(--mvg-accent); font-weight: 700; }
    .min { text-align: right; color: var(--mvg-accent); font-size: 18px; font-weight: 700; min-width: 62px; }
    .min small { font-size: 10.5px; font-weight: 600; color: var(--mvg-muted); margin-left: 2px; }
    .cancelled .to { color: var(--mvg-muted); }
    .cancelled .to-dest { text-decoration: line-through; color: var(--mvg-muted); }
    .cancelled .min { color: var(--mvg-red); font-size: 13px; text-decoration: none; }
    .cancelled .platform { text-decoration: line-through; }
    .cancelled-text { color: var(--mvg-red); font-size: 13px; font-weight: 700; text-decoration: none !important; }
    .info-btn {
      background: none; border: 0; cursor: pointer; padding: 0 2px;
      color: var(--mvg-red); font-size: 12px; line-height: 1; vertical-align: middle;
    }
    .info-popup {
      position: absolute; z-index: 100; max-width: 280px;
      background: var(--card-background-color, #1e2125);
      border: 1px solid var(--divider-color, rgba(127,127,127,0.2));
      border-radius: 10px; padding: 10px 13px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      font-size: 12px; color: var(--primary-text-color); display: none;
      pointer-events: none;
    }
    .info-popup .info-title { font-weight: 700; margin-bottom: 5px; color: var(--mvg-accent); }
    .info-popup .info-item { margin-bottom: 4px; color: var(--secondary-text-color); }
    .info-popup .info-item b { color: var(--primary-text-color); }
    ha-card { position: relative; }
    .note { padding: 18px 16px; color: var(--mvg-muted); font-size: 13px; border-top: 1px solid var(--mvg-line); }
    .note.err { color: var(--mvg-red); }
    .data-status {
      width: 8px; height: 8px; border-radius: 50%;
      display: inline-block; flex-shrink: 0;
      box-shadow: 0 0 4px currentColor;
      vertical-align: middle;
    }
    .data-status.live        { background: #4caf50; color: #4caf50; }
    .data-status.cached      { background: #ff9800; color: #ff9800; }
    .data-status.unavailable { background: #f44336; color: #f44336; }
    .section-head .data-status { margin-left: 6px; }
    .filter-info {
      padding: 5px 16px 7px;
      font-size: 11px;
      color: var(--mvg-muted);
      border-bottom: 1px solid var(--mvg-line);
      line-height: 1.5;
    }
    .filter-info[hidden] { display: none; }
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
      this._config = Object.assign({ favorites: true, limit: 8, refresh: 60 }, config);
      // api_url: aus config oder später via hass.config.internal_url
      this._apiUrl = (config.api_url || `${location.protocol}//${location.hostname}:8099`).replace(/\/+$/, "");
      this._storageKey = "mvg-card:" + (config.global_id || config.plan_id || "favs");
      this._current = null;
      this._favorites = [];
      this._plan = null;

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
          <div class="filter-info" id="filterInfo" hidden></div>
          <div id="rows"><div class="note">Lade …</div></div>
          <div class="info-popup" id="infoPopup"></div>
        </ha-card>`;
      this._els = {
        card: this.shadowRoot.querySelector("ha-card"),
        head: this.shadowRoot.getElementById("head"),
        titleWrap: this.shadowRoot.getElementById("titleWrap"),
        name: this.shadowRoot.getElementById("name"),
        place: this.shadowRoot.getElementById("place"),
        clock:      this.shadowRoot.getElementById("clock"),
        chips: this.shadowRoot.getElementById("chips"),
        dirBar: this.shadowRoot.getElementById("dirBar"),
        dirChips: this.shadowRoot.getElementById("dirChips"),
        dirClear: this.shadowRoot.getElementById("dirClear"),
        filterInfo: this.shadowRoot.getElementById("filterInfo"),
        rows: this.shadowRoot.getElementById("rows"),
        infoPopup: this.shadowRoot.getElementById("infoPopup"),
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
      const refresh = Math.max(20, Number(this._config.refresh) || 60);
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
      this.shadowRoot.addEventListener("click", (e) => {
        const btn = e.target.closest(".info-btn");
        if (btn) { e.stopPropagation(); this._showInfoPopup(btn); }
        else if (this._els.infoPopup) this._els.infoPopup.style.display = "none";
      });
    }

    disconnectedCallback() {
      clearInterval(this._timer);
      clearInterval(this._clockTimer);
    }

    _refresh() {
      const planIds = this._config.plan_ids
        ? (Array.isArray(this._config.plan_ids) ? this._config.plan_ids : [this._config.plan_ids])
        : this._config.plan_id ? [this._config.plan_id] : [];
      if (planIds.length) this._loadPlan();
      else if (this._config.layout === "list" && !this._config.global_id) this._loadAll();
      else this._loadDepartures();
    }

    _tick() {
      const d = new Date();
      this._els.clock.textContent =
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0");
    }

    async _init() {
      // Plan-Modus: plan_id oder plan_ids konfiguriert
      const planIds = this._config.plan_ids
        ? (Array.isArray(this._config.plan_ids) ? this._config.plan_ids : [this._config.plan_ids])
        : this._config.plan_id ? [this._config.plan_id] : [];

      if (planIds.length) {
        try {
          const resp = await fetch(this._apiUrl + "/api/plans");
          const allPlans = await resp.json();
          this._plans = planIds.map(id => allPlans.find(p => p.id === id)).filter(Boolean);
          if (!this._plans.length) {
            this._error("Keine Pläne gefunden. Bitte plan_id in der Kartenkonfiguration prüfen.");
            return;
          }
          this._els.dirBar.hidden = true;
          if (this._plans.length === 1 || this._config.layout === "list") {
            // Einzelplan oder Untereinander
            this._els.name.textContent = this._config.title || (this._plans.length === 1 ? this._plans[0].name : "MVG Abfahrten");
            this._els.place.textContent = "";
            this._els.chips.hidden = true;
            this._loadPlan();
          } else {
            // Mehrere Pläne als Tabs
            this._currentPlanIdx = 0;
            this._renderPlanChips();
            this._els.name.textContent = this._config.title || this._plans[0].name;
            this._loadPlan();
          }
        } catch(err) {
          this._error("Add-on-API nicht erreichbar: " + esc(String(err)));
        }
        return;
      }
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

    _planFilterLabel(plan) {
      const entries = plan.entries || [];
      if (!entries.length) return "";
      const parts = entries.map(e => {
        const bits = [];
        if (e.stationName) bits.push(e.stationName);
        if (e.lines) bits.push(...e.lines.split(",").filter(Boolean));
        if (e.direction) bits.push(e.direction);
        return bits.join(" · ");
      });
      return parts.join(" | ");
    }

    _renderPlanChips() {
      this._els.chips.hidden = false;
      this._els.chips.innerHTML = "";
      this._plans.forEach((plan, i) => {
        const b = document.createElement("button");
        b.className = "chip" + (i === (this._currentPlanIdx ?? 0) ? " on" : "");
        b.dataset.planId = plan.id;
        b.textContent = plan.name;
        b.addEventListener("click", () => {
          this._currentPlanIdx = i;
          this._els.name.textContent = this._config.title || plan.name;
          this._renderPlanChips();
          this._loadPlan();
        });
        this._els.chips.appendChild(b);
      });
    }

    async _loadPlan() {
      if (!this._plans?.length) return;
      const limit = this._config.limit || 8;

      if (this._config.layout === "list" && this._plans.length > 1) {
        // Alle Pläne untereinander
        const results = await Promise.allSettled(
          this._plans.map(p => fetch(this._apiUrl + "/api/plans/" +
            encodeURIComponent(p.id) + "/departures?limit=" + limit).then(r => r.json()))
        );
        this._els.rows.innerHTML = this._plans.map((plan, i) => {
          const res = results[i];
          const src = res.status === "fulfilled"
            ? (res.value.dataSource || "live") : "unavailable";
          const lineStatus = res.status === "fulfilled" ? (res.value.lineStatus || {}) : {};
          const deps = res.status === "fulfilled" ? (res.value.departures || []) : [];
          const showStatus  = this._config.show_status !== false;
          const showFilter  = this._config.show_filter !== false;
          const showStation = this._config.show_station !== false;
          const titles = { live: "Live-Daten", cached: "Veraltete Daten (API leer)", unavailable: "Keine Daten verfügbar" };

          let filterHtml = "";
          if (showFilter) {
            const byLine = new Map();
            for (const d of deps) {
              if (!byLine.has(d.label)) byLine.set(d.label, { dests: new Set(), stations: new Set() });
              byLine.get(d.label).dests.add(d.destination);
              byLine.get(d.label).stations.add(d.stationName);
            }
            const parts = [...byLine.entries()].map(([label, {dests, stations}]) => {
              const lsrc = lineStatus[label] || lineStatus["*"] || src;
              const bubble = showStatus
                ? `<span class="data-status ${lsrc}" title="${titles[lsrc]||lsrc}" style="margin-right:4px;flex-shrink:0"></span>`
                : "";
              const destList = [...dests].map(d=>esc(d)).join(", ");
              const stationTxt = showStation && stations.size
                ? ` <span style="color:var(--mvg-muted)">(${[...stations].map(s=>esc(s)).join(", ")})</span>`
                : "";
              return `<span style="display:inline-flex;align-items:center;white-space:nowrap;margin-right:12px">${bubble}<b>${esc(label)}</b>${stationTxt}&thinsp;·&thinsp;${destList}</span>`;
            });
            if (parts.length) filterHtml = `<div style="display:flex;flex-wrap:wrap;gap:4px 0;margin-top:3px">${parts.join("")}</div>`;
          }

          const head = `<div class="section-head"><h3>${esc(plan.name)}</h3>${filterHtml}</div>`;
          if (res.status !== "fulfilled") return head + '<div class="note err">Nicht erreichbar.</div>';
          return head + (deps.length ? this._planRowsHtml(deps) : '<div class="note">Keine Abfahrten.</div>');
        }).join("");
        return;
      }

      // Einzelplan oder Tab-Modus
      const plan = this._plans[this._currentPlanIdx ?? 0];
      if (!plan) return;
      try {
        const resp = await fetch(this._apiUrl + "/api/plans/" +
          encodeURIComponent(plan.id) + "/departures?limit=" + limit);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();
        const deps = data.departures || [];
        const lineStatus = data.lineStatus || {};
        if (this._els.dataStatus) this._els.dataStatus.hidden = true;
        const tabBubble = this.shadowRoot.getElementById("status-" + plan.id);
        if (tabBubble) tabBubble.hidden = true;

        this._els.rows.innerHTML = deps.length
          ? this._planRowsHtml(deps)
          : '<div class="note">Keine Abfahrten für diesen Plan.</div>';

        // Filter-Info: alle Linien, Status pro Linie, nebeneinander wenn Platz
        if (this._config.show_filter !== false && this._els.filterInfo) {
          const byLine = new Map();
          for (const d of deps) {
            if (!byLine.has(d.label)) byLine.set(d.label, { dests: new Set(), stations: new Set() });
            byLine.get(d.label).dests.add(d.destination);
            byLine.get(d.label).stations.add(d.stationName);
          }
          const showStation = this._config.show_station !== false;
          const showStatus  = this._config.show_status !== false;
          const titles = { live: "Live-Daten", cached: "Veraltete Daten (API leer)", unavailable: "Keine Daten verfügbar" };
          const parts = [...byLine.entries()].map(([label, {dests, stations}]) => {
            const src = lineStatus[label] || lineStatus["*"] || "live";
            const bubble = showStatus
              ? `<span class="data-status ${src}" title="${titles[src] || src}" style="margin-right:4px;flex-shrink:0"></span>`
              : "";
            const destList = [...dests].map(d => esc(d)).join(", ");
            const stationTxt = showStation && stations.size
              ? ` <span style="color:var(--mvg-muted)">(${[...stations].map(s=>esc(s)).join(", ")})</span>`
              : "";
            return `<span style="display:inline-flex;align-items:center;white-space:nowrap;margin-right:12px">${bubble}<b>${esc(label)}</b>${stationTxt}&thinsp;·&thinsp;${destList}</span>`;
          });
          if (parts.length) {
            this._els.filterInfo.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:4px 0">${parts.join("")}</div>`;
            this._els.filterInfo.hidden = false;
          } else {
            this._els.filterInfo.hidden = true;
          }
        } else if (this._els.filterInfo) {
          this._els.filterInfo.hidden = true;
        }
      } catch(err) {
        this._error("Fehler beim Laden: " + esc(String(err)));
      }
    }

    _planRowsHtml(deps) {
      const now = Date.now();
      return deps.map(d => {
        const mins = Math.max(0, Math.round((d.realtime - now) / 60000));
        const planned = new Date(d.planned).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const delay = d.delay > 0 ? ` <span class="delay">+${d.delay}</span>` : "";
        const sev = d.sev ? ' <span class="sev">SEV</span>' : "";
        const earlyTerm = (d.infos||[]).find(x => x.type === "EARLY_TERMINATION");
        const destHtml = earlyTerm
          ? `<span style="text-decoration:line-through;color:var(--mvg-red)">${esc(d.destination)}</span> <span style="color:var(--mvg-accent)">${esc(earlyTerm.message.replace(/^Fährt nur bis /i,""))}</span>`
          : esc(d.destination);
        const hasInfo = (d.infos||[]).some(x => x.type !== "EARLY_TERMINATION") || (d.messages||[]).length > 0;
        const _infoItems = [...(d.infos||[]).filter(x=>x.type!=="EARLY_TERMINATION").map(i=>i.type+"::"+i.message), ...(d.messages||[]).map(m=>"Info::"+m)].join("|||");
        const showTicker = this._config.show_ticker === true || this._config.show_ticker === "ticker";
        const infoBadge = hasInfo && !showTicker ? `<button class="info-btn" data-title="${esc(d.label+" → "+d.destination)}" data-items="${esc(_infoItems)}">ⓘ</button>` : "";
        const platTxt = d.platform != null ? (d.platformChanged ? `⚠ ${esc(d.platform)}` : `Gleis ${esc(d.platform)}`) : "";
        const stationTxt = this._config.show_station !== false && d.stationName
          ? `${esc(d.stationName)} · ` : "";
        const swap = this._config.swap_times;
        const minHtml = d.cancelled
          ? '<span class="min cancelled-text">entfällt</span>'
          : swap
            ? `<span class="min" style="font-size:18px">${planned}</span>`
            : `<span class="min">${mins}<small>min</small></span>`;
        const metaTimeTxt = swap
          ? `${stationTxt}${mins}<small style="font-size:10px;margin-left:2px">min</small>${delay}${sev}`
          : `${stationTxt}${planned}${delay}${sev}`;
        const tickerMode = this._config.show_ticker;
        const isTicker = tickerMode === true || tickerMode === "ticker";
        const tickerText = isTicker && hasInfo
          ? [...(d.infos||[]).filter(x=>x.type!=="EARLY_TERMINATION").map(i=>i.message), ...(d.messages||[])].join(" · ")
          : "";
        const metaHtml = `<div class="meta">
          <span class="meta-time">${metaTimeTxt}</span>
          ${tickerText ? `<span class="ticker-wrap"><span class="ticker">${esc(tickerText)}</span></span>` : ""}
        </div>`;
        return `<div class="row${d.cancelled ? " cancelled" : ""}">
          ${this._badge(d.label, d.transportType)}
          <div class="dest">
            <div class="to">
              <span class="to-dest">${destHtml}${infoBadge}</span>
              ${platTxt ? `<span class="platform${d.platformChanged ? " platform-changed" : ""}" style="font-size:12px;flex-shrink:0">${platTxt}</span>` : ""}
              ${minHtml}
            </div>
            ${metaHtml}
          </div>
        </div>`;
      }).join("");
    }

    _showInfoPopup(btn) {
      const popup = this._els.infoPopup;
      if (!popup) return;
      const TYPE_LABELS = { INCIDENT:"Störung", EARLY_TERMINATION:"Vorzeitige Endstation", DISRUPTION:"Betriebsstörung", INFORMATION:"Information", Info:"Info" };
      const title = btn.dataset.title || "";
      const items = btn.dataset.items || "";
      popup.innerHTML = `<div class="info-title">${esc(title)}</div>` +
        items.split("|||").filter(Boolean).map(item => {
          const sep = item.indexOf("::");
          const type = item.slice(0, sep);
          const msg  = item.slice(sep + 2);
          return `<div class="info-item"><b>${esc(TYPE_LABELS[type] || type)}:</b> ${esc(msg)}</div>`;
        }).join("");
      popup.style.display = "block";
      const r = btn.getBoundingClientRect();
      const cr = this.shadowRoot.host.getBoundingClientRect();
      let left = r.left - cr.left;
      let top = r.bottom - cr.top + 4;
      if (left + 280 > cr.width - 8) left = cr.width - 280 - 8;
      popup.style.left = Math.max(4, left) + "px";
      popup.style.top = top + "px";
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
        const _infoItems2 = [...(d.infos||[]).map(i=>i.type+"::"+i.message), ...(d.messages||[]).map(m=>"Info::"+m)].join("|||");
        const infoBadge = hasInfo && !this._config.show_ticker
          ? `<button class="info-btn" data-title="${esc(d.label+" → "+d.destination)}" data-items="${esc(_infoItems2)}">ⓘ</button>` : "";
        const occIcon = {"LOW":"🟢","MEDIUM":"🟡","HIGH":"🔴","FULL":"🔴"}[d.occupancy] || "";
        const platformTxt = d.platform != null
          ? (d.platformChanged ? `⚠ Gleis ${esc(d.platform)}` : `Gleis ${esc(d.platform)}`)
          : "";
        const swap = this._config.swap_times;
        const minHtml = d.cancelled
          ? '<span class="min cancelled-text">entfällt</span>'
          : swap
            ? `<span class="min" style="font-size:18px">${planned}</span>`
            : `<span class="min">${mins}<small>min</small></span>`;
        const tickerMode2 = this._config.show_ticker;
        const isTicker2 = tickerMode2 === true || tickerMode2 === "ticker";
        const tickerText2 = isTicker2 && hasInfo
          ? [...(d.infos||[]).filter(x=>x.type!=="EARLY_TERMINATION").map(i=>i.message), ...(d.messages||[])].join(" · ")
          : "";
        const metaTimeTxt2 = swap
          ? `${mins}<small style="font-size:10px;margin-left:2px">min</small>${delay}${sev}${occIcon ? ' ' + occIcon : ''}`
          : `${planned}${delay}${sev}${occIcon ? ' ' + occIcon : ''}`;
        const metaHtml2 = `<div class="meta">
          <span class="meta-time">${metaTimeTxt2}</span>
          ${tickerText2 ? `<span class="ticker-wrap"><span class="ticker">${esc(tickerText2)}</span></span>` : ""}
        </div>`;
        return `<div class="row${d.cancelled ? " cancelled" : ""}">
          ${this._badge(d.label, d.transportType)}
          <div class="dest">
            <div class="to">
              <span class="to-dest">${esc(d.destination)}${infoBadge}</span>
              ${platformTxt ? `<span class="platform${d.platformChanged ? ' platform-changed' : ''}" style="font-size:12px;flex-shrink:0">${platformTxt}</span>` : ""}
              ${minHtml}
            </div>
            ${metaHtml2}
          </div>
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

  if (!customElements.get("mvg-abfahrten-card"))
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
    plan_ids: "Abfahrtspläne",
    station: "Haltestelle / Favorit",
    layout: "Darstellung",
    design: "Design",
    show_title:   "Titel anzeigen",
    show_clock:   "Uhrzeit anzeigen",
    show_station: "Haltestellenname unter Ziel anzeigen",
    show_filter:  "Filter-Info unter Plan-Tabs anzeigen",
    show_ticker:  "Störungsanzeige (Aus = Info-Symbol ⓘ, Laufschrift = scrollender Text)",
    show_status:  "Datenstatus-Bubble anzeigen (🟢 Live · 🟠 Veraltete Daten · 🔴 Keine Daten)",
    swap_times:   "Uhrzeit und Minuten tauschen (Uhrzeit groß rechts)",
    limit: "Anzahl Abfahrten",
    refresh: "Aktualisierung",
    api_url: "API-URL – Pflichtfeld bei Nutzung über Nabu Casa",
  };
  const HELPERS_TXT = {
    plan_ids: "Mehrere Pläne auswählen → Tabs oder Untereinander. Pläne erstellst du unter MVG → Pläne.",
    station: "Favoriten verwaltest du im Add-on (★) – inkl. Beförderungsart.",
    layout: "Tabs: umschaltbar. Untereinander: alle Blöcke.",
    design: "Dashboard-Theme passt sich deinem HA-Theme an.",
    api_url: "z.B. http://192.168.0.222:8099 (HA-Host-IP + Port)",
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
    .sort-widget {
      margin-top: 8px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      overflow: hidden;
    }
    .sort-widget-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color);
      padding: 8px 12px 4px;
    }
    .sort-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-top: 1px solid var(--divider-color, #eee);
      background: var(--card-background-color, #fff);
    }
    .sort-item:first-of-type { border-top: 0; }
    .sort-name { flex: 1; font-size: 13px; color: var(--primary-text-color); }
    .sort-btn {
      background: none; border: 0; cursor: pointer;
      color: var(--secondary-text-color); font-size: 16px;
      padding: 2px 6px; border-radius: 4px; line-height: 1;
    }
    .sort-btn:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
    .sort-btn:disabled { opacity: 0.3; cursor: default; }
  `;

  class MvgAbfahrtenCardEditor extends HTMLElement {

    set hass(h) {
      this._hass = h;
      this._render();
    }

    _apiNotReachable() {
      return `<div class="err" style="padding:16px;text-align:center">
        <b>Add-on-API nicht erreichbar</b><br>
        <span style="font-size:12px;color:var(--mvg-muted)">
          Bitte <code>api_url: http://192.168.0.222:8099</code> in der Karten-Konfiguration setzen.
        </span>
      </div>`;
    }

    setConfig(config) {
      this._config = Object.assign({}, config);
      // api_url: aus config oder später via hass.config.internal_url in set hass()
      if (config.api_url) {
        this._apiUrl = config.api_url.replace(/\/+$/, "");
      } else if (window.MVG_API_URL) {
        // Interne IP – von run.sh beim Start eingesetzt
        this._apiUrl = window.MVG_API_URL.replace(/\/+$/, "");
      } else {
        this._apiUrl = `${location.protocol}//${location.hostname}:8099`;
      }
      if (!this._favorites) this._loadFavorites();
      this._render();
    }

    async _loadFavorites() {
      try {
        const [favResp, planResp] = await Promise.all([
          fetch(this._apiUrl + "/api/favorites"),
          fetch(this._apiUrl + "/api/plans"),
        ]);
        this._favorites = await favResp.json();
        this._plans = await planResp.json();
        this._favError = false;
      } catch (e) {
        this._favorites = [];
        this._plans = [];
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
      const planOptions = (this._plans || []).map(p => ({ value: p.id, label: p.name }));
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
      const hasPlanIds = this._config.plan_ids?.length;
      const fields = [];
      if (planOptions.length) {
        fields.push({ name: "plan_ids", selector: { select: { multiple: true, mode: "list", options: planOptions } } });
      }
      if (hasPlanIds) {
        // Layout nur bei mehreren Plänen sinnvoll
        if ((this._config.plan_ids?.length || 0) > 1) {
          fields.push({ name: "layout", selector: { select: { mode: "dropdown", options: LAYOUT_OPTIONS } } });
        }
      } else {
        if (!this._favError && this._favorites?.length) {
          fields.push({ name: "station", selector: { select: { mode: "dropdown", options: stationOptions } } });
        }
        if (current === "__favs__" && !this._favError) {
          fields.push({ name: "layout", selector: { select: { mode: "dropdown", options: LAYOUT_OPTIONS } } });
        }
      }
      fields.push(
        { name: "design",     selector: { select: { mode: "dropdown", options: DESIGN_OPTIONS } } },
        { name: "show_title",   selector: { boolean: {} } },
        { name: "show_clock",   selector: { boolean: {} } },
        { name: "show_station", selector: { boolean: {} } },
        { name: "show_filter",  selector: { boolean: {} } },
        { name: "show_ticker", selector: { select: { options: [
          { value: "off",    label: "Aus" },
          { value: "ticker", label: "Laufschrift" },
        ], mode: "dropdown" } } },
        { name: "show_status",  selector: { boolean: {} } },
        { name: "swap_times",   selector: { boolean: {} } },
        { name: "limit",      selector: { number: { min: 1, max: 20, step: 1, mode: "slider" } } },
        { name: "refresh",    selector: { number: { min: 20, max: 300, step: 5, mode: "box", unit_of_measurement: "s" } } },
        { name: "api_url",    selector: { text: {} } },
      );
      return fields;
    }

    _formData() {
      return {
        plan_ids: Array.isArray(this._config.plan_ids)
          ? (this._plans?.length
              ? this._config.plan_ids.filter(id => this._plans.some(p => p.id === id))
              : this._config.plan_ids)
          : [],
        station: this._currentStationValue(),
        layout: this._config.layout || "tabs",
        design: this._config.design || "auto",
        show_title:   this._config.show_title !== false,
        show_clock:   this._config.show_clock !== false,
        show_station: this._config.show_station !== false,
        show_filter:  this._config.show_filter !== false,
        show_ticker:  this._config.show_ticker || "off",
        show_status:  this._config.show_status !== false,
        swap_times:   this._config.swap_times === true,
        limit: Number(this._config.limit) || 8,
        refresh: Number(this._config.refresh) || 60,
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
        this._sortWrap = document.createElement("div");
        this._root = document.createDocumentFragment();
        this.appendChild(this._searchWrap);
        this.appendChild(this._form);
        this.appendChild(this._sortWrap);
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

      // Sortier-Widget nur wenn mehrere Pläne gewählt
      this._renderSortWidget();
    }

    _renderSortWidget() {
      const ids = Array.isArray(this._config.plan_ids) ? this._config.plan_ids : [];
      const planMap = new Map((this._plans || []).map(p => [p.id, p.name]));
      // Unbekannte IDs nur herausfiltern wenn Pläne bereits geladen sind
      const validIds = this._plans?.length
        ? ids.filter(id => planMap.has(id))
        : ids;
      if (this._plans?.length && validIds.length !== ids.length) {
        // Config bereinigen
        const cfg = Object.assign({}, this._config, { plan_ids: validIds });
        this._config = cfg;
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: cfg }, bubbles: true, composed: true,
        }));
      }
      if (validIds.length < 2) { this._sortWrap.innerHTML = ""; return; }
      this._sortWrap.innerHTML = `<style>${EDITOR_STYLE}</style>
        <div class="sort-widget">
          <div class="sort-widget-label">Reihenfolge der Pläne</div>
          ${validIds.map((id, i) => `
            <div class="sort-item">
              <span class="sort-name">${esc(planMap.get(id) || id)}</span>
              <button class="sort-btn" data-idx="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>↑</button>
              <button class="sort-btn" data-idx="${i}" data-dir="1" ${i === validIds.length - 1 ? "disabled" : ""}>↓</button>
            </div>`).join("")}
        </div>`;
      this._sortWrap.querySelectorAll(".sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx);
          const dir = parseInt(btn.dataset.dir);
          const newIds = [...validIds];
          const tmp = newIds[idx];
          newIds[idx] = newIds[idx + dir];
          newIds[idx + dir] = tmp;
          const cfg = Object.assign({}, this._config, { plan_ids: newIds });
          this._config = cfg;
          this.dispatchEvent(new CustomEvent("config-changed", {
            detail: { config: cfg }, bubbles: true, composed: true,
          }));
          this._renderSortWidget();
        });
      });
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

      // Plan-Modus
      if (v.plan_ids !== undefined) {
        const ids = Array.isArray(v.plan_ids) ? v.plan_ids.filter(Boolean) : [];
        if (ids.length) {
          cfg.plan_ids = ids;
          delete cfg.global_id; delete cfg.types;
        } else {
          delete cfg.plan_ids;
        }
      }

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
      if (v.show_title   === false) cfg.show_title   = false; else delete cfg.show_title;
      if (v.show_clock   === false) cfg.show_clock   = false; else delete cfg.show_clock;
      if (v.show_station === false) cfg.show_station = false; else delete cfg.show_station;
      if (v.show_filter  === false) cfg.show_filter  = false; else delete cfg.show_filter;
      if (v.show_ticker && v.show_ticker !== "off") cfg.show_ticker = v.show_ticker; else delete cfg.show_ticker;
      if (v.show_status  === false) cfg.show_status  = false; else delete cfg.show_status;
      if (v.swap_times   === true)  cfg.swap_times   = true;  else delete cfg.swap_times;

      cfg.limit   = Number(v.limit)   || 8;
      cfg.refresh = Number(v.refresh) || 60;

      if ((v.api_url || "").trim()) cfg.api_url = v.api_url.trim(); else delete cfg.api_url;

      this._config = cfg;
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: cfg }, bubbles: true, composed: true,
      }));
      this._render();
    }
  }

  if (!customElements.get("mvg-abfahrten-card-editor"))
    customElements.define("mvg-abfahrten-card-editor", MvgAbfahrtenCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mvg-abfahrten-card",
    name: "MVG Abfahrten",
    description: "Abfahrtstafel im Anzeigetafel-Stil, gespeist vom MVG-Abfahrten-Add-on (inkl. Favoriten).",
  });
})();
