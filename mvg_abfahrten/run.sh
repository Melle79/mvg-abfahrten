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

bashio::log.info "Starte MVG Abfahrten (Cache-TTL: ${CACHE_TTL}s, Limit: ${DEFAULT_LIMIT})"

exec python3 /server.py
