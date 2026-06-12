#!/usr/bin/with-contenv bashio

export CACHE_TTL=$(bashio::config 'cache_ttl')
export DEFAULT_LIMIT=$(bashio::config 'default_limit')

bashio::log.info "Starte MVG Abfahrten (Cache-TTL: ${CACHE_TTL}s, Limit: ${DEFAULT_LIMIT})"

exec python3 /server.py
