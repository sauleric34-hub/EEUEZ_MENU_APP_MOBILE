# Test de charge — Menu

Simule un trafic réaliste pour trouver **où** l'application casse en premier,
avant de payer pour du matériel qu'on suppose nécessaire. On mesure, on ne
devine pas.

## Installation

```bash
pip install -r load_test/requirements.txt
```

## Lancer

### Avec interface (recommandé la première fois)

```bash
locust -f load_test/locustfile.py --host https://menu.cambus.cm
```

Puis ouvrir <http://localhost:8089> et renseigner :

| Champ | Valeur | Pourquoi |
|-------|--------|----------|
| Number of users | `1000` | La cible visée |
| Ramp up | `50` | Montée à 50 utilisateurs/seconde — jamais 1000 d'un coup, sinon on teste un pic irréaliste |

### Sans interface (automatisable)

```bash
locust -f load_test/locustfile.py --host https://menu.cambus.cm \
       --headless -u 1000 -r 50 -t 3m --csv=resultats
```

Génère `resultats_stats.csv` (temps de réponse par route) et
`resultats_failures.csv` (erreurs).

## ⚠️ À faire d'abord

- **Ne jamais lancer contre la production** sans prévenir : un test de charge
  EST une charge. Utiliser une préproduction, ou une fenêtre calme annoncée.
- **Vérifier les identifiants** dans `locustfile.py` (`IDS_RESTAURANTS`,
  `IDS_PLATS`) : ils doivent exister dans la base ciblée, sinon on ne mesure
  que des 404 (rapides et trompeurs).

## Lire les résultats

Trois chiffres comptent :

1. **Taux d'échec** — doit rester à ~0 %. Des erreurs qui montent avec la
   charge = une limite atteinte (souvent les connexions MySQL).
2. **p95** (95ᵉ centile du temps de réponse) — le vécu du « pire » utilisateur.
   Une cible saine : < 500 ms sur les routes de lecture.
3. **La route qui se dégrade la première.** D'après la lecture du code, les
   suspects sont, dans l'ordre :
   - `/api/client/restaurants/nearby` — calcul de distance sur tous les
     restaurants, en Python, à chaque appel ;
   - toute route servant des médias (déchargée si on passe par nginx/CDN) ;
   - le catalogue si le cache n'est pas branché sur Redis.

`/ (accueil)` est mis en cache (60 s) : il doit rester rapide quoi qu'il
arrive. S'il ralentit, c'est que le cache n'est pas actif (REDIS_URL absent en
prod, ou `DEBUG=True` qui désactive `cache_page`).

## Interpréter, puis agir

Le test ne corrige rien — il dit **par où commencer**. L'ordre d'attaque
recommandé reste : médias → nginx/CDN, puis Redis, puis quitter l'hébergement
mutualisé. On relance ce test après chaque changement pour chiffrer le gain.
