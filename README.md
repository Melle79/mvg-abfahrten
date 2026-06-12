# MVG Abfahrten – Home Assistant Add-on

Abfahrtsmonitor für MVG/MVV mit Haltestellensuche (Live-Autocomplete), Verkehrsmittel-Filtern, persistenten Favoriten und Echtzeitdaten – als eigenständiges Home-Assistant-Add-on mit Ingress.

## Features

- 🔍 Haltestellensuche mit Dropdown (MVG-Locations-API)
- 🚇 Filter nach U-Bahn, S-Bahn, Tram, Bus, Bahn
- ⭐ Favoriten, persistent unter `/data/favorites.json`
- ⏱ Echtzeit-Abfahrten mit Verspätung (+x), Gleis, SEV- und Ausfall-Kennzeichnung
- 🔄 Auto-Refresh alle 30 s, serverseitiges Caching (Standard: 45 s)
- 🎨 Anzeigetafel-Design (dunkel, Linien-Badges in offiziellen Farben)

## Installation

1. In Home Assistant: **Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories**
2. `https://github.com/Melle79/mvg-abfahrten` hinzufügen
3. **MVG Abfahrten** installieren und starten
4. Über die Seitenleiste (**MVG**) öffnen

## Optionen

| Option | Standard | Beschreibung |
|---|---|---|
| `cache_ttl` | 45 | Cache-Dauer für Abfahrten in Sekunden (10–300) |
| `default_limit` | 12 | Standardanzahl Abfahrten (1–80) |

## API-Endpunkte (intern, via Ingress)

- `GET /api/search?q=ottobrunn` – Haltestellensuche
- `GET /api/departures/<globalId>?limit=15&types=SBAHN,BUS` – Abfahrten
- `GET/POST /api/favorites`, `DELETE /api/favorites/<globalId>` – Favoriten

## Hinweis

Dieses Add-on nutzt die **inoffizielle** MVG-API (`www.mvg.de/api/bgw-pt/v3`). Die Nutzung der Daten ist nur für private, nicht-kommerzielle Zwecke gestattet. Kein offizielles Projekt der MVG/MVV.
