"""MQTT Discovery Publisher für MVG Abfahrten.

Veröffentlicht pro Abfahrtsplan einen Home Assistant Sensor via MQTT
Discovery. State = Minuten bis zur nächsten Abfahrt, Attribute = volle
Liste der nächsten Abfahrten (Linie, Ziel, Zeit, Gleis, Verspätung,
Störungstext, entfällt-Flag) für Templates oder eine eigene Karte.

Funktioniert unabhängig von der bestehenden REST-API/Lovelace-Karte und
benötigt keine eigene Authentifizierung – die Sensoren landen ganz normal
in Home Assistant und sind damit automatisch auch extern (Nabu Casa)
ohne zusätzliches Setup verfügbar.
"""

import json
import logging
import os
import threading
import time

log = logging.getLogger("mvg-abfahrten.mqtt")

DISCOVERY_PREFIX = "homeassistant"
NODE_ID = "mvg_abfahrten"


def _slugify(text: str) -> str:
    import re
    text = (text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
                .replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
                .replace("ß", "ss"))
    s = re.sub(r"[^a-zA-Z0-9_]+", "_", text.strip().lower())
    return re.sub(r"_+", "_", s).strip("_") or "plan"


class MqttPublisher:
    """Verwaltet die MQTT-Verbindung und veröffentlicht Plan-Sensoren
    periodisch in einem eigenen Hintergrund-Thread."""

    def __init__(self, load_plans_fn, compute_departures_fn, default_limit: int):
        self._load_plans = load_plans_fn
        self._compute_departures = compute_departures_fn
        self._default_limit = default_limit
        self._client = None
        self._connected = False
        self._stop = threading.Event()
        self._thread = None
        self._announced_ids = set()

        self.enabled = os.environ.get("MQTT_ENABLED", "true").lower() == "true"
        self.host = os.environ.get("MQTT_HOST", "")
        self.port = int(os.environ.get("MQTT_PORT", "1883") or "1883")
        self.user = os.environ.get("MQTT_USER", "")
        self.password = os.environ.get("MQTT_PASSWORD", "")
        self.interval = int(os.environ.get("MQTT_PUBLISH_INTERVAL", "60") or "60")

    # ------------------------------------------------------------ Lifecycle
    def start(self):
        if not self.enabled:
            log.info("MQTT deaktiviert (mqtt_enabled: false)")
            return
        if not self.host:
            log.warning("MQTT aktiviert, aber kein Broker-Host gefunden – Sensoren werden nicht veröffentlicht")
            return
        try:
            import paho.mqtt.client as mqtt
        except ImportError:
            log.error("paho-mqtt nicht installiert – MQTT-Sensoren nicht verfügbar")
            return

        client_id = f"mvg_abfahrten_{int(time.time())}"
        self._client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
        if self.user:
            self._client.username_pw_set(self.user, self.password or None)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect

        try:
            self._client.connect_async(self.host, self.port, keepalive=60)
            self._client.loop_start()
        except Exception as e:
            log.error("MQTT-Verbindung fehlgeschlagen: %s", e)
            return

        self._thread = threading.Thread(target=self._publish_loop, daemon=True)
        self._thread.start()
        log.info("MQTT-Publisher gestartet (%s:%s, Intervall %ss)", self.host, self.port, self.interval)

    def stop(self):
        self._stop.set()
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()

    # ------------------------------------------------------------ MQTT callbacks
    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
            log.info("MQTT verbunden")
        else:
            self._connected = False
            log.error("MQTT-Verbindung fehlgeschlagen (rc=%s)", rc)

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            log.warning("MQTT-Verbindung unterbrochen (rc=%s), automatischer Reconnect", rc)

    # ------------------------------------------------------------ Publish loop
    def _publish_loop(self):
        # Kurze initiale Wartezeit damit die Verbindung steht
        time.sleep(3)
        while not self._stop.is_set():
            try:
                self._publish_all()
            except Exception as e:
                log.warning("MQTT-Publish-Zyklus fehlgeschlagen: %s", e)
            self._stop.wait(self.interval)

    def _publish_all(self):
        if not self._connected or not self._client:
            return
        plans = self._load_plans()
        for plan in plans:
            try:
                self._publish_plan(plan)
            except Exception as e:
                log.warning("Plan %s konnte nicht veröffentlicht werden: %s", plan.get("name", "?"), e)

    def _publish_plan(self, plan: dict):
        plan_id = plan.get("id")
        name = plan.get("name") or plan_id
        slug = _slugify(name)
        object_id = f"mvg_{slug}"

        data = self._compute_departures(plan, self._default_limit)
        departures = data.get("departures", [])

        # State: Minuten bis zur nächsten (nicht ausgefallenen) Abfahrt
        next_dep = next((d for d in departures if not d.get("cancelled")), None)
        if next_dep and next_dep.get("realtime"):
            minutes = max(0, round((next_dep["realtime"] / 1000 - time.time()) / 60))
            state = minutes
        else:
            state = "unavailable" if not departures else "none"

        # Attribute: vollständige Abfahrtsliste, aufbereitet fürs Templating
        line_status = data.get("lineStatus") or {}
        overall_source = data.get("dataSource") or "unavailable"
        attr_departures = []
        for d in departures:
            messages = list(d.get("messages") or [])
            for info in d.get("infos") or []:
                if info.get("type") != "EARLY_TERMINATION" and info.get("message"):
                    messages.append(info["message"])
            realtime_ms = d.get("realtime")
            dep_minutes = (
                max(0, round((realtime_ms / 1000 - time.time()) / 60))
                if realtime_ms else None
            )
            label = d.get("label")
            dep_source = line_status.get(label) or line_status.get("*") or overall_source
            attr_departures.append({
                "line":          label,
                "transport_type": d.get("transportType"),
                "destination":   d.get("destination"),
                "station":       d.get("stationName"),
                "minutes":       dep_minutes,
                "planned":       d.get("planned"),
                "realtime":      d.get("realtime"),
                "delay":         d.get("delay"),
                "platform":      d.get("platform"),
                "platform_changed": d.get("platformChanged"),
                "cancelled":     d.get("cancelled"),
                "sev":           d.get("sev"),
                "messages":      messages,
                "data_source":   dep_source,
            })

        attributes = {
            "plan_id":     plan_id,
            "plan_name":   name,
            "data_source": overall_source,
            "line_status": line_status,
            "fetched_at":  data.get("fetchedAt"),
            "departures":  attr_departures,
            "friendly_name": f"MVG {name}",
            "unit_of_measurement": "min" if isinstance(state, int) else None,
            "icon": "mdi:bus-clock",
        }

        if object_id not in self._announced_ids:
            self._announce(object_id, name)
            self._announced_ids.add(object_id)

        state_topic = f"{NODE_ID}/sensor/{object_id}/state"
        attr_topic = f"{NODE_ID}/sensor/{object_id}/attributes"
        self._client.publish(state_topic, str(state), retain=True)
        self._client.publish(attr_topic, json.dumps(attributes, ensure_ascii=False), retain=True)

    def _announce(self, object_id: str, name: str):
        """Veröffentlicht die Discovery-Konfiguration für einen Plan-Sensor."""
        config_topic = f"{DISCOVERY_PREFIX}/sensor/{NODE_ID}/{object_id}/config"
        state_topic = f"{NODE_ID}/sensor/{object_id}/state"
        attr_topic = f"{NODE_ID}/sensor/{object_id}/attributes"
        payload = {
            "name": f"MVG {name}",
            "unique_id": f"{NODE_ID}_{object_id}",
            "state_topic": state_topic,
            "json_attributes_topic": attr_topic,
            "unit_of_measurement": "min",
            "icon": "mdi:bus-clock",
            "device": {
                "identifiers": [NODE_ID],
                "name": "MVG Abfahrten",
                "manufacturer": "Melle79",
                "model": "MVG Abfahrten Add-on",
            },
        }
        self._client.publish(config_topic, json.dumps(payload, ensure_ascii=False), retain=True)
        log.info("MQTT-Sensor registriert: sensor.%s_%s", NODE_ID, object_id)
