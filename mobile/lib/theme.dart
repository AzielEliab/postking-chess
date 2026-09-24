import 'package:flutter/material.dart';

/// Matte black + gold Material 3 dark theme. No analytics.
const Color kMatteBlack = Color(0xFF0B0B0B);
const Color kSurface = Color(0xFF141414);
const Color kGold = Color(0xFFC9A227);
const Color kGoldDim = Color(0xFF8A7219);
const Color kIvory = Color(0xFFE8E0D0);

ThemeData buildAppTheme({Brightness brightness = Brightness.dark}) {
  final dark = brightness == Brightness.dark;
  final scheme = dark
      ? const ColorScheme.dark(
          brightness: Brightness.dark,
          primary: kGold,
          onPrimary: kMatteBlack,
          secondary: kGoldDim,
          onSecondary: kIvory,
          surface: kSurface,
          onSurface: kIvory,
          error: Color(0xFFB54A4A),
          onError: kIvory,
        )
      : const ColorScheme.light(
          brightness: Brightness.light,
          primary: kGold,
          onPrimary: Color(0xFF1A1408),
          secondary: kGoldDim,
          onSecondary: Color(0xFF1C1914),
          surface: Color(0xFFFFFDF8),
          onSurface: Color(0xFF1C1914),
          error: Color(0xFF8E2E2E),
          onError: Color(0xFFFFFDF8),
        );
  final page = dark ? kMatteBlack : const Color(0xFFF7F4EC);
  final barInk = dark ? kGold : const Color(0xFF6B5214);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: page,
    focusColor: const Color(0x66C9A227),
    appBarTheme: AppBarTheme(
      backgroundColor: page,
      foregroundColor: barInk,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: scheme.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0x33C9A227)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: kGold, width: 2),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith((s) {
          return s.contains(WidgetState.selected) ? scheme.onPrimary : scheme.onSurface;
        }),
        backgroundColor: WidgetStateProperty.resolveWith((s) {
          return s.contains(WidgetState.selected) ? scheme.primary : scheme.surface;
        }),
      ),
    ),
  );
}
