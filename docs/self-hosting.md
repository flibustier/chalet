# Self-hosting GoatCounter and Chalet

This guide sets up the whole stack on a server of your own, with Docker:
[GoatCounter](https://www.goatcounter.com) records the visits of your websites, and Chalet
shows them. Plan for about half an hour.

**Do you need to host Chalet?** Not necessarily. Chalet is a static page that talks to your
GoatCounter from your browser, so the copy at https://flibustier.github.io/chalet/ works
with any GoatCounter, yours included, and your key stays in your browser. Host Chalet too if
you want everything on your own domain. This guide does both; leave out the `chalet` service
if you don't need it.

## What you need

- A server with [Docker](https://docs.docker.com/engine/install/) and Docker Compose. Both
  programs are light: a small VPS or a Raspberry Pi is plenty, and the images exist for
  `amd64` and `arm64`.
- A domain name, with two DNS records (`A`, and `AAAA` if your server has IPv6) pointing to
  the server. This guide uses `stats.example.com` for GoatCounter and `chalet.example.com`
  for Chalet: replace them with yours everywhere.
- Ports 80 and 443 open, for the HTTPS certificates (Let's Encrypt).

Then pick one of the two setups: **Docker Compose with Caddy** if the server has nothing
yet, or **behind your reverse proxy** if it already runs one (Traefik, with Portainer for
instance).

## Setup 1: Docker Compose with Caddy

[Caddy](https://caddyserver.com) receives the visits, gets the HTTPS certificates by itself
and passes each domain on to its service. Make a folder (say `analytics`) with three files.

`.env`, your two domains:

```sh
GOATCOUNTER_DOMAIN=stats.example.com
CHALET_DOMAIN=chalet.example.com
```

`compose.yaml`:

```yaml
services:
  goatcounter:
    image: arp242/goatcounter:2.7
    restart: unless-stopped
    volumes:
      - goatcounter-data:/home/goatcounter/goatcounter-data

  chalet:
    image: ghcr.io/flibustier/chalet:latest
    restart: unless-stopped

  caddy:
    image: caddy:2.11-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    environment:
      GOATCOUNTER_DOMAIN: ${GOATCOUNTER_DOMAIN}
      CHALET_DOMAIN: ${CHALET_DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  goatcounter-data:
  caddy-data:
  caddy-config:
```

`Caddyfile`:

```caddyfile
{$GOATCOUNTER_DOMAIN} {
	reverse_proxy goatcounter:8080
}

{$CHALET_DOMAIN} {
	reverse_proxy chalet:8080
}
```

Start everything from that folder:

```sh
docker compose up -d
```

The first time, Caddy takes a few seconds to get the certificates. If something goes
wrong, `docker compose logs caddy` tells you why: most often, a DNS record that doesn't point
to the server yet. Then go on to [your account](#create-your-site-and-account).

## Setup 2: behind your reverse proxy (Traefik, Portainer)

If the server already runs a reverse proxy, GoatCounter and Chalet only need to join it. Here
is the stack for [Traefik](https://traefik.io), with its labels. It expects:

- a Docker network named `proxy` that Traefik is on;
- an entrypoint named `websecure` (port 443);
- a certificate resolver named `letsencrypt`.

Use your own names if they differ.

```yaml
services:
  goatcounter:
    image: arp242/goatcounter:2.7
    restart: unless-stopped
    volumes:
      - goatcounter-data:/home/goatcounter/goatcounter-data
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy
      - traefik.http.routers.goatcounter.rule=Host(`${GOATCOUNTER_DOMAIN}`)
      - traefik.http.routers.goatcounter.entrypoints=websecure
      - traefik.http.routers.goatcounter.tls.certresolver=letsencrypt
      - traefik.http.services.goatcounter.loadbalancer.server.port=8080

  chalet:
    image: ghcr.io/flibustier/chalet:latest
    restart: unless-stopped
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy
      - traefik.http.routers.chalet.rule=Host(`${CHALET_DOMAIN}`)
      - traefik.http.routers.chalet.entrypoints=websecure
      - traefik.http.routers.chalet.tls.certresolver=letsencrypt
      - traefik.http.services.chalet.loadbalancer.server.port=8080

volumes:
  goatcounter-data:

networks:
  proxy:
    external: true
```

**With Portainer:** open *Stacks → Add stack*, give it a name, choose *Web editor* and paste
the stack above. Under *Environment variables*, add `GOATCOUNTER_DOMAIN` and
`CHALET_DOMAIN` with your domains, then *Deploy the stack*. To run the commands of the next
section, open the `goatcounter` container in Portainer and use its *Console* (command
`/bin/sh`), and leave out `docker compose exec goatcounter`.

**With Docker Compose:** save the stack as `compose.yaml` next to the `.env` file of setup 1,
and run `docker compose up -d`.

**With another proxy** (Nginx Proxy Manager, nginx, Caddy…): send `stats.example.com` to the
`goatcounter` container on port 8080, and `chalet.example.com` to `chalet` on port 8080, over
plain HTTP. GoatCounter works better when WebSockets go through too, and expects the usual
`X-Forwarded-For` and `X-Forwarded-Proto` headers, which most proxies send by default.

## Create your site and account

GoatCounter starts empty. Create your site and your account:

```sh
docker compose exec goatcounter goatcounter db create site -vhost stats.example.com -user.email you@example.com
```

It asks for a password. The site's name (`-vhost`) must be the address GoatCounter answers
on: here, `stats.example.com`.

Then sign in at https://stats.example.com and set your time zone: click your name at the
top right (the start of your email address), pick your *Timezone* under *Preferences* (or
*Set from browser*) and save. An account made from the command line starts on UTC, and
GoatCounter and Chalet start each day at that zone's midnight.

## Count the visits of your website

In GoatCounter, *Help* (at the top right) opens *Getting started*, with the line to add to
every page of your website, just before `</body>`. It looks like this:

```html
<script data-goatcounter="https://stats.example.com/count" async src="//stats.example.com/count.js"></script>
```

Visits show up within a few seconds. Pages opened from `localhost` or a local network
address aren't counted, so test on the real site.

## Open Chalet with a key

1. In GoatCounter, click your name at the top right, then *API*.
2. Name the key (say `Chalet`), tick **Read statistics** and **Read sites**, leave the rest
   unticked (Chalet only reads), and click *Add new*. *show* reveals the key.
3. Open https://chalet.example.com, enter `stats.example.com` and the key.

With *Read sites*, one key opens every site of your account; without it, Chalet shows the
site the key was made on. The key stays in the browser where you entered it.

## Keep it running

**Updates.** GoatCounter's version is fixed in the stack (`2.7`): read its
[release notes](https://github.com/arp242/goatcounter/releases) before you change it. It
updates its database by itself when it starts. Then, from the stack's folder:

```sh
docker compose pull
docker compose up -d
```

In Portainer, open the stack, turn on *Re-pull image and redeploy* and click *Update the
stack*.

**Backups.** Everything GoatCounter records is in its volume, in an SQLite database. Stop
GoatCounter for a moment so the copy is consistent, and save the volume as one archive:

```sh
docker compose stop goatcounter
docker compose cp goatcounter:/home/goatcounter/goatcounter-data - > "goatcounter-$(date +%F).tar"
docker compose start goatcounter
```

Visits that arrive in those few seconds are lost, so pick a quiet hour, and keep the archives
on another machine. To restore one, which replaces the current database:

```sh
docker compose stop goatcounter
docker compose cp - goatcounter:/home/goatcounter < goatcounter-2026-01-31.tar
docker compose start goatcounter
```

With Portainer, run the same from the server's command line with `docker` instead of
`docker compose`, and the container's name as Portainer shows it (for instance
`analytics-goatcounter-1`) instead of `goatcounter`. Chalet keeps nothing: it needs no
backup.

**Emails.** GoatCounter sends an email to reset a forgotten password. Without settings it
only writes the emails in its logs (`docker compose logs goatcounter`). To send them, add
to the `goatcounter` service:

```yaml
    environment:
      GOATCOUNTER_SMTP: smtp://user:password@smtp.example.com:587
      GOATCOUNTER_EMAIL_FROM: goatcounter@example.com
```

**Bigger sites.** SQLite does well for most sites. For a very busy one, GoatCounter can use
PostgreSQL: see the [GoatCounter README](https://github.com/arp242/goatcounter#postgresql).

## When something goes wrong

- **Chalet says "GoatCounter could not be reached at this address".** Open
  https://stats.example.com in the same browser: it must show GoatCounter over HTTPS. Some
  content blockers block addresses that contain `goatcounter`, which is one more reason to
  use a name of your own, like `stats.`.
- **"This API key cannot read statistics."** The key lacks the *Read statistics*
  permission. Create a new one with it.
- **Only one site in Chalet.** The key lacks the *Read sites* permission. Create a new one
  with it.
- **No visits.** Check the line on your website with your browser's developer tools
  (Network tab: a request to `/count`). Content blockers on your own computer may block it.

Chalet's own questions and ideas are welcome in its
[issues](https://github.com/flibustier/chalet/issues). For GoatCounter itself, see its
[documentation](https://www.goatcounter.com/help).
