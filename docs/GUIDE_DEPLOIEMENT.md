# Guide de déploiement et de montée en charge — Menu

Guide pas à pas de tout ce qui se fait **côté serveur / infrastructure** — ce qui
ne peut pas être fait depuis le code.

Il est ordonné par priorité : la **Phase 0 (sécurité)** est urgente, les phases
suivantes vont du plus rentable au plus lourd. Chaque phase se termine par un
**point de contrôle** : ne passe à la suivante que si le contrôle passe.

> **Convention.** Les commandes précédées de `$` se lancent dans un terminal sur
> le serveur, dans le dossier `backend/` du projet, avec l'environnement Python
> du projet activé. Remplace tout ce qui est en `MAJUSCULES_SOULIGNÉES` par ta
> vraie valeur.

---

## Phase 0 — Sécurité immédiate ⚠️

À faire **avant tout le reste**. Ce ne sont pas des améliorations, ce sont des
fuites à colmater : deux secrets sont dans l'historique Git du projet.

### 0.1 — Nouvelle clé secrète Django

L'ancienne `SECRET_KEY` est dans Git. Tant qu'elle sert, un attaquant peut
forger des sessions et des jetons de connexion.

Génère-en une nouvelle :

```
$ python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copie la valeur produite et pose-la en variable d'environnement `SECRET_KEY`
(voir Phase 1 pour *où* poser les variables).

### 0.2 — Nouveau mot de passe de base de données

`Menu2026!` est aussi dans Git.

1. Dans cPanel → **MySQL Databases** → section *Current Users*, change le mot de
   passe de l'utilisateur de la base.
2. Reporte le nouveau mot de passe dans la variable `DB_PASSWORD`.

### 0.3 — Vérifier que la production n'est pas en mode debug

Si `DEBUG=True` en production, la moindre erreur affiche au visiteur la
configuration, les clés et des extraits de code. Pose `DEBUG=False`.

### ✅ Point de contrôle Phase 0

```
$ python -c "import os; print('DEBUG =', os.environ.get('DEBUG')); print('SECRET_KEY définie :', bool(os.environ.get('SECRET_KEY'))); print('DB_PASSWORD définie :', bool(os.environ.get('DB_PASSWORD')))"
```

Attendu : `DEBUG = False`, et les deux secrets à `True`.

---

## Phase 1 — Les variables d'environnement

Toute la configuration sensible se pilote par variables d'environnement — jamais
en dur dans le code. Voici **toutes** celles que `backend/settings.py` lit.

### Où les poser sur cPanel

cPanel → **Setup Python App** → sélectionne l'application → section
**Environment variables** → *Add variable* pour chacune. Après modification,
clique **Restart** (sinon les nouvelles valeurs ne sont pas prises en compte).

### Tableau des variables

| Variable | Obligatoire | Exemple | Rôle |
|---|---|---|---|
| `SECRET_KEY` | **Oui** (prod) | *(clé générée en 0.1)* | Signature des sessions/jetons |
| `DEBUG` | **Oui** | `False` | Jamais `True` en production |
| `ALLOWED_HOSTS` | **Oui** | `menu.cambus.cm,www.menu.cambus.cm` | Domaines autorisés (séparés par des virgules) |
| `DB_NAME` | Oui | `ch6973134ef1cfd_menu` | Nom de la base |
| `DB_USER` | Oui | `ch6973134ef1cfd_yan` | Utilisateur base |
| `DB_PASSWORD` | **Oui** | *(nouveau mot de passe en 0.2)* | Mot de passe base |
| `DB_HOST` | Non | `localhost` | Hôte base (défaut `localhost`) |
| `DB_PORT` | Non | `3306` | Port base |
| `REDIS_URL` | Recommandé | `redis://:MOT_DE_PASSE@127.0.0.1:55287/0` | Active cache + WebSockets partagés (Phase 3) |
| `CORS_ALLOWED_ORIGINS` | Selon besoin | `https://menu.cambus.cm` | Origines web autorisées à appeler l'API |
| `CSRF_TRUSTED_ORIGINS` | Selon besoin | `https://menu.cambus.cm` | Origines de confiance pour les formulaires |
| `APP_BASE_URL` | Non | `https://menu.cambus.cm` | URL publique (liens de retour) |
| `SECURE_SSL_REDIRECT` | Non | `True` | Force HTTPS (défaut `True` en prod) |
| `CAMERPAY_TOKEN` | Paiement | *(token dashboard CamerPay)* | Authentifie les appels API |
| `CAMERPAY_BASE_URL` | Paiement | `https://camerpay.biz/api` | Base URL de l'API CamerPay |
| `CAMERPAY_CALLBACK_SECRET` | Paiement | *(secret webhook CamerPay)* | Vérifie la signature HMAC des notifications |
| `CAMERPAY_PAYOUT_ENABLED` | Paiement | `True`/`False` | Active les décaissements automatiques |

