/* MVG Abfahrten – Sensor-Karte (v2.3.18)
 *
 * Liest direkt hass.states['sensor.mvg_abfahrten_mvg_<plan>'] und dessen
 * Attribute (departures-Array). Kein fetch(), kein api_url, kein
 * Auth-Problem – funktioniert automatisch überall wo Home Assistant
 * selbst erreichbar ist, auch extern über Nabu Casa.
 *
 * Voraussetzung: MQTT-Sensoren müssen im Add-on aktiviert sein
 * (mqtt_enabled: true) und ein MQTT-Broker muss konfiguriert sein.
 *
 * Konfiguration:
 *   type: custom:mvg-abfahrten-sensor-card
 *   entities:
 *     - sensor.mvg_abfahrten_mvg_waldstrasse
 *     - sensor.mvg_abfahrten_mvg_neubiberg
 *   layout: tabs          # tabs (umschaltbar) | list (untereinander)
 *   design: auto           # auto (Dashboard-Theme) | board (Anzeigetafel)
 *   show_title: true       # Titel "MVG Abfahrten" anzeigen
 *   show_clock: false      # Live-Uhrzeit im Header anzeigen
 *   show_station: true     # Haltestellenname unter Ziel anzeigen
 *   show_ticker: off        # off (Info-Symbol) | ticker (Laufschrift)
 *   swap_times: false      # Uhrzeit groß rechts statt Minuten
 *   limit: 4                # Anzahl Abfahrten pro Sensor
 */
