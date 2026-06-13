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
from flask import Flask, jsonify, request, send_from_directory

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

CACHE_TTL = int(os.environ.get("CACHE_TTL", "45"))
DEFAULT_LIMIT = int(os.environ.get("DEFAULT_LIMIT", "12"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
FAV_FILE = DATA_DIR / "favorites.json"
WWW_DIR = os.environ.get("WWW_DIR", "/www")
SEARCH_TTL = 3600  # Haltestellen ändern sich selten

app = Flask(__name__, static_folder=WWW_DIR, static_url_path="")

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
    return send_from_directory(WWW_DIR, "index.html")


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
    return jsonify(results[:15])


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
            "label": dep.get("label"),
            "destination": dep.get("destination"),
            "transportType": dep.get("transportType"),
            "planned": dep.get("plannedDepartureTime"),
            "realtime": dep.get("realtimeDepartureTime") or dep.get("plannedDepartureTime"),
            "delay": dep.get("delayInMinutes") or 0,
            "platform": dep.get("platform"),
            "cancelled": bool(dep.get("cancelled")),
            "sev": bool(dep.get("sev")),
            "messages": dep.get("messages") or [],
        }
        for dep in data
    ]
    return jsonify({"globalId": global_id, "departures": departures, "fetchedAt": int(time.time() * 1000)})


@app.get("/api/favorites")
def api_favorites_get():
    return jsonify(_load_favorites())


@app.post("/api/favorites")
def api_favorites_add():
    body = request.get_json(silent=True) or {}
    global_id = body.get("globalId")
    if not global_id:
        return jsonify({"error": "globalId fehlt"}), 400
    filter_types = (body.get("filterTypes") or "").strip()
    direction = (body.get("directionFilter") or "").strip()
    favs = _load_favorites()
    if not any(
        f.get("globalId") == global_id and
        (f.get("filterTypes") or "") == filter_types and
        (f.get("directionFilter") or "") == direction
        for f in favs
    ):
        favs.append({
            "globalId": global_id,
            "name": body.get("name", global_id),
            "place": body.get("place", ""),
            "transportTypes": body.get("transportTypes", []),
            "filterTypes": filter_types,
            "directionFilter": direction,
        })
        _save_favorites(favs)
    return jsonify(favs)


@app.delete("/api/favorites/<path:global_id>")
def api_favorites_delete(global_id: str):
    filter_types = (request.args.get("types") or "").strip()
    direction = (request.args.get("direction") or "").strip()
    favs = [
        f for f in _load_favorites()
        if not (
            f.get("globalId") == global_id and
            (f.get("filterTypes") or "") == filter_types and
            (f.get("directionFilter") or "") == direction
        )
    ]
    _save_favorites(favs)
    return jsonify(favs)


if __name__ == "__main__":
    log.info("MVG Abfahrten startet auf Port 8099 (Cache-TTL %ss)", CACHE_TTL)
    app.run(host="0.0.0.0", port=8099)
