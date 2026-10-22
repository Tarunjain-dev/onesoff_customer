import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color surface = Color(0xFFFAF9F6);
  static const Color textPrimary = Color(0xFF6A2236);
  static const Color textOnDark = Color(0xFFFFFFFF);
  static const Color inactiveDot = Color(0xFFD9D9D9);
  static const Color border = Color.fromARGB(255, 103, 95, 97);
  static const Color shadow = Color(0x2B000000);
  static const Color readTermsButton = Color(0xFFEEEEEE);
  static const Color dashboardSurface = Color(0xFFF2F3F5);

  /// -- Common colors
  static const Color white = Colors.white;
  static const Color black = Colors.black;

  /// -- Light theme colors
  static const Color primary = Color(0xFF6A2236);
  static const Color secondary = Color(0xFFC58A99);
  static const Color secondarySurface = Color(0xFFF5E5E1);
  static Color scaffoldBackgroundColor = Color(
    0xffFAF9F6,
  ).withValues(alpha: 1.0);
  static const Color titleTextColor = Color(0xFF2A2A2A);
  static const Color descriptionTextColor = Color(0xFF6C6C6C);

  /// -- Dark theme colors
  static const Color primaryColorDark = Color(0xFF4F1928);
  static Color scaffoldBackgroundColorDark = Color(
    0xff0E0003,
  ).withValues(alpha: 1.0);
}
