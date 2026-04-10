#!/bin/sh
set -e

cat >/etc/nginx/conf.d/default.conf <<'EOF'
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ =404;
  }
}
EOF

nginx -g "daemon off;"