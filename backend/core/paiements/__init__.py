"""Paiements multi-agrégateurs.

- base.py        : contrat commun des adaptateurs (+ types échangés)
- adaptateurs/   : un module par agrégateur (CamerPay, CinetPay, Campay, PawaPay)
- registre.py    : code → adaptateur
- routeur.py     : choix de l'agrégateur (pays, ville, opérateur), bascule de secours
- disjoncteur.py : mise à l'écart temporaire d'un agrégateur en panne
- traitement.py  : application d'un résultat de paiement (webhook / vérification)
- alertes.py     : alertes admin + e-mails d'urgence
"""
