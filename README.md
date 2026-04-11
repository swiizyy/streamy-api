# StreamyAPI

API unifiée pour Streamyfin remplaçant Overseerr, StreamyStats, JFA-GO et Wizarr.

## Features

- 🔐 **Authentification** — JWT + tokens MediaBrowser compatibles Jellyfin
- 🎬 **Recherche & Requêtes** — Recherche TMDB, gestion des demandes de médias
- 📊 **Statistiques** — Historique de lecture, recommandations personnalisées
- 📥 **Downloads** — Synchronisation Radarr / Sonarr
- 🔔 **Webhooks** — Intégration Jellyfin webhooks
- 💌 **Invitations** — Système de parrainage avec quotas
- 🔗 **Référrals** — Gestion des comptes invités et expiration

## Quick Start

```bash
git clone https://github.com/swiizyy/streamy-api.git
cd streamy-api
cp .env.example .env
# Éditer .env avec tes clés (APP_KEY, JELLYFIN_API_KEY, TMDB_API_KEY)
docker-compose -f docker-compose.sqlite.yml up -d
```

L'API sera accessible sur `http://localhost:3333`.

## Configuration

| Variable | Requis | Défaut | Description |
|---|---|---|---|
| `APP_KEY` | ✅ | — | Clé secrète app (générer avec `node ace generate:key`) |
| `NODE_ENV` | — | `production` | Environnement (`development`, `production`, `test`) |
| `HOST` | — | `0.0.0.0` | Adresse d'écoute |
| `PORT` | — | `3333` | Port d'écoute |
| `LOG_LEVEL` | — | `info` | Niveau de log |
| `DB_CONNECTION` | — | `sqlite` | Driver DB (`sqlite` ou `pg`) |
| `SQLITE_FILENAME` | — | `tmp/db.sqlite3` | Chemin du fichier SQLite |
| `PG_HOST` | si pg | `postgres` | Hôte PostgreSQL |
| `PG_PORT` | si pg | `5432` | Port PostgreSQL |
| `PG_USER` | si pg | `streamy` | Utilisateur PostgreSQL |
| `PG_PASSWORD` | si pg | — | Mot de passe PostgreSQL |
| `PG_DB_NAME` | si pg | `streamy_api` | Nom de la base PostgreSQL |
| `JELLYFIN_URL` | ✅ | — | URL de l'instance Jellyfin |
| `JELLYFIN_API_KEY` | ✅ | — | API key admin Jellyfin |
| `JELLYFIN_WEBHOOK_SECRET` | — | — | Secret pour valider les webhooks |
| `TMDB_API_KEY` | ✅ | — | Clé API TMDB v3 |
| `DEFAULT_INVITE_QUOTA` | — | `5` | Invitations par utilisateur |
| `ACCOUNT_EXPIRY_NOTIFICATION_DAYS` | — | `3` | Jours avant notification d'expiration |
| `DOWNLOAD_SYNC_INTERVAL_SECONDS` | — | `60` | Intervalle de sync Radarr/Sonarr |
| `DISCORD_WEBHOOK_URL` | — | — | URL webhook Discord pour notifications |

## API Documentation

La documentation Swagger est disponible sur `/docs` une fois le serveur démarré.

## Configuration Jellyfin

### Créer une API key admin

1. Ouvrir Jellyfin → **Tableau de bord** → **Clés API**
2. Cliquer **+** pour créer une nouvelle clé
3. Copier la clé dans `JELLYFIN_API_KEY`

### Configurer les Webhooks

1. Installer le plugin **Webhook** depuis le catalogue Jellyfin
2. Ajouter une destination : `http://<streamy-api-host>:3333/webhooks/jellyfin`
3. Sélectionner les événements souhaités (lecture, pause, arrêt, nouveaux médias)
4. Définir le secret dans `JELLYFIN_WEBHOOK_SECRET`

## Configuration Radarr / Sonarr

Les instances Radarr et Sonarr se configurent via l'API admin de StreamyAPI :

```bash
# Ajouter une instance Radarr
POST /api/services
{
  "type": "radarr",
  "name": "Radarr",
  "url": "http://radarr:7878",
  "apiKey": "your-radarr-api-key"
}
```

## Développement

```bash
npm install
cp .env.example .env
# Éditer .env (NODE_ENV=development, HOST=localhost)
node ace migration:run
node ace serve --watch
node ace test
```

## Architecture

```
streamy-api/
├── app/
│   ├── Auth/           # Authentification (JWT + MediaBrowser)
│   ├── Seerr/          # Recherche & requêtes médias (compat. Overseerr)
│   └── StreamyStats/   # Statistiques & recommandations
├── config/             # Configuration AdonisJS
├── database/
│   └── migrations/     # Migrations Lucid ORM
├── start/
│   ├── routes.ts       # Routes HTTP
│   ├── kernel.ts       # Middlewares
│   └── env.ts          # Validation des variables d'environnement
└── tests/              # Tests
```

## License

MIT
