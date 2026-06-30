#!/usr/bin/with-contenv bashio

export CACHE_TTL=$(bashio::config 'cache_ttl')
export DEFAULT_LIMIT=$(bashio::config 'default_limit')

# Interne HA-IP: aus Konfiguration oder Fallback Gateway
HA_IP=$(bashio::config 'ha_ip' 2>/dev/null)
if [ -z "$HA_IP" ] || [ "$HA_IP" = "null" ] || [ "$HA_IP" = "" ]; then
  HA_IP=$(ip route | grep default | awk '{print $3}' | head -1)
  bashio::log.warning "ha_ip nicht konfiguriert – Fallback auf Gateway: ${HA_IP}"
  bashio::log.warning "Bitte ha_ip in der Add-on-Konfiguration setzen (z.B. 192.168.0.222)"
fi
bashio::log.info "HA IP: ${HA_IP}"

# card.js kopieren und MVG_API_URL einsetzen
mkdir -p /config/www
sed "s|window.MVG_API_URL = null|window.MVG_API_URL = 'http://${HA_IP}:8099'|g" \
    /card.js > /config/www/mvg-abfahrten-card.js
bashio::log.info "card.js → /config/www/mvg-abfahrten-card.js (API: http://${HA_IP}:8099)"

cp /sensor-card.js /config/www/mvg-abfahrten-sensor-card.js
bashio::log.info "sensor-card.js → /config/www/mvg-abfahrten-sensor-card.js"

bashio::log.info "Starte MVG Abfahrten (Cache-TTL: ${CACHE_TTL}s, Limit: ${DEFAULT_LIMIT})"

# MQTT: bashio-Service-Erkennung bevorzugen, manuelle Optionen als Override
export MQTT_ENABLED=$(bashio::config 'mqtt_enabled')
if bashio::services.available 'mqtt'; then
  AUTO_MQTT_HOST=$(bashio::services 'mqtt' 'host')
  AUTO_MQTT_PORT=$(bashio::services 'mqtt' 'port')
  AUTO_MQTT_USER=$(bashio::services 'mqtt' 'username')
  AUTO_MQTT_PASSWORD=$(bashio::services 'mqtt' 'password')
else
  AUTO_MQTT_HOST=""; AUTO_MQTT_PORT=""; AUTO_MQTT_USER=""; AUTO_MQTT_PASSWORD=""
fi

CFG_MQTT_HOST=$(bashio::config 'mqtt_host')
CFG_MQTT_PORT=$(bashio::config 'mqtt_port')
CFG_MQTT_USER=$(bashio::config 'mqtt_user')
CFG_MQTT_PASSWORD=$(bashio::config 'mqtt_password')

export MQTT_HOST="${CFG_MQTT_HOST:-$AUTO_MQTT_HOST}"
export MQTT_PORT="${CFG_MQTT_PORT:-${AUTO_MQTT_PORT:-1883}}"
export MQTT_USER="${CFG_MQTT_USER:-$AUTO_MQTT_USER}"
export MQTT_PASSWORD="${CFG_MQTT_PASSWORD:-$AUTO_MQTT_PASSWORD}"
export MQTT_PUBLISH_INTERVAL=$(bashio::config 'mqtt_publish_interval')

if [ "$MQTT_ENABLED" = "true" ] && [ -n "$MQTT_HOST" ]; then
  bashio::log.info "MQTT aktiv: ${MQTT_HOST}:${MQTT_PORT}"
else
  bashio::log.info "MQTT deaktiviert oder kein Broker gefunden – Sensoren werden nicht veröffentlicht"
fi

exec python3 /server.py
