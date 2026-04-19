#!/usr/bin/env sh

set -eu

: "${WEB_SERVER_NAME:=localhost}"
export WEB_SERVER_NAME
envsubst '${API_URL} ${WEB_SERVER_NAME}' < /nginx.conf.template > /etc/nginx/conf.d/default.conf


exec "$@"