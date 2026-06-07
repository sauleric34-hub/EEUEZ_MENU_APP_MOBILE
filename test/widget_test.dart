import 'package:flutter_test/flutter_test.dart';
import 'package:eeuez_menu/main.dart';

void main() {
  testWidgets('Role Selection Screen smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const EeuezApp(mode: 'client'));

    // Verify that we are on the selection screen.
    expect(find.text('EEUEZ MENU'), findsOneWidget);
    expect(find.text('Commandez vos repas'), findsOneWidget);
    expect(find.text('Géner mon restaurant'), findsOneWidget);
    expect(find.text('Livrer des commandes'), findsOneWidget);
  });
}
