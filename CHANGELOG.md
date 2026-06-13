# Changelog

## v2.2.23 (2026-06-13)

### Neu: Abfahrtspläne
- **Neue Seite `/plans`** – Abfahrtspläne erstellen und verwalten
- **Plan-Assistent** – geführte Erstellung mit Haltestelle, Verkehrsmittel, Linie (Chips aus API), Richtung H/R mit Endziel-Vorschau
- **Mehrere Haltestellen pro Plan** – z. B. Neubiberg S-Bahn + Waldstraße Bus in einem Plan
- **Kacheln-Übersicht** mit Vorschau der nächsten 4 Abfahrten
- **Vollansicht** mit 60s-Countdown und Info-Popup
- **Navigation** zwischen Suche und Pläne per Tabs im Header
- **Backend**: neue API-Endpunkte `/api/plans` (CRUD), `/api/plans/<id>/departures`

### Neu: Karte erweitert
- **Abfahrtspläne auf der Karte** – `plan_ids` (Mehrfachauswahl) statt Favoriten
- **Mehrere Pläne** als Tabs oder untereinander
- **Filter-Info** unter den Tabs (Fahrtrichtung mit Endzielen, optional)
- **Haltestellenname** optional unter dem Ziel (`show_station`)
- **Laufschrift** für Störungsmeldungen rechts neben der Uhrzeit (`show_ticker`, optional)
- **Info-Popup** im Shadow DOM – funktioniert jetzt korrekt im Dashboard
- **Fix**: Doppelregistrierung des Custom Elements beim Navigieren behoben

### App verbessert
- **EARLY_TERMINATION**: Originalziel rot durchgestrichen, tatsächliches Ziel in Bernstein daneben
- **Info-Popup** beim Klick auf ⓘ (Störungen, Betriebsstörungen)
- **Gleisänderung** (`platformChanged`) in Bernstein mit ⚠ hervorgehoben
- **Auslastung** als Farbpunkt (🟢🟡🔴) in der Meta-Zeile
- **60s-Refresh** statt 30s, mit Countdown-Timer in der Fußzeile
- **Suche** zeigt Hinweis bei mehr als 30 Treffern
- Stern (★) und Richtungsfilter entfernt – saubere Basis

### Abfahrtspläne-Editor
- Linien als Chips gruppiert nach Verkehrsmittel (U-Bahn, S-Bahn, Tram, Bus, Bahn)
- Richtungs-Chips mit echten Endzielen aus aktuellen Abfahrten
- Manuelle Linieneingabe wenn API keine Linien liefert
- Haltestellen-Dropdown zeigt Verkehrsmittel-Badges

---

## v1.9.3 (2026-06-13)
- Favoriten-Assistent (Sheet von unten) mit Haltestellensuche, Verkehrsmittel, Linien, Richtung
- `/api/lines` Endpunkt (kein Cache, kein Filter)
- Navigation Suche ↔ Pläne

## v1.8.0 (2026-06-13)
- Richtungsfilter über `lineId` (`:H:` = Hinfahrt, `:R:` = Rückfahrt) – universell für alle Verkehrsmittel
- `infos`, `occupancy`, `platformChanged`, `lineId` im Backend durchgereicht

## v1.7.0 (2026-06-13)
- Richtungsfilter als Chips (Steig-basiert, später auf lineId umgestellt)

## v1.6.4 (2026-06-13)
- Limit greift nach clientseitigem Filter
- Fix: favKey-Migration

## v1.6.0 (2026-06-13)
- Linie + Ziel als kombinierbare Filter

## v1.5.0 (2026-06-13)
- Richtungsfilter in der App
- Haltestellensuche im Karten-Editor

## v1.4.0 (2026-06-13)
- Design „board" (dunkle Anzeigetafel)
- Titel und Uhrzeit abschaltbar

## v1.3.0 (2026-06-13)
- Favoriten mit Beförderungsart
- Layout Tabs oder untereinander

## v1.2.0 (2026-06-13)
- Visueller Karten-Editor (ha-form)

## v1.1.0 (2026-06-13)
- Dashboard-Karte (card.js), U7/U8 zweifarbige Badges

## v1.0.0 (2026-06-13)
- Erstveröffentlichung: Haltestellensuche, Abfahrtstafel, Ingress
