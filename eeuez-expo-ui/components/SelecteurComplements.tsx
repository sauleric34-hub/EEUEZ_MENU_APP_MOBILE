// ═══════════════════════════════════════════════════════════
//  Choix des compléments d'un plat
//  Un seul choix par groupe ; les éléments inclus sont
//  présentés à part, en information.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, Gift } from 'lucide-react-native';

import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { formatPrice, type GroupeComplementDTO } from '../data/menuData';
import { PressableScale, displayFont, bodyFont } from './ui';

interface Props {
  groupes: GroupeComplementDTO[];
  inclus: string[];
  /** Option retenue par groupe : { [groupeId]: optionId }. */
  choix: Record<number, number>;
  onChange: (choix: Record<number, number>) => void;
}

export function SelecteurComplements({ groupes, inclus, choix, onChange }: Props) {
  const { colors } = useApp();

  const selectionner = (groupeId: number, optionId: number, obligatoire: boolean) => {
    const suivant = { ...choix };
    // Retoucher un groupe facultatif déjà choisi le désélectionne : sans cela,
    // le client ne pourrait plus revenir en arrière après avoir cliqué.
    if (suivant[groupeId] === optionId && !obligatoire) delete suivant[groupeId];
    else suivant[groupeId] = optionId;
    onChange(suivant);
  };

  return (
    <View>
      {groupes.map(groupe => (
        <View key={groupe.id} style={{ marginTop: 22 }}>
          <View style={styles.enTete}>
            <Text style={[displayFont(15.5, '700'), { color: colors.text }]}>{groupe.nom}</Text>
            <Text
              style={[
                bodyFont(11, '700'),
                styles.etiquette,
                groupe.obligatoire
                  ? { color: Brand.accentLight, backgroundColor: Brand.accent + '1c' }
                  : { color: colors.muted, backgroundColor: colors.surface2 },
              ]}
            >
              {groupe.obligatoire ? 'Obligatoire' : 'Facultatif'}
            </Text>
          </View>

          <View style={{ gap: 8, marginTop: 10 }}>
            {groupe.options.map(option => {
              const actif = choix[groupe.id] === option.id;
              return (
                <PressableScale
                  key={option.id}
                  onPress={() => selectionner(groupe.id, option.id, groupe.obligatoire)}
                >
                  <View
                    style={[
                      styles.option,
                      {
                        backgroundColor: actif ? Brand.accent + '14' : colors.surface,
                        borderColor: actif ? Brand.accent + '77' : colors.border,
                      },
                    ]}
                  >
                    {/* Pastille ronde : le rond signale un choix unique,
                        là où un carré suggérerait plusieurs sélections. */}
                    <View
                      style={[
                        styles.pastille,
                        { borderColor: actif ? Brand.accent : colors.border },
                        actif && { backgroundColor: Brand.accent },
                      ]}
                    >
                      {actif && <Check size={12} color="#fff" strokeWidth={3.4} />}
                    </View>

                    <Text style={[bodyFont(13.5, '600'), { color: colors.text, flex: 1 }]}>
                      {option.nom}
                    </Text>

                    <Text
                      style={[
                        bodyFont(12.5, '800'),
                        { color: option.supplement ? Brand.accentLight : colors.faint },
                      ]}
                    >
                      {option.supplement ? `+${formatPrice(option.supplement)}` : 'Offert'}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ))}

      {inclus.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={[displayFont(15.5, '700'), { color: colors.text }]}>
            Compris avec le plat
          </Text>
          <View style={[styles.inclusBloc, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {inclus.map((element, i) => (
              <View key={i} style={styles.inclusLigne}>
                <Gift size={15} color={Brand.green} strokeWidth={2.3} />
                <Text style={[bodyFont(13, '600'), { color: colors.muted, flex: 1 }]}>
                  {element}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  enTete: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  etiquette: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill, overflow: 'hidden',
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: Radius.lg, borderWidth: 1,
  },
  pastille: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  inclusBloc: {
    marginTop: 10, padding: 13, borderRadius: Radius.lg,
    borderWidth: 1, gap: 9,
  },
  inclusLigne: { flexDirection: 'row', alignItems: 'center', gap: 9 },
});
