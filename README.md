# MVG Abfahrten – Home Assistant Add-on

[![GitHub Release](https://img.shields.io/github/v/release/Melle79/mvg-abfahrten?style=flat-square)](https://github.com/Melle79/mvg-abfahrten/releases)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-green?style=flat-square)](LICENSE)
[![Home Assistant Add-on](https://img.shields.io/badge/Home%20Assistant-Add--on-41BDF5?style=flat-square&logo=homeassistant&logoColor=white)](https://www.home-assistant.io/addons/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-melle79-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/melle79)

[![Repository zu Home Assistant hinzufügen](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FMelle79%2Fmvg-abfahrten)

Abfahrtsmonitor für **MVG/MVV** als Home-Assistant-Add-on – mit Haltestellensuche (Live-Autocomplete), Verkehrsmittel-Filtern, Favoriten inkl. Beförderungsart, Echtzeitdaten und einer eigenen **Dashboard-Karte** mit visuellem Editor.

## Features

**Add-on (Web-UI über Ingress):**
- 🔍 Haltestellensuche mit Dropdown (MVG-Locations-API)
- 🚇 Filter nach U-Bahn, S-Bahn, Tram, Bus, Bahn
- ⭐ Favoriten **inkl. Beförderungsart** – der Stern speichert die aktive Filterauswahl mit; dieselbe Haltestelle kann mehrfach mit unterschiedlichen Filtern gespeichert werden (z. B. „Ottobrunn · S-Bahn" und „Ottobrunn · Bus")
- ⏱ Echtzeit-Abfahrten mit Verspätung (+x), Gleis, SEV- und Ausfall-Kennzeichnung
- 🔄 Auto-Refresh alle 30 s, serverseitiges Caching
- 🎨 Linien-Badges in den offiziellen Farben (U1–U8 inkl. zweifarbiger U7/U8, S1–S20, ExpressBus)

**Dashboard-Karte:**
- 🃏 Eigene Lovelace-Karte, vom Add-on selbst ausgeliefert (kein HACS nötig)
- 🖱 **Visueller Editor**: Haltestelle aus den Favoriten wählen, Layout, Design, Anzahl, Filter, Refresh
- 📑 Favoriten als **Tabs** (umschaltbar) oder **untereinander** als eigene Blöcke
- 🎛 **Design wählbar**: passt sich dem HA-Theme an (Standard) oder dunkle „Anzeigetafel"-Optik
- 👁 Titel und Uhrzeit einzeln abschaltbar

## Installation

1. Badge oben anklicken **oder** in Home Assistant: **Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories** und `https://github.com/Melle79/mvg-abfahrten` hinzufügen
2. **MVG Abfahrten** installieren und starten
3. Über die Seitenleiste (**MVG**) öffnen, Haltestellen suchen und mit ★ als Favoriten speichern

## Add-on-Optionen

| Option | Standard | Beschreibung |
|---|---|---|
| `cache_ttl` | 45 | Cache-Dauer für Abfahrten in Sekunden (10–300) |
| `default_limit` | 12 | Standardanzahl Abfahrten (1–80) |

Port **8099** stellt die API und die Dashboard-Karte im LAN bereit (ohne Authentifizierung – nur im Heimnetz verwenden).

## Dashboard-Karte

**Ressource registrieren** (einmalig): **Einstellungen → Dashboards → ⋮ → Ressourcen → Hinzufügen**
- URL: `http://<ha-host>:8099/card.js`
- Typ: **JavaScript-Modul**

*(Der Menüpunkt „Ressourcen" erfordert den aktivierten „Erweiterten Modus" im Benutzerprofil.)*

**Karte einbinden:** Dashboard → **Karte hinzufügen** → nach **„MVG Abfahrten"** suchen. Alle Einstellungen lassen sich im **visuellen Editor** vornehmen – YAML ist nicht nötig.

### Karten-Optionen (YAML)

| Option | Standard | Beschreibung |
|---|---|---|
| `global_id` | – | Feste Haltestelle (sonst Favoriten-Modus) |
| `title` | – | Anzeigename bei fester Haltestelle |
| `layout` | `tabs` | Favoriten-Darstellung: `tabs` oder `list` (untereinander) |
| `design` | Theme | `board` für die dunkle Anzeigetafel-Optik |
| `show_title` | `true` | Titelzeile (Haltestellenname) anzeigen |
| `show_clock` | `true` | Uhrzeit anzeigen |
| `limit` | `8` | Anzahl Abfahrten (1–20) |
| `types` | alle | Filter, z. B. `"SBAHN,BUS"` |
| `refresh` | `30` | Aktualisierung in Sekunden (min. 20) |
| `favorites` | `true` | Favoriten-Chips anzeigen |
| `api_url` | `http://<ha-host>:8099` | Add-on-API überschreiben |

### YAML-Beispiele

Alle Favoriten als umschaltbare Tabs:

```yaml
type: custom:mvg-abfahrten-card
```

Alle Favoriten untereinander, ohne Titel und Uhr (z. B. fürs Wandtablet):

```yaml
type: custom:mvg-abfahrten-card
layout: list
show_title: false
show_clock: false
limit: 6
```

Feste Haltestelle (Beispiel Marienplatz):

```yaml
type: custom:mvg-abfahrten-card
global_id: "de:09162:2"
title: "Marienplatz"
types: "SBAHN,UBAHN"
limit: 6
```

> **Tipp:** Die `global_id` einer Haltestelle findest du über die Add-on-API im Browser, z. B. `http://<ha-host>:8099/api/search?q=ottobrunn` – Feld `globalId`. Einfacher ist aber der visuelle Editor: dort wählst du die Haltestelle direkt aus deinen Favoriten.

## API-Endpunkte (Port 8099)

- `GET /api/search?q=ottobrunn` – Haltestellensuche
- `GET /api/departures/<globalId>?limit=15&types=SBAHN,BUS` – Abfahrten
- `GET/POST /api/favorites`, `DELETE /api/favorites/<globalId>?types=...` – Favoriten

## Haftungsausschluss

Dies ist ein **privates Hobby-Projekt** ohne kommerziellen Hintergrund. Die Nutzung erfolgt auf eigene Gefahr – es gelten die Haftungsausschlüsse der [MIT-Lizenz](LICENSE); es besteht kein Anspruch auf Support oder Weiterentwicklung.

Dieses Add-on nutzt die **inoffizielle** MVG-API (`www.mvg.de/api/bgw-pt/v3`). Die Nutzung der Daten ist nur für **private, nicht-kommerzielle Zwecke** gestattet. Dies ist **kein offizielles Projekt** der MVG/MVV; alle Marken, Logos und Linienfarben gehören den jeweiligen Rechteinhabern.
