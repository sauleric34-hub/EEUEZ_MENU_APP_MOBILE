import 'package:flutter/material.dart';

class AppTheme {
  // Brand Colors (EEUEZ Logo Palette)
  static const Color primary = Color(0xFF004D40); // Deep Green
  static const Color secondary = Color(0xFFFFC107); // Gold
  static const Color accent = Color(0xFF2ECC71); // Safe Green
  static const Color danger = Color(0xFFE74C3C); // Warning Red
  static const Color background = Color(0xFFFAFAFA); // Ultra White
  static const Color textMain = Color(0xFF2D3436);
  static const Color textMuted = Color(0xFF9E9E9E);
  
  // Spacing Strategy (Airy)
  static const double paddingHuge = 32.0;
  static const double paddingLarge = 24.0;
  static const double paddingMedium = 16.0;

  static ThemeData premiumTheme = ThemeData(
    useMaterial3: true,
    fontFamily: 'Plus Jakarta Sans',
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: secondary,
      error: danger,
      surface: background,
    ),
    scaffoldBackgroundColor: background,
    
    // Call To Action (CTA) Button Styles
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: secondary,
        foregroundColor: primary,
        elevation: 8,
        shadowColor: secondary.withOpacity(0.4),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
      ),
    ),

    // Irreversible Action Button
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: danger,
        side: const BorderSide(color: danger, width: 2),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      ),
    ),

    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: textMain,
        fontWeight: FontWeight.w800,
        fontSize: 22,
      ),
    ),

    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: Colors.grey.withOpacity(0.1), width: 1),
      ),
    ),
  );
}
