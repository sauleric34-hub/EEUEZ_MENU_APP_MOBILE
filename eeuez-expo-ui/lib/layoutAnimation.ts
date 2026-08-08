// ═══════════════════════════════════════════════════════════
//  Anime automatiquement le prochain changement de layout —
//  ajout/suppression d'une ligne de liste (panier, favoris, commentaires),
//  sans devoir gérer un Animated.Value dédié pour chaque écran.
// ═══════════════════════════════════════════════════════════

import { LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** À appeler juste avant une mutation d'état qui ajoute/retire un élément de liste. */
export function animateListChange() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}
