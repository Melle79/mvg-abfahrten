# MVG Abfahrten – Home Assistant Add-on

[![GitHub Release](https://img.shields.io/github/v/release/Melle79/mvg-abfahrten?style=flat-square)](https://github.com/Melle79/mvg-abfahrten/releases)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-green?style=flat-square)](LICENSE)
[![Home Assistant Add-on](https://img.shields.io/badge/Home%20Assistant-Add--on-41BDF5?style=flat-square&logo=homeassistant&logoColor=white)](https://www.home-assistant.io/addons/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-melle79-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/melle79)

[![Repository zu Home Assistant hinzufügen](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FMelle79%2Fmvg-abfahrten)

Echtzeit-Abfahrtsmonitor für **MVG/MVV** als Home-Assistant-Add-on – mit Haltestellensuche, Abfahrtsplänen, zwei Dashboard-Karten und optionaler MQTT-Integration für externen Zugriff über Nabu Casa.

---

## Features

### 🔍 Haltestellensuche
- Live-Suche mit Autocomplete und Verkehrsmittel-Badges
- Echtzeit-Abfahrten mit Verspätung, Gleis, SEV-Kennzeichnung
- EARLY_TERMINATION: Originalziel durchgestrichen, tatsächliches Ziel daneben
- Gleisänderung (⚠) in Bernstein hervorgehoben
- Info-Popup (ⓘ) bei Störungen
- 60s Auto-Refresh mit Countdown-Timer

### 📋 Abfahrtspläne
- Mehrere Haltestellen pro Plan kombinierbar (z. B. S-Bahn + Bus)
- Linienfilter und Richtungsfilter (H/R) pro Eintrag
- Kacheln-Übersicht mit Vorschau der nächsten Abfahrten
- Vollansicht mit 60s-Countdown
- Pläne bearbeiten und löschen

### 🃏 API-Karte (`mvg-abfahrten-card`)
Klassische Lovelace-Karte, ruft die Add-on-API direkt ab. Für **lokalen Zugriff** im Heimnetz, oder mit gesetzter `api_url` auch über Nabu Casa.

- Pläne als Tabs oder untereinander
- Filter-Info (Linienübersicht) unter den Tabs
- Status-Bubble: 🟢 Live · 🟠 Veraltete Daten · 🔴 Keine Daten
- Störungsanzeige: Info-Popup oder Laufschrift
- SEV-Kennzeichnung (Schienenersatzverkehr)
- Visueller Editor mit allen Optionen
- Lovelace-Ressource wird beim Start automatisch registriert

### 📡 MQTT-Sensoren + Sensor-Karte (`mvg-abfahrten-sensor-card`)
Wenn ein MQTT-Broker verfügbar ist (z. B. Mosquitto-Add-on), veröffentlicht das Add-on pro Abfahrtsplan automatisch einen HA-Sensor:

```
sensor.mvg_abfahrten_mvg_<plan-name>
State:      Minuten bis zur nächsten Abfahrt
Attribute:  Vollständige Abfahrtsliste (Linie, Ziel, Zeit, Gleis,
            Verspätung, SEV, Störungstext, Datenstatus)
```

Die zugehörige **Sensor-Karte** liest `hass.states` direkt – **kein `fetch()`, kein `api_url`, kein Auth-Setup**. Funktioniert automatisch überall, auch extern über Nabu Casa.

Gleicher Funktionsumfang wie die API-Karte:
- Tabs oder Untereinander-Layout
- Dashboard-Theme oder dunkles Anzeigetafel-Design
- Filter-Info mit Status-Bubble pro Linie
- Störungsanzeige, SEV-Badge, swap_times
- Sensor-Auswahl als ankreuzbare Liste mit Sortier-Widget

---

## Installation

1. Badge oben anklicken **oder** manuell: **Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories** → `https://github.com/Melle79/mvg-abfahrten` hinzufügen
2. **MVG Abfahrten** installieren und starten
3. Über die Seitenleiste (**MVG**) öffnen

---

## Add-on konfigurieren

| Option | Standard | Beschreibung |
|---|---|---|
| `cache_ttl` | 65 | Cache-Dauer in Sekunden (10–300) |
| `default_limit` | 12 | Standardanzahl Abfahrten (1–80) |
| `ha_ip` | — | IP des HA-Hosts (z. B. `192.168.0.222`) – wird in die Karte eingesetzt, damit sie auch extern funktioniert |
| `mqtt_enabled` | `true` | MQTT-Sensoren aktivieren |
| `mqtt_host` | auto | MQTT-Broker-Host (leer = automatische Erkennung via Mosquitto-Add-on) |
| `mqtt_port` | 1883 | MQTT-Port |
| `mqtt_user` | — | MQTT-Benutzername |
| `mqtt_password` | — | MQTT-Passwort |
| `mqtt_publish_interval` | 60 | Publish-Intervall in Sekunden (20–300) |

---

## Dashboard-Karten

### Ressourcen
Beide Karten werden beim Add-on-Start **automatisch als Lovelace-Ressourcen registriert** – kein manuelles Eintragen nötig.

| Ressource | Karte |
|---|---|
| `/local/mvg-abfahrten-card.js` | API-Karte |
| `/local/mvg-abfahrten-sensor-card.js` | Sensor-Karte |

### API-Karte – YAML-Beispiel
```yaml
type: custom:mvg-abfahrten-card
api_url: http://192.168.0.222:8099
plan_ids:
  - abc12345
  - def67890
layout: tabs
show_filter: true
show_status: true
show_ticker: ticker
limit: 8
```

### Sensor-Karte – YAML-Beispiel
```yaml
type: custom:mvg-abfahrten-sensor-card
entities:
  - sensor.mvg_abfahrten_mvg_waldstrasse
  - sensor.mvg_abfahrten_mvg_neubiberg
layout: tabs
show_filter: true
show_status: true
limit: 4
```

### Karten-Optionen

| Option | API-Karte | Sensor-Karte | Beschreibung |
|---|:---:|:---:|---|
| `plan_ids` / `entities` | ✓ | ✓ | Pläne / Sensoren (Mehrfachauswahl) |
| `layout` | ✓ | ✓ | `tabs` oder `list` |
| `design` | ✓ | ✓ | `auto` (HA-Theme) oder `board` (Anzeigetafel) |
| `show_title` | ✓ | ✓ | Titel anzeigen |
| `show_clock` | ✓ | ✓ | Uhrzeit anzeigen |
| `show_station` | ✓ | ✓ | Haltestellenname unter Ziel |
| `show_filter` | ✓ | ✓ | Linienübersicht unter Tabs |
| `show_status` | ✓ | ✓ | Status-Bubble (🟢 Live · 🟠 Veraltet · 🔴 Keine Daten) |
| `show_ticker` | ✓ | ✓ | `off` (Info-Symbol) oder `ticker` (Laufschrift) |
| `swap_times` | ✓ | ✓ | Uhrzeit groß rechts statt Minuten |
| `limit` | ✓ | ✓ | Anzahl Abfahrten (1–20) |
| `refresh` | ✓ | — | Aktualisierungsintervall in Sekunden |
| `api_url` | ✓ | — | API-URL des Add-ons (Pflichtfeld bei Nabu Casa) |

### Demo
Eine interaktive Demo aller Konfigurationsmöglichkeiten der Sensor-Karte ist im laufenden Add-on unter `/sensor-card-demo.html` verfügbar.

---

## Hinweise

- Basiert auf der **inoffiziellen MVG-API** – nur für private, nicht-kommerzielle Nutzung
- Die MVG-API liefert für manche Haltestellen nur ein Verkehrsmittel obwohl mehrere fahren → in diesem Fall separate Einträge im Plan anlegen (z. B. S-Bahn-Haltestelle + Bus-Haltestelle)
- Port **8099** stellt API und App im LAN bereit (ohne Authentifizierung – nur im Heimnetz verwenden)
- Abfahrtspläne werden unter `/data/plans.json` gespeichert

---

## Unterstützung

Wenn dir das Projekt gefällt:

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/melle79)
