"""Sépare « type de plat » et « catégorie ».

Les anciennes catégories qui décrivaient un moment du repas (Entrées, Plats de
résistance, Desserts, Boissons) deviennent le champ Plat.type_plat ; elles
sont ensuite supprimées et remplacées par de vraies catégories de cuisine.
"""

from django.db import migrations

# Ancienne catégorie → type_plat
TYPES_REPAS = {
    'Entrées': 'entree',
    'Entrée': 'entree',
    'Plats de résistance': 'resistance',
    'Plat de résistance': 'resistance',
    'Desserts': 'dessert',
    'Dessert': 'dessert',
    'Boissons': 'boisson',
    'Boisson': 'boisson',
}

NOUVELLES_CATEGORIES = [
    'Plats traditionnels',
    'Grillades',
    'Soupes & Bouillons',
    'Poulet & Volailles',
    'Poissons & Fruits de mer',
    'Viandes',
    'Riz & Pâtes',
    'Végétarien',
    'Fast-food & Burgers',
    'Pizzas',
    'Sandwichs & Snacks',
    'Salades',
    'Pâtisseries & Glaces',
    'Jus naturels',
    'Cuisine internationale',
]


def separer_types(apps, schema_editor):
    Categorie = apps.get_model('core', 'Categorie')
    Plat = apps.get_model('core', 'Plat')
    for nom, type_plat in TYPES_REPAS.items():
        for cat in Categorie.objects.filter(nom__iexact=nom):
            # Un type déjà choisi n'est jamais écrasé
            Plat.objects.filter(categorie=cat, type_plat='').update(type_plat=type_plat)
            Plat.objects.filter(categorie=cat).update(categorie=None)
            cat.delete()
    for nom in NOUVELLES_CATEGORIES:
        if not Categorie.objects.filter(nom__iexact=nom).exists():
            Categorie.objects.create(nom=nom)


def regrouper_types(apps, schema_editor):
    """Retour arrière : recrée les catégories « type de repas » pour les plats
    sans catégorie. Les nouvelles catégories sont conservées."""
    Categorie = apps.get_model('core', 'Categorie')
    Plat = apps.get_model('core', 'Plat')
    anciennes = {
        'entree': 'Entrées', 'resistance': 'Plats de résistance',
        'dessert': 'Desserts', 'boisson': 'Boissons',
    }
    for type_plat, nom in anciennes.items():
        cat, _ = Categorie.objects.get_or_create(nom=nom)
        Plat.objects.filter(type_plat=type_plat, categorie__isnull=True).update(categorie=cat)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_plat_type_plat'),
    ]

    operations = [
        migrations.RunPython(separer_types, regrouper_types),
    ]
