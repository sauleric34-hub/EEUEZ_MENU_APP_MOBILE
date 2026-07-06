// Garde-fou global : capture les erreurs de rendu et affiche un écran de repli
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.msg}>{this.state.error.message}</Text>
          <Pressable style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnTxt}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080c09', padding: 30 },
  title: { color: '#f4f1ec', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  msg: { color: 'rgba(244,241,236,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#f26a1b', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
