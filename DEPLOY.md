# OnlyPlans — Deploy & Update Guide

> **Für den Bot:** Dieses Dokument erklärt wie beide Frontends deployed und aktuell gehalten werden.

---

## Übersicht: Zwei Frontends

| Frontend | Verzeichnis | URL-Pfad | Typ |
|---|---|---|---|
| Landing Page | `Ramona/` | `/` | Statisches HTML (kein Build nötig) |
| Web App | `frontend/` | `/home/` | React + Vite (muss gebaut werden) |

Beide werden vom nginx-Container `onlyplans-web` auf Port 3000 ausgeliefert.

---

## GitHub Repository

**Repo:** `https://github.com/Silverstar187/OnlyPlans`
**Branch:** `master`
**Arbeitsverzeichnis auf Server:** `/root/onlyplans`

---

## Einmalige Einrichtung (falls noch nicht gemacht)

### 1. Git initialisieren

```bash
cd /root/onlyplans
git init
git remote add origin https://github.com/Silverstar187/OnlyPlans.git
git fetch origin
git reset origin/master
```

### 2. Node.js prüfen / installieren

```bash
node --version || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)
```

### 3. React App erstmals bauen

```bash
cd /root/onlyplans/frontend
npm install
npm run build
# Ausgabe liegt jetzt in /root/onlyplans/frontend/dist/
```

### 4. Nginx-Konfiguration updaten

Datei `/root/onlyplans/nginx/default.conf` muss `/home/` kennen.
Komplette Konfiguration:

```nginx
server {
    listen 80;

    # React Web App unter /home/
    location /home/ {
        alias /usr/share/nginx/home/;
        try_files $uri $uri/ /home/index.html;
    }

    # Supabase API
    location /supabase/ {
        proxy_pass http://kong:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # OpenClaw Gateway
    location /openclaw/ {
        proxy_pass http://onlyplans-openclaw-gateway:18789/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Landing Page (Ramona) — alles andere
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. Docker-Compose anpassen

Im `web`-Service in `/root/onlyplans/docker-compose.yml` ein zweites Volume ergänzen:

```yaml
services:
  web:
    volumes:
      - ./Ramona:/usr/share/nginx/html:ro
      - ./frontend/dist:/usr/share/nginx/home:ro        # NEU
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

### 6. nginx-Container neu starten

```bash
cd /root/onlyplans
docker compose up -d --force-recreate web
```

---

## Update-Prozess (neue Version deployen)

### Komplett-Update (beide Frontends)

```bash
cd /root/onlyplans

# 1. Neuesten Stand holen
git fetch origin

# 2. Ramona (Landing Page) updaten
git checkout origin/master -- Ramona/

# 3. React App updaten und neu bauen
git checkout origin/master -- frontend/src frontend/index.html frontend/vite.config.js frontend/package.json

cd /root/onlyplans/frontend
npm install
npm run build
cd /root/onlyplans

echo "Beide Frontends aktuell. Nginx serviert neue Dateien sofort."
```

> **Kein Container-Neustart nötig** — nginx liest die Dateien direkt aus den gemounteten Verzeichnissen.
> Ausnahme: Falls `docker-compose.yml` oder `nginx/default.conf` geändert wurde → `docker compose up -d --force-recreate web`

### Update-Script

Das Script `/root/onlyplans/update.sh` führt den obigen Prozess aus:

```bash
bash /root/onlyplans/update.sh
```

Inhalt des Scripts (einmalig anlegen):

```bash
#!/bin/bash
set -e
cd /root/onlyplans
git fetch origin
git checkout origin/master -- Ramona/ frontend/src frontend/index.html frontend/vite.config.js frontend/package.json
cd /root/onlyplans/frontend
npm install --silent
npm run build
cd /root/onlyplans
echo "Deploy abgeschlossen."
```

---

## Wichtige Pfade

| Was | Pfad auf Server |
|---|---|
| Projekt-Root | `/root/onlyplans/` |
| Landing Page Dateien | `/root/onlyplans/Ramona/` |
| React Source | `/root/onlyplans/frontend/src/` |
| React Build Output | `/root/onlyplans/frontend/dist/` |
| Nginx Config | `/root/onlyplans/nginx/default.conf` |
| Docker Compose | `/root/onlyplans/docker-compose.yml` |
| OpenClaw Config | `/root/onlyplans/data/openclaw.json` |
| Secrets (.env) | `/root/onlyplans/.env` — **nie anfassen, nicht in git** |

---

## Was NICHT angefasst werden darf

- `/root/onlyplans/.env` — Secrets, nie bearbeiten oder committen
- `/root/onlyplans/data/openclaw.json` — Bot-Konfiguration, nur über das OpenClaw-Interface ändern
- `/root/openclaw-fresh/` — Separater OpenClaw-Container, nichts damit zu tun
- `volumes/db/` — Supabase-Datenbankdaten

---

## Troubleshooting

### React App zeigt alte Version
```bash
cd /root/onlyplans/frontend
rm -rf dist node_modules/.vite
npm run build
```

### nginx serviert 404 für /home/
```bash
# Prüfen ob dist/ existiert
ls /root/onlyplans/frontend/dist/
# Falls leer: React App bauen (Schritt 3 oben)
# Falls Volume fehlt: docker-compose anpassen (Schritt 5 oben) + Container neu starten
```

### Container-Status prüfen
```bash
cd /root/onlyplans
docker compose ps
docker compose logs web --tail=20
```
