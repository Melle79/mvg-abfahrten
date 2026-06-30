/* MVG Abfahrten – Sensor-Karte (v1.0.0)
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
 *   limit: 4
 *   show_ticker: ticker   # off | ticker
 */
(function () {
  if (customElements.get("mvg-abfahrten-sensor-card")) return;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const TYPE_COLORS = {
    SBAHN: "#0E84B5", UBAHN: "#1257A8", TRAM: "#D62027",
    BUS: "#1A6A3C", REGIONAL_BUS: "#1A6A3C", BAHN: "#646973",
  };

  const STYLE = `
    :host { display:block; }
    ha-card { padding: 0; overflow: hidden; }
    .header { display:flex; align-items:center; gap:8px; padding:14px 16px 8px 16px; }
    .header h2 { font-size:15px; font-weight:700; margin:0; flex:1; color: var(--primary-text-color); }
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
    .platform { font-size:12px; color: var(--secondary-text-color, #999); flex-shrink:0; }
    .min { text-align:right; color: var(--accent-color, #ff9800); font-size:18px; font-weight:700; flex-shrink:0; }
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
    }

    getCardSize() { return 4; }

    static getConfigElement() {
      return document.createElement("mvg-abfahrten-sensor-card-editor");
    }

    static getStubConfig(hass) {
      const mvgSensor = Object.keys(hass?.states || {}).find(id => id.startsWith("sensor.mvg_abfahrten_"));
      return {
        entities: mvgSensor ? [mvgSensor] : [],
        limit: 4,
        show_ticker: "off",
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

    _formatMin(dep) {
      if (dep.cancelled) return `<span class="min"><span class="cancelled-text">entfällt</span></span>`;
      const m = dep.minutes;
      if (m === null || m === undefined) return "";
      if (m <= 0) return `<span class="min">jetzt</span>`;
      const delayPart = dep.delay > 0 ? `<small class="delay">+${dep.delay}</small>` : "";
      return `<span class="min">${m}<small>min</small>${delayPart}</span>`;
    }

    _rowHtml(dep) {
      const showTicker = this._config.show_ticker === "ticker" || this._config.show_ticker === true;
      const hasInfo = !!(dep.messages && dep.messages.length);
      const tickerText = showTicker && hasInfo ? dep.messages.join(" · ") : "";
      const infoBadge = hasInfo && !showTicker
        ? `<button class="info-btn" data-msg="${esc(dep.messages.join(" · "))}" data-title="${esc((dep.line || "") + " → " + (dep.destination || ""))}">ⓘ</button>`
        : "";
      const platTxt = dep.platform ? `Gleis ${esc(dep.platform)}` : "";
      const metaHtml = `<div class="meta">
        <span>${esc(dep.station || "")}</span>
        ${tickerText ? `<span class="ticker-wrap"><span class="ticker">${esc(tickerText)}</span></span>` : ""}
      </div>`;
      return `<div class="row${dep.cancelled ? " cancelled" : ""}">
        ${this._badge(dep.line, dep.transport_type)}
        <div>
          <div class="to">
            <span class="to-dest">${esc(dep.destination || "")}${infoBadge}</span>
            ${platTxt ? `<span class="platform">${platTxt}</span>` : ""}
            ${this._formatMin(dep)}
          </div>
          ${metaHtml}
        </div>
      </div>`;
    }

    _render() {
      if (!this._hass || !this._config) return;
      const entities = this._config.entities || [];
      const limit = Number(this._config.limit) || 4;

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

      if (!entities.length) {
        this._card.innerHTML = `<div class="unavail">Bitte mindestens einen Sensor (sensor.mvg_abfahrten_mvg_*) in den Karteneinstellungen auswählen.</div>`;
        return;
      }

      const states = entities.map(id => this._hass.states[id]).filter(Boolean);
      if (!states.length) {
        this._card.innerHTML = `<div class="unavail">Sensor(en) nicht gefunden. Prüfe die Entity-IDs und ob MQTT im Add-on aktiviert ist.</div>`;
        return;
      }

      const tabsHtml = states.length > 1
        ? `<div class="tabs">${states.map((s, i) => {
            const name = (s.attributes.plan_name || s.attributes.friendly_name || s.entity_id).replace(/^MVG /, "");
            return `<button class="tab" data-idx="${i}" aria-pressed="${i === this._activeTab}">${esc(name)}</button>`;
          }).join("")}</div>`
        : "";

      const active = states[Math.min(this._activeTab, states.length - 1)];
      const title = active.attributes.plan_name || active.attributes.friendly_name || "MVG Abfahrten";
      const departures = (active.attributes.departures || []).slice(0, limit);

      let rowsHtml;
      if (active.state === "unavailable") {
        rowsHtml = `<div class="unavail">Keine aktuellen Daten verfügbar.</div>`;
      } else if (!departures.length) {
        rowsHtml = `<div class="empty">Keine Abfahrten.</div>`;
      } else {
        rowsHtml = departures.map(d => this._rowHtml(d)).join("");
      }

      this._card.innerHTML = `
        <div class="header"><h2>${esc(states.length > 1 ? "MVG Abfahrten" : title)}</h2></div>
        ${tabsHtml}
        ${rowsHtml}
      `;
    }

    _showInfo(title, message) {
      alert(`${title}\n\n${message}`);
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
        limit: Number(this._config.limit) || 4,
        show_ticker: this._config.show_ticker || "off",
      };
      this._form.schema = [
        { name: "entities", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } },
        { name: "limit", selector: { number: { min: 1, max: 20, mode: "box" } } },
        { name: "show_ticker", selector: { select: { options: [
          { value: "off", label: "Aus (Info-Symbol ⓘ)" },
          { value: "ticker", label: "Laufschrift" },
        ], mode: "dropdown" } } },
      ];
      this._form.computeLabel = (s) => ({
        entities: "Sensoren (sensor.mvg_abfahrten_mvg_*)",
        limit: "Anzahl Abfahrten",
        show_ticker: "Störungsanzeige",
      }[s.name] || s.name);
    }
  }

  customElements.define("mvg-abfahrten-sensor-card", MvgAbfahrtenSensorCard);
  customElements.define("mvg-abfahrten-sensor-card-editor", MvgAbfahrtenSensorCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mvg-abfahrten-sensor-card",
    name: "MVG Abfahrten (Sensor)",
    description: "Zeigt MVG-Abfahrten aus MQTT-Sensoren – funktioniert auch extern über Nabu Casa ohne eigene API.",
  });
})();
