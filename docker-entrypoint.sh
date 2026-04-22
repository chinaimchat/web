#!/usr/bin/env sh

set -eu

: "${WEB_SERVER_NAME:=localhost}"
export WEB_SERVER_NAME

: "${API_URL:=http://server:8090/}"
# Nginx 在启动时会把 proxy_pass 里的主机名解析成 IP 并长期缓存；Docker 重建 backend 后 IP 会变，
# 导致 connect refused / 客户端 502。用变量 + resolver 让每次请求经 127.0.0.11 重新解析。
NGINX_API_UPSTREAM=$(printf '%s\n' "$API_URL" | sed -e 's|^[Hh][Tt][Tt][Pp][Ss]*://||' -e 's|/.*$||')
[ -z "$NGINX_API_UPSTREAM" ] && NGINX_API_UPSTREAM='server:8090'
export NGINX_API_UPSTREAM

envsubst '${WEB_SERVER_NAME} ${NGINX_API_UPSTREAM}' < /nginx.conf.template > /etc/nginx/conf.d/default.conf


exec "$@"