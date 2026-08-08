# Migration manuelle — passage Monetbil → CamerPay : ajoute le champ de
# référence fournisseur (transaction_uuid CamerPay) sur Transaction et Reservation.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_commande_livraison_libre'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='provider_reference',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='reservation',
            name='provider_reference',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
