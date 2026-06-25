# Static web game (HTML + JS + inlined assets) served by nginx.
# No build step — the assets are already inlined into js/offline-assets.js.
FROM nginx:1.27-alpine

# nginx site config (gzip + sensible caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# the game itself (index.html, js/, static/) -> web root
COPY . /usr/share/nginx/html

EXPOSE 3000

# basic container healthcheck (Coolify will also use the proxy health)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/index.html || exit 1