> **Astuce sécurité.** La signature des webhooks CamerPay est TOUJOURS
> vérifiée (pas de bascule dev/prod) : sans `CAMERPAY_CALLBACK_SECRET`, aucune
> notification de paiement n'est acceptée — voir `core.api_views.camerpay_notify`.

### ✅ Point de contrôle Phase 1

```
$ python manage.py check --deploy
```

Cette commande liste les problèmes de configuration pour la production. Vise
zéro avertissement critique (des avertissements sur HSTS/cookies sont normaux si
le HTTPS est géré en amont).

---

## Phase 2 — Déployer une nouvelle version du code

À chaque mise à jour du code, dans l'ordre :

```
# 1. Récupérer le code
$ git pull

# 2. Installer les dépendances (django-redis et channels-redis sont nouveaux)
$ pip install -r requirements.txt

# 3. Appliquer les migrations de base de données
$ python manage.py migrate

# 4. Rassembler les fichiers statiques (CSS/JS de l'admin et des workspaces)
$ python manage.py collectstatic --noinput
```

### Commandes à lancer une seule fois (après ce déploiement-ci)

```
# Compte de démonstration (bouton « Visiter en invité » de l'app)
$ python manage.py creer_compte_demo

# Génère les aperçus allégés des images DÉJÀ en base
# (les nouvelles images sont traitées automatiquement à l'envoi)
$ python manage.py generer_apercus

# Remplit le cache de note des restaurants
$ python manage.py recalculer_notes
```

### À planifier (tâche cron)

La note d'un restaurant est pondérée par ses commandes ; cette pondération
dérive entre deux notes. Un rafraîchissement quotidien suffit.

cPanel → **Cron Jobs** → ajouter, une fois par jour (ex. 04h00) :

```
cd /home/UTILISATEUR/CHEMIN/backend && /home/UTILISATEUR/virtualenv/.../bin/python manage.py recalculer_notes
```

Et, toutes les 5 minutes, la relance des missions de livraison libre prises
mais jamais démarrées (sinon la commande reste bloquée) :

```
*/5 * * * * cd /home/UTILISATEUR/CHEMIN/backend && /home/UTILISATEUR/virtualenv/.../bin/python manage.py relancer_livraisons
```

*(adapte les chemins à ton hébergement — le chemin du `python` de l'app est
visible dans « Setup Python App ».)*

### Redémarrer l'application

Après toute modification de code ou de variables : cPanel → **Setup Python App**
→ **Restart**.

### ✅ Point de contrôle Phase 2

- La page d'accueil s'ouvre sans erreur.
- Une fiche plat avec compléments s'affiche correctement.
- Le bouton « Visiter en invité » de l'app connecte bien.

> ⚠️ **Rappel.** Les tests automatiques tournent sur SQLite ; la production est
> sur MySQL. Fais toujours une **vérification visuelle** de la page d'accueil
> (classement par note) et d'une fiche plat après déploiement.

---

## Phase 3 — Activer Redis (cache + WebSockets)

Redis tourne déjà sur ton hébergement. Il ne reste qu'à le brancher — c'est le
changement qui **débloque le multi-worker** et absorbe les pics de trafic.

### 3.1 — Poser la variable

```
REDIS_URL=redis://:MOT_DE_PASSE@127.0.0.1:55287/0
```

- Le **`:` devant le mot de passe est obligatoire** (pas de nom d'utilisateur).
- `55287` = ton port Redis, `0` = numéro de base (une des 16).
- Si le mot de passe contient des caractères spéciaux (`@ : / # ?`), encode-les
  en URL (`@` → `%40`, `#` → `%23`, etc.).

### 3.2 — Redémarrer et vérifier

```
# Redis répond ?
$ redis-cli -p 55287 -a 'MOT_DE_PASSE' ping          # → PONG

# Django utilise bien Redis (et pas le repli local) ?
$ python manage.py shell -c "from django.conf import settings; print(settings.CACHES['default']['BACKEND'])"
# Attendu : django_redis.cache.RedisCache
```

Si la 2ᵉ commande affiche encore `LocMemCache`, la variable n'est pas vue par le
process : vérifie qu'elle est bien dans l'environnement de l'app et **redémarre**.

### ✅ Point de contrôle Phase 3

- `RedisCache` affiché ci-dessus.
- La page d'accueil reste rapide même en rechargeant plusieurs fois (elle est
  mise en cache 60 s).

