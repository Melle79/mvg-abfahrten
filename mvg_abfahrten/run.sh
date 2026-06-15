#!/usr/bin/with-contenv bashio

export CACHE_TTL=$(bashio::config 'cache_ttl')
export DEFAULT_LIMIT=$(bashio::config 'default_limit')

# Interne HA-IP aus Netzwerkkonfiguration lesen
HA_IP=""
if [ -f /config/.storage/core.network_config ]; then
  HA_IP=$(python3 -c "
import json
data = json.load(open('/config/.storage/core.network_config'))
for iface in data.get('data', {}).get('configured', []):
    for addr in iface.get('ipv4', {}).get('address', []):
        ip = addr.split('/')[0]
        if not ip.startswith('127.') and not ip.startswith('172.'):
            print(ip)
            break
" 2>/dev/null | head -1)
fi

# Fallback: Gateway-IP des Containers → daraus HA-IP ableiten
if [ -z "$HA_IP" ]; then
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