(function () {
  if (customElements.get("mvg-abfahrten-sensor-card")) return;

  const CARD_VERSION = "2.3.18";
  console.info(`%c MVG-ABFAHRTEN-SENSOR-CARD %c v${CARD_VERSION} `,
    "color:#fff;background:#0E84B5;font-weight:700;",
    "color:#0E84B5;background:transparent;font-weight:700;");

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const TYPE_COLORS = {
    SBAHN: "#0E84B5", UBAHN: "#1257A8", TRAM: "#D62027",
    BUS: "#1A6A3C", REGIONAL_BUS: "#1A6A3C", BAHN: "#646973",
  };

  const LAYOUT_OPTIONS = [
    { value: "tabs", label: "Tabs (umschaltbar)" },
    { value: "list", label: "Untereinander" },
  ];
  const DESIGN_OPTIONS = [
    { value: "auto",  label: "Dashboard-Theme (Standard)" },
    { value: "board", label: "Anzeigetafel (dunkel)" },
  ];

  const STYLE = `
    :host { display:block; }
    ha-card { padding: 0; overflow: hidden; }
    ha-card.board {
      background: #14171c; color: #f2f2f2;
      --primary-text-color: #f2f2f2; --secondary-text-color: #9aa0a8;
      --divider-color: rgba(255,255,255,0.08); --accent-color: #ffb74d;
    }
    .header { display:flex; align-items:center; gap:8px; padding:14px 16px 8px 16px; }
    .header h2 { font-size:15px; font-weight:700; margin:0; flex:1; color: var(--primary-text-color); }
    .clock { font-size:13px; font-weight:600; color: var(--secondary-text-color, #999); font-variant-numeric: tabular-nums; }
    .section-head { display:flex; flex-direction:column; gap:2px; padding:12px 16px 4px 16px; }
    .section-head .section-title { display:flex; align-items:center; gap:8px; }
    .section-head h3 { font-size:13px; font-weight:700; margin:0; color: var(--primary-text-color); flex:1; }
    .filter-info { display:flex; flex-wrap:wrap; gap:4px 0; font-size:11px; color: var(--secondary-text-color, #999); }
    .filter-info b { color: var(--primary-text-color); margin-right:2px; }
    .filter-line { display:inline-flex; align-items:center; white-space:nowrap; margin-right:12px; }
    .tabs { display:flex; gap:6px; padding: 0 16px 10px 16px; overflow-x:auto; }
    .tab {
      flex-shrink:0; padding:6px 14px; border-radius:999px; font-size:12.5px; font-weight:700;
      background: var(--secondary-background-color, #2a2a2a); color: var(--secondary-text-color, #999);
      border: 1px solid transparent; cursor:pointer;
    }
    .tab[aria-pressed="true"] { background: rgba(255,160,0,0.15); color: var(--accent-color, #ff9800); border-color: var(--accent-color, #ff9800); }
    .row {
      display:grid; align-items:center;
      grid-template-columns: minmax(46px,auto) 1fr;
      gap:10px; padding:9px 16px; border-top: 1px solid var(--divider-color, rgba(255,255,255,0.1));
    }
    .badge {
      display:inline-flex; align-items:center; justify-content:center;
      min-width:38px; height:24px; padding:0 8px; border-radius:6px;
      font-size:13px; font-weight:800; color:#fff;
    }
    .to { font-size:14.5px; font-weight:500; display:flex; align-items:baseline; gap:6px; }
    .to-dest { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color: var(--primary-text-color); }
    .station-name { font-size:11px; color: var(--secondary-text-color, #999); margin-right:4px; }
    .platform { font-size:12px; color: var(--secondary-text-color, #999); flex-shrink:0; }
    .min { text-align:right; color: var(--accent-color, #ff9800); font-size:18px; font-weight:700; flex-shrink:0; }
    .min.swapped { font-size:14.5px; }
    .min small { font-size:10.5px; font-weight:600; margin-left:2px; color: var(--secondary-text-color, #999); }
    .meta { color: var(--secondary-text-color, #999); font-size:11.5px; display:flex; align-items:center; gap:4px; overflow:hidden; }
    .meta .ticker-wrap { flex:1; overflow:hidden; min-width:0; }
    .ticker {
      display:inline-block; font-size:13px; font-weight:700; color: var(--accent-color, #ff9800);
      white-space:nowrap; padding-left:100%; animation: ticker 20s linear infinite;
    }
    @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
    .cancelled .to-dest { text-decoration: line-through; color: var(--secondary-text-color, #999); }
    .cancelled-text { color: var(--error-color, #e84545); font-size:13px; font-weight:700; }
    .delay { color: var(--error-color, #e84545); font-weight:700; }
    .empty { padding:30px 16px; text-align:center; color: var(--secondary-text-color, #999); font-size:13px; }
    .unavail { padding:30px 16px; text-align:center; color: var(--error-color, #e84545); font-size:13px; }
    .info-btn {
      border:0; background:none; color: var(--accent-color, #ff9800); cursor:pointer;
      font-size:14px; padding:0 2px; flex-shrink:0;
    }
  `;

  const EDITOR_STYLE = `
    .sort-widget {
      margin-top: 8px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      overflow: hidden;
    }
    .sort-widget-label {
      font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
      padding: 8px 12px 4px;
    }
    .sort-item {
      display: flex; align-items: center; gap: 8px; padding: 7px 12px;
      border-top: 1px solid var(--divider-color, #eee);
      background: var(--card-background-color, #fff);
    }
    .sort-item:first-of-type { border-top: 0; }
    .sort-name { flex: 1; font-size: 13px; color: var(--primary-text-color); }
    .sort-btn {
      background: none; border: 0; cursor: pointer;
      color: var(--secondary-text-color); font-size: 16px; padding: 2px 6px;
    }
    .sort-btn:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
    .sort-btn:disabled { opacity: 0.3; cursor: default; }
  `;

  class MvgAbfahrtenSensorCard extends HTMLElement {
    setConfig(config) {
      this._config = config || {};
      this._activeTab = 0;
      this._popup = null;
      if (this._clockTimer) clearInterval(this._clockTimer);
      if (this._config.show_clock) {
        this._clockTimer = setInterval(() => this._updateClock(), 1000);
      }
    }

    getCardSize() { return 4; }

    static getConfigElement() {
      return document.createElement("mvg-abfahrten-sensor-card-editor");
    }

    static getStubConfig(hass) {
      const mvgSensor = Object.keys(hass?.states || {}).find(id => id.startsWith("sensor.mvg_abfahrten_"));
      return {
        entities: mvgSensor ? [mvgSensor] : [],
        layout: "tabs",
        design: "auto",
        show_title: true,
        show_clock: false,
        show_station: true,
        show_filter: true,
        show_ticker: "off",
        swap_times: false,
        limit: 4,
      };
    }

    set hass(h) {
      this._hass = h;
      this._render();
    }

    _filterHtml(departures, showStation) {
      const byLine = new Map();
      for (const d of departures) {
        const key = d.line || "?";
        if (!byLine.has(key)) byLine.set(key, { dests: new Set(), stations: new Set() });
        if (d.destination) byLine.get(key).dests.add(d.destination);
        if (d.station) byLine.get(key).stations.add(d.station);
      }
      if (!byLine.size) return "";
      const parts = [...byLine.entries()].map(([label, { dests, stations }]) => {
        const destList = [...dests].map(esc).join(", ");
        const stationTxt = showStation && stations.size
          ? ` <span style="color:var(--secondary-text-color,#999)">(${[...stations].map(esc).join(", ")})</span>`
          : "";
        return `<span class="filter-line"><b>${esc(label)}</b>${stationTxt}&thinsp;·&thinsp;${destList}</span>`;
      });
      return `<div class="filter-info">${parts.join("")}</div>`;
    }

    _badge(label, type) {
      const color = TYPE_COLORS[type] || "#555";
      return `<span class="badge" style="background:${color}">${esc(label || "")}</span>`;
    }

    _fmtTime(ms) {
      if (!ms) return "--:--";
      return new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }

    _formatMin(dep, swapTimes) {
      if (dep.cancelled) return `<span class="min"><span class="cancelled-text">entfällt</span></span>`;
      const m = dep.minutes;
      if (swapTimes) {
        const timeTxt = this._fmtTime(dep.realtime || dep.planned);
        const delayPart = dep.delay > 0 ? `<small class="delay">+${dep.delay}</small>` : "";
        return `<span class="min swapped">${timeTxt}${delayPart}</span>`;
      }
      if (m === null || m === undefined) return "";
      if (m <= 0) return `<span class="min">jetzt</span>`;
      const delayPart = dep.delay > 0 ? `<small class="delay">+${dep.delay}</small>` : "";
      return `<span class="min">${m}<small>min</small>${delayPart}</span>`;
    }

    _formatMetaTime(dep, swapTimes) {
      // Im Normalmodus: geplante Uhrzeit + Verspätung; im swap-Modus: Minuten klein
      if (swapTimes) {
        const m = dep.minutes;
        const txt = m === null || m === undefined ? "" : (m <= 0 ? "jetzt" : `${m} min`);
        return txt;
      }
      const timeTxt = this._fmtTime(dep.planned || dep.realtime);
      const delayPart = dep.delay > 0 ? ` <span class="delay">+${dep.delay}</span>` : "";
      return `${timeTxt}${delayPart}`;
    }

    _rowHtml(dep) {
      const showTicker = this._config.show_ticker === "ticker" || this._config.show_ticker === true;
      const showStation = this._config.show_station !== false;
      const swapTimes = this._config.swap_times === true;
      const hasInfo = !!(dep.messages && dep.messages.length);
      const tickerText = showTicker && hasInfo ? dep.messages.join(" · ") : "";
      const infoBadge = hasInfo && !showTicker
        ? `<button class="info-btn" data-msg="${esc(dep.messages.join(" · "))}" data-title="${esc((dep.line || "") + " → " + (dep.destination || ""))}">ⓘ</button>`
        : "";
      const platTxt = dep.platform ? `Gleis ${esc(dep.platform)}` : "";
      const stationTxt = showStation && dep.station ? `${esc(dep.station)} · ` : "";
      const timeTxt = dep.cancelled ? "" : this._formatMetaTime(dep, swapTimes);
      const metaHtml = `<div class="meta">
        <span class="meta-time">${stationTxt}${timeTxt}</span>
        ${tickerText ? `<span class="ticker-wrap"><span class="ticker">${esc(tickerText)}</span></span>` : ""}
      </div>`;
      return `<div class="row${dep.cancelled ? " cancelled" : ""}">
        ${this._badge(dep.line, dep.transport_type)}
        <div>
          <div class="to">
            <span class="to-dest">${esc(dep.destination || "")}${infoBadge}</span>
            ${platTxt ? `<span class="platform">${platTxt}</span>` : ""}
            ${this._formatMin(dep, swapTimes)}
          </div>
          ${metaHtml}
        </div>
      </div>`;
    }

    _render() {
      if (!this._hass || !this._config) return;
      const entities = this._config.entities || [];
      const limit = Number(this._config.limit) || 4;
      const layout = this._config.layout || "tabs";
      const design = this._config.design || "auto";
      const showTitle = this._config.show_title !== false;
      const showClock = this._config.show_clock === true;
      const showFilter = this._config.show_filter !== false;
      const showStation = this._config.show_station !== false;

      if (!this._card) {
        this.innerHTML = `<style>${STYLE}</style><ha-card></ha-card>`;
        this._card = this.querySelector("ha-card");
        this._card.addEventListener("click", (e) => {
          const tab = e.target.closest(".tab");
          if (tab) { this._activeTab = Number(tab.dataset.idx); this._render(); return; }
          const info = e.target.closest(".info-btn");
          if (info) { this._showInfo(info.dataset.title, info.dataset.msg); }
        });
      }
      this._card.className = design === "board" ? "board" : "";

      if (!entities.length) {
        this._card.innerHTML = `<div class="unavail">Bitte mindestens einen Sensor (sensor.mvg_abfahrten_mvg_*) in den Karteneinstellungen auswählen.</div>`;
        return;
      }

      const states = entities.map(id => this._hass.states[id]).filter(Boolean);
      if (!states.length) {
        this._card.innerHTML = `<div class="unavail">Sensor(en) nicht gefunden. Prüfe die Entity-IDs und ob MQTT im Add-on aktiviert ist.</div>`;
        return;
      }

      const headerHtml = showTitle || showClock
        ? `<div class="header">
            ${showTitle ? `<h2>MVG Abfahrten</h2>` : `<span style="flex:1"></span>`}
            ${showClock ? `<span class="clock" data-clock></span>` : ""}
          </div>`
        : "";

      let bodyHtml;
      if (layout === "list" && states.length > 1) {
        // Untereinander: jeder Sensor als eigener Abschnitt
        bodyHtml = states.map(s => {
          const name = (s.attributes.plan_name || s.attributes.friendly_name || s.entity_id).replace(/^MVG /, "");
          const departures = (s.attributes.departures || []).slice(0, limit);
          const filterHtml = showFilter ? this._filterHtml(departures, showStation) : "";
          const rows = s.state === "unavailable"
            ? `<div class="unavail">Keine aktuellen Daten verfügbar.</div>`
            : !departures.length
              ? `<div class="empty">Keine Abfahrten.</div>`
              : departures.map(d => this._rowHtml(d)).join("");
          return `<div class="section-head"><div class="section-title"><h3>${esc(name)}</h3></div>${filterHtml}</div>${rows}`;
        }).join("");
      } else {
        // Tabs (oder einzelner Sensor)
        const tabsHtml = states.length > 1
          ? `<div class="tabs">${states.map((s, i) => {
              const name = (s.attributes.plan_name || s.attributes.friendly_name || s.entity_id).replace(/^MVG /, "");
              return `<button class="tab" data-idx="${i}" aria-pressed="${i === this._activeTab}">${esc(name)}</button>`;
            }).join("")}</div>`
          : "";
        const active = states[Math.min(this._activeTab, states.length - 1)];
        const departures = (active.attributes.departures || []).slice(0, limit);
        const filterHtml = showFilter
          ? `<div style="padding:0 16px 8px 16px">${this._filterHtml(departures, showStation)}</div>`
          : "";
        const rows = active.state === "unavailable"
          ? `<div class="unavail">Keine aktuellen Daten verfügbar.</div>`
          : !departures.length
            ? `<div class="empty">Keine Abfahrten.</div>`
            : departures.map(d => this._rowHtml(d)).join("");
        bodyHtml = tabsHtml + filterHtml + rows;
      }

      this._card.innerHTML = headerHtml + bodyHtml;
      if (showClock) this._updateClock();
    }

    _updateClock() {
      const el = this._card?.querySelector("[data-clock]");
      if (!el) return;
      el.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    _showInfo(title, message) {
      alert(`${title}\n\n${message}`);
    }

    disconnectedCallback() {
      if (this._clockTimer) clearInterval(this._clockTimer);
    }
  }

  class MvgAbfahrtenSensorCardEditor extends HTMLElement {
    setConfig(config) { this._config = config || {}; this._render(); }
    set hass(h) { this._hass = h; this._render(); }

    _availableSensors() {
      const states = this._hass?.states || {};
      return Object.keys(states)
        .filter(id => id.startsWith("sensor.mvg_abfahrten_"))
        .map(id => ({ value: id, label: states[id].attributes.plan_name || states[id].attributes.friendly_name || id }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    _render() {
      if (!this._hass) return;
      this._config = this._config || {};
      const sensorOptions = this._availableSensors();

      if (!this._form) {
        this.innerHTML = "";
        this._form = document.createElement("ha-form");
        this._form.addEventListener("value-changed", (e) => {
          e.stopPropagation();
          const v = e.detail.value;
          const cfg = Object.assign({}, this._config, v);
          if (!Array.isArray(cfg.entities)) cfg.entities = cfg.entities ? [cfg.entities] : [];
          this._config = cfg;
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
          this._renderSortWidget();
        });
        this.appendChild(this._form);
        this._sortWrap = document.createElement("div");
        this.appendChild(this._sortWrap);
      }
      this._form.hass = this._hass;
      this._form.data = {
        entities: this._config.entities || [],
        layout: this._config.layout || "tabs",
        design: this._config.design || "auto",
        show_title: this._config.show_title !== false,
        show_clock: this._config.show_clock === true,
        show_station: this._config.show_station !== false,
        show_filter: this._config.show_filter !== false,
        show_ticker: this._config.show_ticker || "off",
        swap_times: this._config.swap_times === true,
        limit: Number(this._config.limit) || 4,
      };
      this._form.schema = [
        sensorOptions.length
          ? { name: "entities", selector: { select: { multiple: true, mode: "list", options: sensorOptions } } }
          : { name: "entities", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } },
        { name: "layout", selector: { select: { mode: "dropdown", options: [
          { value: "tabs", label: "Tabs (umschaltbar)" },
          { value: "list", label: "Untereinander" },
        ] } } },
        { name: "design", selector: { select: { mode: "dropdown", options: [
          { value: "auto",  label: "Dashboard-Theme (Standard)" },
          { value: "board", label: "Anzeigetafel (dunkel)" },
        ] } } },
        { name: "show_title",   selector: { boolean: {} } },
        { name: "show_clock",   selector: { boolean: {} } },
        { name: "show_station", selector: { boolean: {} } },
        { name: "show_filter",  selector: { boolean: {} } },
        { name: "show_ticker", selector: { select: { options: [
          { value: "off", label: "Aus (Info-Symbol ⓘ)" },
          { value: "ticker", label: "Laufschrift" },
        ], mode: "dropdown" } } },
        { name: "swap_times", selector: { boolean: {} } },
        { name: "limit", selector: { number: { min: 1, max: 20, mode: "box" } } },
      ];
      this._form.computeLabel = (s) => ({
        entities: sensorOptions.length ? "Sensoren auswählen" : "Sensoren (manuell, keine MVG-Sensoren gefunden)",
        layout: "Darstellung",
        design: "Design",
        show_title: "Titel anzeigen",
        show_clock: "Uhrzeit anzeigen",
        show_station: "Haltestellenname unter Ziel anzeigen",
        show_filter: "Filter-Info (Linien-Übersicht) anzeigen",
        show_ticker: "Störungsanzeige",
        swap_times: "Uhrzeit und Minuten tauschen (Uhrzeit groß rechts)",
        limit: "Anzahl Abfahrten",
      }[s.name] || s.name);

      this._renderSortWidget();
    }

    _renderSortWidget() {
      const ids = Array.isArray(this._config.entities) ? this._config.entities : [];
      const nameMap = new Map(this._availableSensors().map(o => [o.value, o.label]));
      if (ids.length < 2) { if (this._sortWrap) this._sortWrap.innerHTML = ""; return; }
      this._sortWrap.innerHTML = `<style>${EDITOR_STYLE}</style>
        <div class="sort-widget">
          <div class="sort-widget-label">Reihenfolge der Sensoren</div>
          ${ids.map((id, i) => `
            <div class="sort-item">
              <span class="sort-name">${esc(nameMap.get(id) || id)}</span>
              <button class="sort-btn" data-idx="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>↑</button>
              <button class="sort-btn" data-idx="${i}" data-dir="1" ${i === ids.length - 1 ? "disabled" : ""}>↓</button>
            </div>`).join("")}
        </div>`;
      this._sortWrap.querySelectorAll(".sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx);
          const dir = parseInt(btn.dataset.dir);
          const newIds = [...ids];
          const tmp = newIds[idx];
          newIds[idx] = newIds[idx + dir];
          newIds[idx + dir] = tmp;
          const cfg = Object.assign({}, this._config, { entities: newIds });
          this._config = cfg;
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
          this._renderSortWidget();
        });
      });
    }
  }

  customElements.define("mvg-abfahrten-sensor-card", MvgAbfahrtenSensorCard);
  customElements.define("mvg-abfahrten-sensor-card-editor", MvgAbfahrtenSensorCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mvg-abfahrten-sensor-card",
    name: `MVG Abfahrten (Sensor) v${CARD_VERSION}`,
    description: "Zeigt MVG-Abfahrten aus MQTT-Sensoren – funktioniert auch extern über Nabu Casa ohne eigene API.",
  });
})();