> **Comportement de repli.** Si `REDIS_URL` est absente, le code retombe
> automatiquement sur un cache local + WebSockets en mémoire — pratique en
> développement, mais **ne fonctionne qu'avec un seul worker**.

---

## Phase 4 — Décharger les médias (le meilleur gain)

**Le problème.** Aujourd'hui, chaque image et vidéo est servie par Django
(`/media/...`). Sous charge, ce sont ces téléchargements qui saturent les
workers Python **en premier** — avant même la base de données. Un worker occupé
à pousser une image ne traite aucune requête API pendant ce temps.

L'optimisation d'aperçus déjà en place a divisé le poids par ~20, mais servir des
fichiers n'est pas le rôle de Python. Deux approches, de la plus simple à la
meilleure.

### Option A — Servir `/media` par le serveur web (rapide)

Si un serveur web (nginx/Apache) est devant l'application, fais-lui servir le
dossier `media/` directement, sans passer par Django.

**Apache / cPanel (`.htaccess` à la racine web) :**

```apache
# Sert les fichiers média directement, sans réveiller Python
RewriteEngine On
RewriteRule ^media/(.*)$ /home/UTILISATEUR/CHEMIN/backend/media/$1 [L]
```

**nginx (si tu y as accès) :**

```nginx
location /media/ {
    alias /home/UTILISATEUR/CHEMIN/backend/media/;
    expires 30d;
    access_log off;
}
```

### Option B — Stockage objet + CDN (la vraie solution)

Envoyer les médias sur un stockage objet (Cloudflare R2, Bunny, AWS S3) servi par
un CDN. Les fichiers sont alors distribués depuis des serveurs répartis
géographiquement, et ton application ne les voit plus passer du tout.

Côté Django, cela se configure via `django-storages` (le champ `default` de
`STORAGES` dans `settings.py`). C'est une évolution de code que je peux préparer
le moment venu — dis-le-moi et je l'implémente avec le repli local pour le dev.

### ✅ Point de contrôle Phase 4

Ouvre une image directement, ex. `https://TON_DOMAINE/media/publications/apercus/...`.
Dans les outils développeur du navigateur (onglet Réseau), l'en-tête de réponse
ne doit **pas** montrer de trace Django (`Server: nginx` ou en-têtes du CDN, pas
`WSGIServer`/`daphne`).

---

## Phase 5 — Les WebSockets en production (point d'attention)

L'application a des fonctions **temps réel** (notifications de commande côté
restaurant et livreur) qui reposent sur les WebSockets (Django Channels, ASGI).

**Le hic sur hébergement mutualisé.** cPanel exécute en général les applications
Python en mode **WSGI** (Passenger), qui ne gère **pas** les WebSockets. Sur ce
type d'hébergement, le temps réel peut donc ne pas fonctionner correctement — et
c'est indépendant de la qualité du code.

Pour un vrai support WebSocket, il faut faire tourner un serveur **ASGI**
(Daphne ou Uvicorn) comme processus séparé, derrière un reverse proxy qui route
`/ws/` vers lui. C'est nettement plus simple sur un VPS (Phase 6) que sur du
mutualisé.

**En attendant :** avec `REDIS_URL` posée (Phase 3), l'infrastructure temps réel
est prête à fonctionner en multi-worker *dès que* l'hébergement le permet. Aucune
action de code supplémentaire n'est requise — c'est une contrainte
d'hébergement, pas de programme.

---

## Phase 6 — Quitter l'hébergement mutualisé (le vrai plafond)

C'est le point le plus lourd, mais **c'est la seule chose qui lève réellement le
plafond**. Un compte mutualisé limite le nombre de connexions à la base
(souvent 25–50) et partage le CPU avec d'autres sites : aucune optimisation de
code ne contourne cela.

### La cible

```
        Utilisateurs (app mobile)
                 │
              [ CDN ]  ← images, vidéos (Phase 4, option B)
                 │
             [ nginx ]  ← reverse proxy + sert /media
                 │
     [ Daphne/Uvicorn ×N workers ]  ← ASGI, gère HTTP + WebSockets
                 │
     [ Redis ]      [ PostgreSQL ou MySQL managé ]
   cache/WS/tâches    connexions poolées (PgBouncer)
```

### Étapes indicatives

1. **Louer un VPS** (2 vCPU / 4 Go pour démarrer) chez un hébergeur proche de tes
   utilisateurs.
2. **Installer** : Python, le serveur de base, Redis, nginx.
3. **Faire tourner l'app avec Daphne/Uvicorn** sous un gestionnaire de processus
   (systemd ou supervisor) — plusieurs workers.
4. **nginx en frontal** : termine le HTTPS, sert `/media`, route le reste vers
   les workers ASGI (y compris `/ws/` pour les WebSockets).
