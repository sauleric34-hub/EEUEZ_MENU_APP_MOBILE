from django.db import migrations


def backfill(apps, schema_editor):
    """Rétro-remplit les frais de livraison figés sur les commandes existantes.

    frais_livraison ≈ montant_total − part restaurant − commission plateforme
    (borné ≥ 0). part_livreur = 70 % (valeur par défaut historique)."""
    Commande = apps.get_model('core', 'Commande')
    a_maj = []
    for cmd in Commande.objects.all().iterator():
        if cmd.frais_livraison:
            continue
        frais = float(cmd.montant_total or 0) - float(cmd.montant_restaurant or 0) \
            - float(cmd.commission_eeuez or 0)
        frais = max(0, round(frais))
        if not frais and cmd.restaurant_id:
            frais = float(getattr(cmd.restaurant, 'frais_livraison', 0) or 0)
        cmd.frais_livraison = frais
        cmd.part_livreur = round(frais * 0.7)
        a_maj.append(cmd)
        if len(a_maj) >= 500:
            Commande.objects.bulk_update(a_maj, ['frais_livraison', 'part_livreur'])
            a_maj = []
    if a_maj:
        Commande.objects.bulk_update(a_maj, ['frais_livraison', 'part_livreur'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_parametragelivraison_commande_frais_livraison_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
