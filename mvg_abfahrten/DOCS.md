# MVG Abfahrten

Abfahrtsmonitor für MVG/MVV mit Haltestellensuche, Abfahrtsplänen und Dashboard-Karte.

## Bedienung

### Tab „Suche"
Haltestelle eingeben → Abfahrten erscheinen mit Echtzeit-Daten. Der Countdown in der Fußzeile zeigt wann die nächste Aktualisierung (60s) stattfindet.

Bei Störungen erscheint ein rotes **ⓘ** – Klick öffnet das Info-Popup mit Details. Vorzeitige Endstationen werden mit durchgestrichenem Originalziel und tatsächlichem Ziel in Bernstein angezeigt.

### Tab „Pläne"
Abfahrtspläne kombinieren mehrere Haltestellen und Filter in einer Ansicht:

1. **+ Neuer Plan** → Name eingeben
2. **+ Haltestelle hinzufügen** → Haltestelle suchen
3. Optional: Verkehrsmittel, Linien (Chips) und Richtung (H · Hinfahrt / R · Rückfahrt) wählen
4. Weitere Haltestellen hinzufügen
5. **Speichern**

**Tipp:** Da die MVG-API manche Haltestellen nach Verkehrsmittel trennt (z. B. S-Bahn und Bus an verschiedenen Punkten), können mehrere Haltestellen-Einträge pro Plan sinnvoll sein.

## Dashboard-Karte

### Ressource registrieren (einmalig)
**Einstellungen → Dashboards → ⋮ → Ressourcen → Hinzufügen**
- URL: `http://<ha-host>:8099/card.js`
- Typ: **JavaScript-Modul**

### Karte konfigurieren
Im Dashboard **Karte hinzufügen → MVG Abfahrten**. Im visuellen Editor:

- **Abfahrtspläne**: Einen oder mehrere gespeicherte Pläne auswählen
- **Darstellung**: Tabs (umschaltbar) oder Untereinander (alle Pläne als Blöcke)
- **Design**: HA-Theme oder dunkle Anzeigetafel-Optik
- **Optionen**: Titel, Uhrzeit, Haltestellenname, Filter-Info, Laufschrift (Störungstext)

## Optionen

| Option | Standard | Beschreibung |
|---|---|---|
| `cache_ttl` | 45 | Cache-Dauer in Sekunden (10–300) |
| `default_limit` | 12 | Standardanzahl Abfahrten (1–80) |

## Hinweis

Basiert auf der inoffiziellen MVG-API – nur für private Nutzung. Port 8099 ist ohne Authentifizierung erreichbar – nur im Heimnetz verwenden.
