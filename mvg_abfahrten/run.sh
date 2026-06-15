#!/usr/bin/with-contenv bashio

export CACHE_TTL=$(bashio::config 'cache_ttl')
export DEFAULT_LIMIT=$(bashio::config 'default_limit')

# Interne IP ermitteln
HA_IP=$(bashio::network.ipv4_address | cut -d'/' -f1)
bashio::log.info "HA IP: ${HA_IP}"

# card.js kopieren und MVG_API_URL einsetzen
mkdir -p /config/www
sed "s|window.MVG_API_URL = null|window.MVG_API_URL = 'http://${HA_IP}:8099'|g" \
    /card.js > /config/www/mvg-abfahrten-card.js
bashio::log.info "card.js → /config/www/mvg-abfahrten-card.js (API: http://${HA_IP}:8099)"

bashio::log.info "Starte MVG Abfahrten (Cache-TTL: ${CACHE_TTL}s, Limit: ${DEFAULT_LIMIT})"

exec python3 /server.py
