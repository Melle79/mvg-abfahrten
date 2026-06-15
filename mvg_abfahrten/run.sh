#!/usr/bin/with-contenv bashio

export CACHE_TTL=$(bashio::config 'cache_ttl')
export DEFAULT_LIMIT=$(bashio::config 'default_limit')

# card.js in /config/www/ kopieren damit sie über /local/mvg-card.js erreichbar ist
mkdir -p /config/www
cp /www/card.js /config/www/mvg-abfahrten-card.js
bashio::log.info "card.js → /config/www/mvg-abfahrten-card.js"

bashio::log.info "Starte MVG Abfahrten (Cache-TTL: ${CACHE_TTL}s, Limit: ${DEFAULT_LIMIT})"

exec python3 /server.py
