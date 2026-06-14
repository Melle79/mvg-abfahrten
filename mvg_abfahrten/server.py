"""MVG Abfahrten – Home Assistant Add-on Backend.

Proxy für die inoffizielle MVG-API (www.mvg.de/api/bgw-pt/v3) mit
In-Memory-Caching und persistenter Favoriten-Verwaltung unter /data.

Nutzung der MVG-API nur für private, nicht-kommerzielle Zwecke.
"""

import json
import logging
import os
import threading
import time
from pathlib import Path

import requests
from flask import Flask, jsonify, make_response, request, send_from_directory

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mvg-abfahrten")

MVG_BASE = "https://www.mvg.de/api/bgw-pt/v3"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

CACHE_TTL = int(os.environ.get("CACHE_TTL", "65"))
DEFAULT_LIMIT = int(os.environ.get("DEFAULT_LIMIT", "12"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
FAV_FILE = DATA_DIR / "favorites.json"
WWW_DIR = os.environ.get("WWW_DIR", "/www")
SEARCH_TTL = 3600  # Haltestellen ändern sich selten

PLANS_FILE = DATA_DIR / "plans.json"


def _load_plans() -> list:
    try:
        with _fav_lock:
            return json.loads(PLANS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def _save_plans(plans: list) -> None:
    with _fav_lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        PLANS_FILE.write_text(
            json.dumps(plans, ensure_ascii=False, indent=2), encoding="utf-8"
        )


def _new_id() -> str:
    import secrets
    return secrets.token_hex(8)

_cache: dict[str, tuple[float, object]] = {}
_cache_lock = threading.Lock()
_fav_lock = threading.Lock()


def _cached_get(path: str, params: dict, ttl: int):
    key = path + "?" + json.dumps(params, sort_keys=True, ensure_ascii=False)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    resp = requests.get(MVG_BASE + path, params=params, headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    with _cache_lock:
        _cache[key] = (now, data)
        # einfache Aufräumlogik, damit der Cache nicht unbegrenzt wächst
        if len(_cache) > 500:
            cutoff = now - max(ttl, SEARCH_TTL)
            for k in [k for k, (t, _) in _cache.items() if t < cutoff]:
                _cache.pop(k, None)
    return data


def _load_favorites() -> list:
    try:
        with _fav_lock:
            return json.loads(FAV_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def _save_favorites(favs: list) -> None:
    with _fav_lock:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        FAV_FILE.write_text(
            json.dumps(favs, ensure_ascii=False, indent=2), encoding="utf-8"
        )


app = Flask(__name__, static_folder=WWW_DIR, static_url_path="")

# ---------------------------------------------------------------- CORS
# Die Dashboard-Karte läuft im HA-Frontend (Port 8123) und ruft die API
# auf Port 8099 auf – dafür braucht es CORS-Freigaben.

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@app.route("/api/<path:_any>", methods=["OPTIONS"])
def cors_preflight(_any):
    return "", 204


# ---------------------------------------------------------------- Frontend

@app.get("/")
def index():
    resp = make_response(send_from_directory(WWW_DIR, "index.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@app.get("/card.js")
def card_js():
    resp = make_response(send_from_directory(WWW_DIR, "card.js"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


# ---------------------------------------------------------------- API

@app.get("/api/config")
def api_config():
    return jsonify({"default_limit": DEFAULT_LIMIT, "cache_ttl": CACHE_TTL})


@app.get("/api/search")
def api_search():
    query = (request.args.get("q") or "").strip()
    if len(query) < 2:
        return jsonify([])
    try:
        data = _cached_get("/locations", {"query": query}, SEARCH_TTL)
    except requests.RequestException as err:
        log.warning("MVG-Suche fehlgeschlagen: %s", err)
        return jsonify({"error": "MVG-API nicht erreichbar"}), 502

    results = [
        {
            "name": loc.get("name"),
            "place": loc.get("place"),
            "globalId": loc.get("globalId"),
            "transportTypes": loc.get("transportTypes", []),
        }
        for loc in data
        if loc.get("type") == "STATION" and loc.get("globalId")
    ]
    return jsonify(results[:30])


@app.get("/api/departures/<path:global_id>")
def api_departures(global_id: str):
    params = {
        "globalId": global_id,
        "limit": min(int(request.args.get("limit", DEFAULT_LIMIT)), 80),
    }
    types = (request.args.get("types") or "").strip()
    if types:
        params["transportTypes"] = types
    try:
        data = _cached_get("/departures", params, CACHE_TTL)
    except requests.RequestException as err:
        log.warning("MVG-Abfahrten fehlgeschlagen: %s", err)
        return jsonify({"error": "MVG-API nicht erreichbar"}), 502

    departures = [
        {
            "label":         dep.get("label"),
            "destination":   dep.get("destination"),
            "transportType": dep.get("transportType"),
            "planned":       dep.get("plannedDepartureTime"),
            "realtime":      dep.get("realtimeDepartureTime") or dep.get("plannedDepartureTime"),
            "delay":         dep.get("delayInMinutes") or 0,
            "platform":      dep.get("platform"),
            "platformChanged": bool(dep.get("platformChanged")),
            "cancelled":     bool(dep.get("cancelled")),
            "sev":           bool(dep.get("sev")),
            "messages":      dep.get("messages") or [],
            "infos":         dep.get("infos") or [],
            "occupancy":     dep.get("occupancy") or "UNKNOWN",
            "lineId":        dep.get("lineId") or "",
            # Richtung aus lineId ableiten: :H: = Hinfahrt (1), :R: = Rückfahrt (2)
            "direction":     1 if ":H:" in (dep.get("lineId") or "") else
                             2 if ":R:" in (dep.get("lineId") or "") else 0,
        }
        for dep in data
    ]
    return jsonify({"globalId": global_id, "departures": departures, "fetchedAt": int(time.time() * 1000)})


@app.get("/api/lines/<path:global_id>")
def api_lines(global_id: str):
    """Alle Linien einer Haltestelle – mit Alterungs-Logik (30d ausgegraut, 90d gelöscht)."""
    import datetime
    now = datetime.datetime.now(datetime.timezone.utc)
    DAY = 86400  # Sekunden

    all_lines = {}  # label → {type, lastSeen, stale, expired}

    # 1. Aktuelle Abfahrten von der API
    api_labels = set()
    for limit in [80, 40, 20]:
        try:
            resp = requests.get(
                MVG_BASE + "/departures",
                params={"globalId": global_id, "limit": limit},
                headers=HEADERS, timeout=10
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            if not isinstance(data, list):
                continue
            for dep in data:
                label = dep.get("label")
                if label:
                    api_labels.add(label)
                    if label not in all_lines:
                        all_lines[label] = {
                            "type":     dep.get("transportType", ""),
                            "lastSeen": now.isoformat(),
                            "stale":    False,
                            "expired":  False,
                        }
            if all_lines:
                break
        except requests.RequestException:
            continue

    # 2. Aus gespeicherten Plänen bekannte Linien ergänzen (mit Alterungs-Check)
    try:
        plans_changed = False
        plans = _load_plans()
        for plan in plans:
            for entry in plan.get("entries", []):
                if entry.get("globalId") != global_id:
                    continue

                # Rückwärtskompatibilität: lines-Feld direkt auslesen wenn kein lineHistory
                if not entry.get("lineHistory") and entry.get("lines"):
                    for lbl in (entry["lines"] or "").split(","):
                        lbl = lbl.strip()
                        if lbl and lbl not in all_lines:
                            all_lines[lbl] = {
                                "type":     "",
                                "lastSeen": now.isoformat(),
                                "stale":    False,
                                "expired":  False,
                                "fromHistory": True,
                            }
                    continue

                for line_info in entry.get("lineHistory", []):
                    label     = line_info.get("label", "")
                    ltype     = line_info.get("type", "")
                    last_seen = line_info.get("lastSeen", "")
                    if not label:
                        continue
                    try:
                        ls = datetime.datetime.fromisoformat(last_seen)
                        if ls.tzinfo is None:
                            ls = ls.replace(tzinfo=datetime.timezone.utc)
                        age_days = (now - ls).total_seconds() / DAY
                    except Exception:
                        age_days = 0

                    if age_days >= 90:
                        continue
                    if label in api_labels:
                        line_info["lastSeen"] = now.isoformat()
                        plans_changed = True
                        continue
                    if label not in all_lines:
                        all_lines[label] = {
                            "type":        ltype,
                            "lastSeen":    last_seen,
                            "stale":       age_days >= 30,
                            "expired":     False,
                            "fromHistory": True,
                        }

        # Aktuell von API gesehene Linien in lineHistory aller Einträge aktualisieren
        for plan in plans:
            for entry in plan.get("entries", []):
                if entry.get("globalId") != global_id:
                    continue
                history = {lh["label"]: lh for lh in entry.get("lineHistory", []) if lh.get("label")}
                for label in api_labels:
                    if label in history:
                        history[label]["lastSeen"] = now.isoformat()
                        plans_changed = True
                    else:
                        history[label] = {
                            "label":    label,
                            "type":     all_lines.get(label, {}).get("type", ""),
                            "lastSeen": now.isoformat(),
                        }
                        plans_changed = True
                # Abgelaufene (>90 Tage) entfernen
                new_history = []
                for lh in history.values():
                    try:
                        ls = datetime.datetime.fromisoformat(lh.get("lastSeen",""))
                        if ls.tzinfo is None:
                            ls = ls.replace(tzinfo=datetime.timezone.utc)
                        if (now - ls).total_seconds() / DAY < 90:
                            new_history.append(lh)
                        else:
                            plans_changed = True
                    except Exception:
                        new_history.append(lh)
                entry["lineHistory"] = new_history

        if plans_changed:
            _save_plans(plans)
    except Exception:
        pass

    return jsonify({"globalId": global_id, "lines": [
        {
            "label":       l,
            "type":        v["type"],
            "stale":       v.get("stale", False),
            "fromHistory": v.get("fromHistory", False),
        }
        for l, v in sorted(all_lines.items())
    ]})


@app.get("/api/favorites")
def api_favorites_get():
    return jsonify(_load_favorites())


@app.post("/api/favorites")
def api_favorites_add():
    body = request.get_json(silent=True) or {}
    global_id = body.get("globalId")
    if not global_id:
        return jsonify({"error": "globalId fehlt"}), 400
    filter_types    = (body.get("filterTypes")    or "").strip()
    platform_filter = (body.get("platformFilter") or "").strip()
    line_filter     = (body.get("lineFilter")     or "").strip()
    favs = _load_favorites()
    if not any(
        f.get("globalId") == global_id and
        (f.get("filterTypes")    or "") == filter_types and
        (f.get("platformFilter") or "") == platform_filter and
        (f.get("lineFilter")     or "") == line_filter
        for f in favs
    ):
        favs.append({
            "globalId":       global_id,
            "name":           body.get("name", global_id),
            "place":          body.get("place", ""),
            "transportTypes": body.get("transportTypes", []),
            "filterTypes":    filter_types,
            "platformFilter": platform_filter,
            "lineFilter":     line_filter,
        })
        _save_favorites(favs)
    return jsonify(favs)


@app.delete("/api/favorites/<path:global_id>")
def api_favorites_delete(global_id: str):
    filter_types    = (request.args.get("types")    or "").strip()
    platform_filter = (request.args.get("platform") or "").strip()
    line_filter     = (request.args.get("line")     or "").strip()
    favs = [
        f for f in _load_favorites()
        if not (
            f.get("globalId") == global_id and
            (f.get("filterTypes")    or "") == filter_types and
            (f.get("platformFilter") or "") == platform_filter and
            (f.get("lineFilter")     or "") == line_filter
        )
    ]
    _save_favorites(favs)
    return jsonify(favs)




# ---------------------------------------------------------------- Plans

@app.get("/plans")
def plans_page():
    resp = make_response(send_from_directory(WWW_DIR, "plans.html"))
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return resp


@app.get("/api/plans")
def api_plans_get():
    return jsonify(_load_plans())


@app.post("/api/plans")
def api_plans_create():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name fehlt"}), 400
    plans = _load_plans()
    plan = {
        "id":      _new_id(),
        "name":    name,
        "entries": body.get("entries", []),
    }
    plans.append(plan)
    _save_plans(plans)
    return jsonify(plan), 201


@app.put("/api/plans/<plan_id>")
def api_plans_update(plan_id: str):
    body = request.get_json(silent=True) or {}
    plans = _load_plans()
    for i, p in enumerate(plans):
        if p.get("id") == plan_id:
            plans[i] = {
                "id":      plan_id,
                "name":    (body.get("name") or p["name"]).strip(),
                "entries": body.get("entries", p.get("entries", [])),
            }
            _save_plans(plans)
            return jsonify(plans[i])
    return jsonify({"error": "Plan nicht gefunden"}), 404


@app.delete("/api/plans/<plan_id>")
def api_plans_delete(plan_id: str):
    plans = [p for p in _load_plans() if p.get("id") != plan_id]
    _save_plans(plans)
    return jsonify(plans)


@app.get("/api/plans/<plan_id>/departures")
def api_plans_departures(plan_id: str):
    """Liefert gefilterte Abfahrten für alle Einträge eines Plans."""
    plans = _load_plans()
    plan = next((p for p in plans if p.get("id") == plan_id), None)
    if not plan:
        return jsonify({"error": "Plan nicht gefunden"}), 404

    limit = min(int(request.args.get("limit", DEFAULT_LIMIT)), 80)
    results = []
    entry_sources = []  # Status pro Eintrag sammeln

    for entry in plan.get("entries", []):
        global_id = entry.get("globalId")
        if not global_id:
            continue
        params = {"globalId": global_id, "limit": limit * 4}
        if entry.get("types"):
            params["transportTypes"] = entry["types"]

        entry_source = "unavailable"
        raw = []
        try:
            cache_key = "/departures?" + json.dumps(params, sort_keys=True, ensure_ascii=False)
            with _cache_lock:
                hit = _cache.get(cache_key)
            if hit and (time.time() - hit[0]) < CACHE_TTL:
                entry_source = "cached"
                raw = hit[1]
            else:
                raw = _cached_get("/departures", params, CACHE_TTL)
                entry_source = "live"
        except requests.RequestException:
            entry_source = "unavailable"
            raw = []

        lines = set((entry.get("lines") or "").split(",")) - {""}
        direction = entry.get("direction") or ""

        # Abfahrten zählen die durch den Filter passen
        matching = [dep for dep in raw if not lines or dep.get("label") in lines]
        entry_sources.append((entry_source, len(matching)))

        for dep in raw:
            if lines and dep.get("label") not in lines:
                continue
            line_id = dep.get("lineId") or ""
            if direction == "H" and ":H:" not in line_id:
                continue
            if direction == "R" and ":R:" not in line_id:
                continue
            results.append({
                "stationName":   entry.get("stationName", global_id),
                "globalId":      global_id,
                "label":         dep.get("label"),
                "destination":   dep.get("destination"),
                "transportType": dep.get("transportType"),
                "planned":       dep.get("plannedDepartureTime"),
                "realtime":      dep.get("realtimeDepartureTime") or dep.get("plannedDepartureTime"),
                "delay":         dep.get("delayInMinutes") or 0,
                "platform":      dep.get("platform"),
                "platformChanged": bool(dep.get("platformChanged")),
                "cancelled":     bool(dep.get("cancelled")),
                "sev":           bool(dep.get("sev")),
                "occupancy":     dep.get("occupancy") or "UNKNOWN",
                "direction":     1 if ":H:" in line_id else 2 if ":R:" in line_id else 0,
                "infos":         dep.get("infos") or [],
                "messages":      dep.get("messages") or [],
            })

    # Status nur aus Einträgen ableiten die tatsächlich Abfahrten geliefert haben
    # Einträge ohne Abfahrten (Bus fährt gerade nicht) werden ignoriert
    priority = {"unavailable": 0, "cached": 1, "live": 2}
    active_sources = [s for s, count in entry_sources if count > 0]
    if not active_sources:
        # Kein Eintrag hat Abfahrten geliefert → schlechtesten Gesamtstatus nehmen
        all_sources = [s for s, _ in entry_sources]
        data_source = min(all_sources, key=lambda s: priority.get(s, 0)) if all_sources else "unavailable"
    else:
        data_source = min(active_sources, key=lambda s: priority.get(s, 0))

    results.sort(key=lambda d: d["realtime"])
    return jsonify({
        "plan":       {"id": plan["id"], "name": plan["name"]},
        "departures": results[:limit],
        "fetchedAt":  int(time.time() * 1000),
        "dataSource": data_source,
    })


if __name__ == "__main__":
    log.info("MVG Abfahrten startet auf Port 8099 (Cache-TTL %ss)", CACHE_TTL)
    app.run(host="0.0.0.0", port=8099)