5. **Base managée + PgBouncer** pour mutualiser les connexions.
6. **Migrer les données** depuis l'hébergement actuel.

C'est un chantier à part entière ; je peux te rédiger un guide dédié pour cette
phase quand tu y seras.

---

## Phase 7 — Mesurer, ne pas deviner

Avant et après chaque changement, mesure avec le test de charge fourni
(dossier `load_test/`).

```
$ pip install -r load_test/requirements.txt
$ locust -f load_test/locustfile.py --host https://TON_DOMAINE_DE_PREPROD
```

Interface sur <http://localhost:8089> : 1000 utilisateurs, montée à 50/seconde.

**Trois chiffres à surveiller :**

1. **Taux d'échec** — doit rester ~0 %. S'il monte avec la charge : une limite
   est atteinte (souvent les connexions base).
2. **p95** (temps de réponse du 95ᵉ centile) — cible < 500 ms en lecture.
3. **La première route qui se dégrade** — suspects connus : `/nearby` (calcul de
   distance en Python) et les médias.

> ⚠️ Un test de charge **est** une charge : ne le lance jamais contre la
> production sans prévenir. Utilise une préproduction ou une fenêtre calme
> annoncée. Vérifie aussi que les identifiants dans `load_test/locustfile.py`
> existent dans la base ciblée.

Détails complets dans [`load_test/README.md`](../load_test/README.md).

---

## Récapitulatif — la checklist

**Urgent (Phase 0) :**
- [ ] Nouvelle `SECRET_KEY`
- [ ] Nouveau `DB_PASSWORD`
- [ ] `DEBUG=False` confirmé

**À chaque déploiement (Phase 2) :**
- [ ] `git pull` → `pip install -r requirements.txt`
- [ ] `python manage.py migrate`
- [ ] `python manage.py collectstatic --noinput`
- [ ] Redémarrer l'app
- [ ] Vérification visuelle (accueil + fiche plat)

**Une fois (après ce déploiement) :**
- [ ] `creer_compte_demo`
- [ ] `generer_apercus`
- [ ] `recalculer_notes` (+ cron quotidien)
- [ ] `relancer_livraisons` en cron (toutes les 5 min) — remet au pool les
      missions de livraison libre prises mais jamais démarrées
- [ ] App mobile : `npx expo install` (nouvelles dépendances : `expo-notifications`,
      `expo-keep-awake`, `react-native-qrcode-svg`) puis build EAS avec les
      identifiants push (clé FCM Android + clé APNs iOS) pour les notifications
- [ ] Régler la part livreur / le seuil de versement dans
      `/admin-panel/livreurs/parametrage/` (défauts : 70 %, 5 000 F)
- [ ] Barème de livraison par distance : chaque restaurant doit enregistrer
      sa **position GPS** puis ses tranches de prix dans `/admin-panel/resto/profil/`
      (« Barème de livraison par distance »). Sans barème, le « frais de repli »
      s'applique. Au-delà de la dernière tranche, le client est hors zone.
      Côté admin : coefficient routier global (défaut 1,3) sur
      `/admin-panel/livreurs/parametrage/` ; suivi des restos non configurés
      dans la liste `/admin-panel/restaurants/` (badge) ; édition de dépannage
      du barème d'un resto depuis sa fiche.

**Montée en charge, par ordre de rentabilité :**
- [ ] Phase 3 — poser `REDIS_URL`
- [ ] Phase 4 — décharger les médias (nginx puis CDN)
- [ ] Phase 6 — quitter le mutualisé (VPS) — le vrai plafond
- [ ] Phase 7 — mesurer avant/après

---

## Dépannage courant

| Symptôme | Cause probable | Vérification |
|---|---|---|
| Page blanche / erreur 500 sans détail | `DEBUG=False` + erreur applicative | Consulter les logs de l'app (cPanel → *Errors*, ou le log Passenger) |
| Cache toujours `LocMemCache` | `REDIS_URL` non vue par le process | Reposer la variable **et redémarrer** l'app |
| Note des restaurants à 0 partout | `recalculer_notes` jamais lancé | Lancer `python manage.py recalculer_notes` |
| Images en pleine résolution (lentes) | `generer_apercus` jamais lancé | Lancer `python manage.py generer_apercus` |
| Bouton « Visiter en invité » échoue | Compte démo absent | Lancer `python manage.py creer_compte_demo` |
| Notifications temps réel muettes | WebSockets non supportés (mutualisé) | Voir Phase 5 — nécessite un serveur ASGI |
| Webhook de paiement rejeté (403) | `CAMERPAY_CALLBACK_SECRET` absent ou différent du dashboard | Vérifier la valeur dans cPanel/`.env` contre Dashboard CamerPay > API & webhooks |
