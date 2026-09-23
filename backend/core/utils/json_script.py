"""JSON injectable sans risque dans un <script> via `{{ valeur|safe }}`.

json.dumps n'échappe PAS « </script> » : une chaîne saisie par un
utilisateur (adresse de livraison, nom de restaurant…) pouvait refermer la
balise et exécuter du JavaScript dans la page d'un livreur ou de l'admin.
Même échappement que django.utils.html.json_script, sans la balise.
"""
import json

_ECHAPPEMENTS = {ord('<'): '\\u003C', ord('>'): '\\u003E', ord('&'): '\\u0026'}


def json_pour_script(valeur):
    return json.dumps(valeur).translate(_ECHAPPEMENTS)
