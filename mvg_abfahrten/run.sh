#!/usr/bin/with-contenv bashio

export CACHE_TTL=$(bashio::config 'cache_ttl')
export DEFAULT_LIMIT=$(bashio::config 'default_limit')

# Interne HA-IP über Supervisor-API ermitteln (braucht auth_api: true)
HA_IP=$(bashio::network.ipv4_address 2>/dev/null | cut -d'/' -f1)
if [ -z "$HA_IP" ] || [ "$HA_IP" = "null" ]; then
  # Fallback: Default-Gateway (meist HA-Host bei UTM-VM)
  HA_IP=$(ip route | grep default | awk '{print $3}' | head -1)
fi
bashio::log.info "HA IP: ${HA_IP}"

# card.js kopieren und MVG_API_URL einsetzen
mkdir -p /config/www
sed "s|window.MVG_API_URL = null|window.MVG_API_URL = 'http://${HA_IP}:8099'|g" \
    /card.js > /config/www/mvg-abfahrten-card.js
bashio::log.info "card.js → /config/www/mvg-abfahrten-card.js (API: http://${HA_IP}:8099)"

bashio::log.info "Starte MVG Abfahrten (Cache-TTL: ${CACHE_TTL}s, Limit: ${DEFAULT_LIMIT})"

exec python3 /server.py
