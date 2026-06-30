/* MVG Abfahrten – Sensor-Karte (v2.3.17)
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

  const CARD_VERSION = "2.3.17";
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
    .section-head { display:flex; align-items:center; gap:8px; padding:12px 16px 4px 16px; }
    .section-head h3 { font-size:13px; font-weight:700; margin:0; color: var(--primary-text-color); flex:1; }
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
        show_ticker: "off",
        swap_times: false,
        limit: 4,
      };
    }

    set hass(h) {
      this._hass = h;
      this._render();
    }

    _badge(label, type) {
      const color = TYPE_COLORS[type] || "#555";
      return `<span class="badge" style="background:${color}">${esc(label || "")}</span>`;
    }

    _formatMin(dep, swapTimes) {
      if (dep.cancelled) return `<span class="min"><span class="cancelled-text">entfällt</span></span>`;
      if (swapTimes) {
        const dt = dep.realtime ? new Date(dep.realtime) : null;
        const timeTxt = dt ? dt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
        const delayPart = dep.delay > 0 ? `<small class="delay">+${dep.delay}</small>` : "";
        return `<span class="min swapped">${timeTxt}${delayPart}</span>`;
      }
      const m = dep.minutes;
      if (m === null || m === undefined) return "";
      if (m <= 0) return `<span class="min">jetzt</span>`;
      const delayPart = dep.delay > 0 ? `<small class="delay">+${dep.delay}</small>` : "";
      return `<span class="min">${m}<small>min</small>${delayPart}</span>`;
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
      const metaHtml = `<div class="meta">
        ${tickerText ? `<span class="ticker-wrap"><span class="ticker">${esc(tickerText)}</span></span>` : (showStation && dep.station ? `<span>${esc(dep.station)}</span>` : "")}
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
          const rows = s.state === "unavailable"
            ? `<div class="unavail">Keine aktuellen Daten verfügbar.</div>`
            : !departures.length
              ? `<div class="empty">Keine Abfahrten.</div>`
              : departures.map(d => this._rowHtml(d)).join("");
          return `<div class="section-head"><h3>${esc(name)}</h3></div>${rows}`;
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
        const rows = active.state === "unavailable"
          ? `<div class="unavail">Keine aktuellen Daten verfügbar.</div>`
          : !departures.length
            ? `<div class="empty">Keine Abfahrten.</div>`
            : departures.map(d => this._rowHtml(d)).join("");
        bodyHtml = tabsHtml + rows;
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

    _render() {
      if (!this._hass) return;
      this._config = this._config || {};
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
        });
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.data = {
        entities: this._config.entities || [],
        layout: this._config.layout || "tabs",
        design: this._config.design || "auto",
        show_title: this._config.show_title !== false,
        show_clock: this._config.show_clock === true,
        show_station: this._config.show_station !== false,
        show_ticker: this._config.show_ticker || "off",
        swap_times: this._config.swap_times === true,
        limit: Number(this._config.limit) || 4,
      };
      this._form.schema = [
        { name: "entities", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } },
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
        { name: "show_ticker", selector: { select: { options: [
          { value: "off", label: "Aus (Info-Symbol ⓘ)" },
          { value: "ticker", label: "Laufschrift" },
        ], mode: "dropdown" } } },
        { name: "swap_times", selector: { boolean: {} } },
        { name: "limit", selector: { number: { min: 1, max: 20, mode: "box" } } },
      ];
      this._form.computeLabel = (s) => ({
        entities: "Sensoren (sensor.mvg_abfahrten_mvg_*)",
        layout: "Darstellung",
        design: "Design",
        show_title: "Titel anzeigen",
        show_clock: "Uhrzeit anzeigen",
        show_station: "Haltestellenname unter Ziel anzeigen",
        show_ticker: "Störungsanzeige",
        swap_times: "Uhrzeit und Minuten tauschen (Uhrzeit groß rechts)",
        limit: "Anzahl Abfahrten",
      }[s.name] || s.name);
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
