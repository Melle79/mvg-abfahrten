/* MVG Abfahrten – Lovelace-Karte v1.2.0
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
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  const STYLE = `
    :host { display: block; }
    ha-card {
      background: #0F1A29; color: #EDF2F8; overflow: hidden;
      font-variant-numeric: tabular-nums;
    }
    .head {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px 10px;
    }
    .head h2 { margin: 0; font-size: 16px; font-weight: 700; }
    .head .place { color: #7E92AB; font-size: 12.5px; }
    .head .clock { margin-left: auto; color: #FFB300; font-size: 16px; font-weight: 600; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
    .chip {
      padding: 4px 11px; border-radius: 999px; cursor: pointer;
      border: 1px solid #1E2E44; background: #131F30;
      color: #7E92AB; font-size: 12.5px; font-weight: 600; font-family: inherit;
    }
    .chip.on { color: #EDF2F8; border-color: #FFB300; background: rgba(255,179,0,0.08); }
    .chip:focus-visible { outline: 2px solid #3D7BD9; outline-offset: 1px; }
    .row {
      display: grid; align-items: center;
      grid-template-columns: 52px 1fr auto auto;
      gap: 10px; padding: 9px 16px;
      border-top: 1px solid #1E2E44;
    }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 42px; padding: 3px 5px; border-radius: 6px;
      font-weight: 800; font-size: 13.5px; color: #fff;
    }
    .dest { min-width: 0; }
    .to { font-size: 14.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { color: #7E92AB; font-size: 11.5px; }
    .meta .delay { color: #E5443B; font-weight: 700; }
    .meta .sev { color: #FFB300; font-weight: 700; }
    .platform { color: #7E92AB; font-size: 12px; white-space: nowrap; }
    .min { text-align: right; color: #FFB300; font-size: 18px; font-weight: 700; min-width: 62px; }
    .min small { font-size: 10.5px; font-weight: 600; color: #7E92AB; margin-left: 2px; }
    .cancelled .to { text-decoration: line-through; color: #7E92AB; }
    .cancelled .min { color: #E5443B; font-size: 13px; }
    .note { padding: 18px 16px; color: #7E92AB; font-size: 13px; border-top: 1px solid #1E2E44; }
    .note.err { color: #E5443B; }
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
          <div class="head">
            <div><h2 id="name">MVG Abfahrten</h2><div class="place" id="place"></div></div>
            <div class="clock" id="clock"></div>
          </div>
          <div class="chips" id="chips" hidden></div>
          <div id="rows"><div class="note">Lade …</div></div>
        </ha-card>`;
      this._els = {
        name: this.shadowRoot.getElementById("name"),
        place: this.shadowRoot.getElementById("place"),
        clock: this.shadowRoot.getElementById("clock"),
        chips: this.shadowRoot.getElementById("chips"),
        rows: this.shadowRoot.getElementById("rows"),
      };
    }

    connectedCallback() {
      this._init();
      const refresh = Math.max(20, Number(this._config.refresh) || 30);
      this._timer = setInterval(() => {
        if (!document.hidden) this._loadDepartures();
      }, refresh * 1000);
      this._clockTimer = setInterval(() => this._tick(), 1000);
      this._tick();
    }

    disconnectedCallback() {
      clearInterval(this._timer);
      clearInterval(this._clockTimer);
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
        };
        this._renderHead();
        this._loadDepartures();
        return;
      }
      // Favoriten aus dem Add-on
      try {
        const resp = await fetch(this._apiUrl + "/api/favorites");
        this._favorites = await resp.json();
      } catch (err) {
        this._error("Add-on-API nicht erreichbar (" + esc(this._apiUrl) + "). Läuft das Add-on und ist Port 8099 freigegeben?");
        return;
      }
      if (!this._favorites.length) {
        this._error("Keine Favoriten vorhanden – im Add-on eine Haltestelle suchen und mit ★ speichern.");
        return;
      }
      const savedId = localStorage.getItem(this._storageKey);
      this._current = this._favorites.find(f => f.globalId === savedId) || this._favorites[0];
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
        b.className = "chip" + (f.globalId === this._current.globalId ? " on" : "");
        b.textContent = f.name;
        b.addEventListener("click", () => {
          this._current = f;
          localStorage.setItem(this._storageKey, f.globalId);
          this._renderChips();
          this._renderHead();
          this._els.rows.innerHTML = '<div class="note">Lade …</div>';
          this._loadDepartures();
        });
        this._els.chips.appendChild(b);
      }
    }

    _renderHead() {
      this._els.name.textContent = this._current.name;
      this._els.place.textContent = this._current.place || "";
    }

    async _loadDepartures() {
      if (!this._current) return;
      const params = new URLSearchParams({ limit: this._config.limit });
      if (this._config.types) params.set("types", this._config.types);
      try {
        const resp = await fetch(this._apiUrl + "/api/departures/" +
          encodeURIComponent(this._current.globalId) + "?" + params);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();
        this._renderRows(data.departures || []);
      } catch (err) {
        this._error("MVG-Daten nicht erreichbar – nächster Versuch beim Refresh.");
      }
    }

    _badge(label, type) {
      let bg = LINE_GRADIENTS[label] || LINE_COLORS[label] || TYPE_COLORS[type] || "#36428D";
      if (!LINE_GRADIENTS[label] && !LINE_COLORS[label] && /^X\d+/.test(label || "")) bg = EXPRESS_GREEN;
      const fg = (label === "S8") ? "#F8C300" : "#fff";
      return `<span class="badge" style="background:${bg};color:${fg}">${esc(label || "?")}</span>`;
    }

    _renderRows(deps) {
      if (!deps.length) {
        this._els.rows.innerHTML = '<div class="note">Keine Abfahrten.</div>';
        return;
      }
      const now = Date.now();
      this._els.rows.innerHTML = deps.map(d => {
        const mins = Math.max(0, Math.round((d.realtime - now) / 60000));
        const planned = new Date(d.planned).toLocaleTimeString("de-DE",
          { hour: "2-digit", minute: "2-digit" });
        const delay = d.delay > 0 ? ` <span class="delay">+${d.delay}</span>` : "";
        const sev = d.sev ? ' <span class="sev">SEV</span>' : "";
        const minHtml = d.cancelled
          ? '<span class="min">entfällt</span>'
          : `<span class="min">${mins}<small>min</small></span>`;
        return `<div class="row${d.cancelled ? " cancelled" : ""}">
          ${this._badge(d.label, d.transportType)}
          <div class="dest">
            <div class="to">${esc(d.destination)}</div>
            <div class="meta">${planned}${delay}${sev}</div>
          </div>
          <span class="platform">${d.platform ? "Gleis " + esc(d.platform) : ""}</span>
          ${minHtml}
        </div>`;
      }).join("");
    }

    _error(msg) {
      this._els.rows.innerHTML = `<div class="note err">${msg}</div>`;
    }

    getCardSize() {
      return 1 + Math.ceil((Number(this._config?.limit) || 8) / 2);
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
    limit: "Anzahl Abfahrten",
    types: "Verkehrsmittel (leer = alle)",
    refresh: "Aktualisierung",
    api_url: "API-URL (leer = Standard)",
  };
  const HELPERS_TXT = {
    station: "Favoriten verwaltest du im Add-on (★).",
    api_url: "Standard: http://<ha-host>:8099",
  };

  class MvgAbfahrtenCardEditor extends HTMLElement {

    set hass(h) { this._hass = h; this._render(); }

    setConfig(config) {
      this._config = Object.assign({}, config);
      if (!this._favorites) this._loadFavorites();
      this._render();
    }

    async _loadFavorites() {
      const apiUrl = (this._config.api_url ||
        `${location.protocol}//${location.hostname}:8099`).replace(/\/+$/, "");
      try {
        const resp = await fetch(apiUrl + "/api/favorites");
        this._favorites = await resp.json();
        this._favError = false;
      } catch (e) {
        this._favorites = [];
        this._favError = true;
      }
      this._render();
    }

    _schema() {
      const stationOptions = [
        { value: "__favs__", label: "★ Alle Favoriten (umschaltbare Chips)" },
        ...(this._favorites || []).map(f => ({
          value: f.globalId,
          label: f.name + (f.place ? ` (${f.place})` : ""),
        })),
      ];
      const stationField = this._favError
        ? { name: "global_id", selector: { text: {} } } // Fallback: Global ID tippen
        : { name: "station", selector: { select: { mode: "dropdown", options: stationOptions } } };
      return [
        stationField,
        { name: "limit",   selector: { number: { min: 1, max: 20, step: 1, mode: "slider" } } },
        { name: "types",   selector: { select: { multiple: true, mode: "list", options: TYPE_OPTIONS } } },
        { name: "refresh", selector: { number: { min: 20, max: 300, step: 5, mode: "box", unit_of_measurement: "s" } } },
        { name: "api_url", selector: { text: {} } },
      ];
    }

    _formData() {
      return {
        station: this._config.global_id || "__favs__",
        global_id: this._config.global_id || "",
        limit: Number(this._config.limit) || 8,
        types: (this._config.types || "").split(",").map(s => s.trim()).filter(Boolean),
        refresh: Number(this._config.refresh) || 30,
        api_url: this._config.api_url || "",
      };
    }

    _render() {
      if (!this._hass || !this._config) return;
      if (!this._form) {
        this.innerHTML = "";
        this._form = document.createElement("ha-form");
        this._form.addEventListener("value-changed", (e) => this._valueChanged(e));
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = this._schema();
      this._form.data = this._formData();
      this._form.computeLabel = (s) => LABELS[s.name] || (s.name === "global_id" ? "Global ID (z. B. de:09184:2400)" : s.name);
      this._form.computeHelper = (s) => HELPERS_TXT[s.name] || "";
    }

    _valueChanged(e) {
      e.stopPropagation();
      const v = e.detail.value || {};
      const cfg = Object.assign({}, this._config);

      // Haltestelle: Favoriten-Modus oder feste Global ID
      if (this._favError) {
        if ((v.global_id || "").trim()) cfg.global_id = v.global_id.trim();
        else { delete cfg.global_id; delete cfg.title; }
      } else if (v.station && v.station !== "__favs__") {
        cfg.global_id = v.station;
        const fav = (this._favorites || []).find(f => f.globalId === v.station);
        if (fav) cfg.title = fav.name; else delete cfg.title;
      } else {
        delete cfg.global_id;
        delete cfg.title;
      }

      cfg.limit = Number(v.limit) || 8;
      cfg.refresh = Number(v.refresh) || 30;

      const types = Array.isArray(v.types) ? v.types.filter(Boolean) : [];
      if (types.length) cfg.types = types.join(",");
      else delete cfg.types;

      if ((v.api_url || "").trim()) cfg.api_url = v.api_url.trim();
      else delete cfg.api_url;

      this._config = cfg;
      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config: cfg }, bubbles: true, composed: true,
      }));
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
