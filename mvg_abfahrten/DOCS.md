# MVG Abfahrten

Abfahrtsmonitor für MVG/MVV mit Haltestellensuche, Favoriten inkl. Beförderungsart, Echtzeitdaten und eigener Dashboard-Karte.

## Bedienung

1. Add-on starten und über die Seitenleiste (**MVG**) öffnen.
2. Haltestelle suchen, optional Verkehrsmittel-Filter setzen (U-Bahn, S-Bahn, Tram, Bus, Bahn).
3. Mit ★ als Favorit speichern – **die aktive Filterauswahl wird mitgespeichert**. So lässt sich dieselbe Haltestelle mehrfach anlegen, z. B. einmal nur S-Bahn und einmal nur Bus.
4. Favoriten erscheinen rechts neben der Suche und in der Dashboard-Karte.

## Optionen

| Option | Standard | Beschreibung |
|---|---|---|
| `cache_ttl` | 45 | Cache-Dauer für Abfahrten in Sekunden (10–300) |
| `default_limit` | 12 | Standardanzahl Abfahrten (1–80) |

Port **8099** stellt API und Dashboard-Karte im LAN bereit (ohne Authentifizierung – nur im Heimnetz verwenden).

## Dashboard-Karte

Einmalig als Ressource registrieren: **Einstellungen → Dashboards → ⋮ → Ressourcen → Hinzufügen** mit URL `http://<ha-host>:8099/card.js`, Typ **JavaScript-Modul**. Danach im Dashboard **Karte hinzufügen → „MVG Abfahrten"** – alle Einstellungen (Haltestelle, Layout Tabs/untereinander, Design, Titel/Uhr, Anzahl, Filter) im visuellen Editor.

Details und YAML-Beispiele: [README auf GitHub](https://github.com/Melle79/mvg-abfahrten)

## Haftungsausschluss

Dies ist ein **privates Hobby-Projekt** ohne kommerziellen Hintergrund. Die Nutzung erfolgt auf eigene Gefahr – es gelten die Haftungsausschlüsse der MIT-Lizenz; es besteht kein Anspruch auf Support oder Weiterentwicklung.

Dieses Add-on nutzt die **inoffizielle** MVG-API. Die Nutzung der Daten ist nur für **private, nicht-kommerzielle Zwecke** gestattet. Dies ist **kein offizielles Projekt** der MVG/MVV.
