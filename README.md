# MVG Abfahrten – Home Assistant Add-on

[![GitHub Release](https://img.shields.io/github/v/release/Melle79/mvg-abfahrten?style=flat-square)](https://github.com/Melle79/mvg-abfahrten/releases)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-green?style=flat-square)](LICENSE)
[![Home Assistant Add-on](https://img.shields.io/badge/Home%20Assistant-Add--on-41BDF5?style=flat-square&logo=homeassistant&logoColor=white)](https://www.home-assistant.io/addons/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-melle79-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/melle79)

[![Repository zu Home Assistant hinzufügen](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FMelle79%2Fmvg-abfahrten)

Abfahrtsmonitor für **MVG/MVV** als Home-Assistant-Add-on – mit Haltestellensuche, Echtzeit-Abfahrten, **Abfahrtsplänen** (mehrere Haltestellen & Filter pro Plan) und einer eigenen **Dashboard-Karte**.

---

## Features

### 🔍 Suche (Tab „Suche")
- Live-Haltestellensuche mit Autocomplete und Verkehrsmittel-Badges
- Echtzeit-Abfahrten mit Verspätung, Gleis, SEV-Kennzeichnung
- **EARLY_TERMINATION**: Originalziel durchgestrichen, tatsächliches Ziel daneben
- **Info-Popup** (ⓘ) bei Störungen und Betriebshinweisen
- Gleisänderung (⚠) in Bernstein hervorgehoben
- Auslastung als Farbpunkt (🟢🟡🔴)
- 60s Auto-Refresh mit Countdown-Timer
- Hinweis wenn mehr als 30 Suchergebnisse

### 📋 Abfahrtspläne (Tab „Pläne")
- **Mehrere Haltestellen pro Plan** – z. B. S-Bahn-Haltestelle + Bus-Haltestelle in einem Plan
- **Linienfilter** – nur bestimmte Linien anzeigen (Chips aus aktuellen Abfahrten)
- **Richtungsfilter** – H (Hinfahrt) oder R (Rückfahrt) aus der `lineId`, mit Endziel-Vorschau
- **Kacheln-Übersicht** mit Vorschau der nächsten Abfahrten
- **Vollansicht** mit 60s-Countdown, Info-Popup, EARLY_TERMINATION-Anzeige
- Pläne bearbeiten (✎) und löschen (✕)

### 🃏 Dashboard-Karte
- Eigene Lovelace-Karte, vom Add-on selbst ausgeliefert (kein HACS nötig)
- **Abfahrtspläne** oder klassische Favoriten/Haltestelle
- **Mehrere Pläne** als Tabs oder untereinander
- **Filter-Info** unter den Tabs (Fahrtrichtung mit Endzielen)
- **Haltestellenname** optional unter dem Ziel
- **Laufschrift** für Störungsmeldungen (optional, rechts neben der Uhrzeit)
- Info-Popup bei Störungen (funktioniert im Shadow DOM)
- Design: HA-Theme oder dunkle „Anzeigetafel"-Optik
- Visueller Editor mit allen Optionen

---

## Installation

1. Badge oben anklicken **oder** in HA: **Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories**
   → `https://github.com/Melle79/mvg-abfahrten` hinzufügen
2. **MVG Abfahrten** installieren und starten
3. Über die Seitenleiste (**MVG**) öffnen

---

## Bedienung

### Suche
Haltestelle eingeben, Abfahrten erscheinen automatisch. 60s-Countdown in der Fußzeile zeigt wann die nächste Aktualisierung kommt.

### Abfahrtspläne
1. Tab **Pläne** öffnen → **+ Neuer Plan**
2. **Name** eingeben
3. **+ Haltestelle hinzufügen** – Haltestelle suchen und auswählen
4. Optional: **Verkehrsmittel**, **Linien** (Chips), **Richtung** (H/R mit Endziel-Vorschau) wählen
5. Weitere Haltestellen hinzufügen (z. B. S-Bahn + Bus-Haltestelle kombinieren)
6. **Speichern**

Die Kacheln-Übersicht zeigt die nächsten Abfahrten aller Einträge zeitlich sortiert. Klick auf eine Kachel öffnet die Vollansicht.

---

## Dashboard-Karte

### Ressource registrieren (einmalig)
**Einstellungen → Dashboards → ⋮ → Ressourcen → Hinzufügen**
- URL: `http://<ha-host>:8099/card.js`
- Typ: **JavaScript-Modul**

*(Erfordert aktivierten „Erweiterten Modus" im Benutzerprofil)*

### Karte hinzufügen
Im Dashboard: **Karte hinzufügen → MVG Abfahrten**

### Karten-Optionen (visueller Editor)

| Option | Standard | Beschreibung |
|---|---|---|
| `plan_ids` | — | Abfahrtspläne (Mehrfachauswahl) |
| `layout` | `tabs` | `tabs` oder `list` (untereinander) |
| `design` | `auto` | `auto` (HA-Theme) oder `board` (Anzeigetafel) |
| `show_title` | `true` | Titel anzeigen |
| `show_clock` | `true` | Uhrzeit anzeigen |
| `show_station` | `true` | Haltestellenname unter Ziel anzeigen |
| `show_filter` | `true` | Fahrtrichtung unter Plan-Tabs anzeigen |
| `show_ticker` | `false` | Störungstext als Laufschrift neben der Uhrzeit |
| `limit` | `8` | Anzahl Abfahrten (1–20) |
| `refresh` | `60` | Aktualisierungsintervall in Sekunden |
| `api_url` | auto | API-URL (Standard: `http://<ha-host>:8099`) |

### YAML-Beispiel (Plan-Modus)
```yaml
type: custom:mvg-abfahrten-card
plan_ids:
  - abc12345
  - def67890
layout: tabs
show_filter: true
show_ticker: true
limit: 8
```

### YAML-Beispiel (klassisch mit Favoriten)
```yaml
type: custom:mvg-abfahrten-card
favorites: true
layout: list
design: board
show_title: true
show_clock: true
limit: 10
```

---

## Add-on-Optionen

| Option | Standard | Beschreibung |
|---|---|---|
| `cache_ttl` | 45 | Cache-Dauer für Abfahrten in Sekunden (10–300) |
| `default_limit` | 12 | Standardanzahl Abfahrten (1–80) |

Port **8099** stellt API und Karte im LAN bereit (ohne Authentifizierung – nur im Heimnetz verwenden).

---

## Hinweise

- Basiert auf der **inoffiziellen MVG-API** – nur für private, nicht-kommerzielle Nutzung
- Die MVG-API liefert für manche Haltestellen nur ein Verkehrsmittel obwohl mehrere fahren → in diesem Fall separate Haltestellen-Einträge im Plan anlegen (z. B. S-Bahn-Haltestelle + Bus-Haltestelle)
- Abfahrtspläne werden unter `/data/plans.json` im Add-on gespeichert

---

## Unterstützung

Wenn dir das Projekt gefällt:

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/melle79)
