"""Icônes proposées pour les catégories de plats.

Les clés sont les noms « kebab-case » de la bibliothèque Lucide : l'admin web
les affiche via lucide (CDN) et l'app mobile les convertit en composants
lucide-react-native (cf. eeuez-expo-ui/lib/categoryIcons.ts — garder les deux
listes synchronisées).
"""
import re

ICONES = [
    ('utensils', 'Couverts'),
    ('utensils-crossed', 'Couverts croisés'),
    ('chef-hat', 'Toque'),
    ('cooking-pot', 'Marmite'),
    ('soup', 'Soupe'),
    ('salad', 'Salade'),
    ('pizza', 'Pizza'),
    ('sandwich', 'Sandwich'),
    ('hamburger', 'Burger'),
    ('beef', 'Viande'),
    ('drumstick', 'Poulet'),
    ('ham', 'Jambon'),
    ('fish', 'Poisson'),
    ('shrimp', 'Crevette'),
    ('egg', 'Œuf'),
    ('egg-fried', 'Œuf au plat'),
    ('wheat', 'Céréales'),
    ('bean', 'Haricot'),
    ('carrot', 'Carotte'),
    ('leafy-green', 'Légumes verts'),
    ('vegan', 'Végan'),
    ('sprout', 'Pousse'),
    ('apple', 'Pomme'),
    ('banana', 'Banane'),
    ('cherry', 'Cerise'),
    ('grape', 'Raisin'),
    ('citrus', 'Agrumes'),
    ('croissant', 'Viennoiserie'),
    ('cake', 'Gâteau'),
    ('cake-slice', 'Part de gâteau'),
    ('cookie', 'Biscuit'),
    ('donut', 'Beignet'),
    ('ice-cream-cone', 'Glace'),
    ('ice-cream-bowl', 'Coupe glacée'),
    ('popsicle', 'Esquimau'),
    ('candy', 'Bonbon'),
    ('popcorn', 'Pop-corn'),
    ('coffee', 'Café'),
    ('cup-soda', 'Soda'),
    ('glass-water', 'Eau'),
    ('milk', 'Lait'),
    ('wine', 'Vin'),
    ('beer', 'Bière'),
    ('martini', 'Cocktail'),
    ('flame', 'Grillé / épicé'),
    ('leaf', 'Feuille'),
]
CLES_ICONES = {cle for cle, _ in ICONES}
ICONE_PAR_DEFAUT = 'utensils'

# Icône suggérée d'après le nom (pré-remplissage des catégories existantes)
_SUGGESTIONS = [
    (r'poulet|volaille|ailes?', 'drumstick'),
    (r'poisson|fruits? de mer', 'fish'),
    (r'pizza', 'pizza'),
    (r'burger|fast', 'hamburger'),
    (r'sandwich|snack', 'sandwich'),
    (r'grillade|brochette', 'flame'),
    (r'viande|boeuf|bœuf', 'beef'),
    (r'jus|boisson|soda|cocktail', 'cup-soda'),
    (r'soupe|bouillon', 'soup'),
    (r'salade|entrée|entree', 'salad'),
    (r'végé|vege|vegan', 'vegan'),
    (r'riz|pâte|pate', 'wheat'),
    (r'pâtisserie|patisserie|gâteau|gateau', 'cake-slice'),
    (r'glace|dessert', 'ice-cream-cone'),
    (r'traditionnel|africain|local', 'cooking-pot'),
    (r'international|monde', 'chef-hat'),
]


def suggerer_icone(nom):
    for motif, cle in _SUGGESTIONS:
        if re.search(motif, nom or '', re.IGNORECASE):
            return cle
    return ICONE_PAR_DEFAUT
