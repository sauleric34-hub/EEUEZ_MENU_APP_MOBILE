import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'services/localization_service.dart';
import 'screens/splash_screen.dart';

void main() {
  runApp(const EeuezApp());
}

class EeuezApp extends StatelessWidget {
  const EeuezApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EEUEZ Menu',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.premiumTheme,
      home: const SplashScreen(),
    );
  }
}
