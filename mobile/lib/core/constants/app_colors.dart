import 'package:flutter/material.dart';

/// Clean Scandinavian & Modern Enterprise Color Palette
/// Zero AI-slop gradients, high contrast, WCAG AAA compliant.
class AppColors {
  // Backgrounds & Surfaces
  static const Color background = Color(0xFFF8FAFC); // Clean off-white
  static const Color surface = Color(0xFFFFFFFF);
  static const Color card = Color(0xFFFFFFFF);
  static const Color subSurface = Color(0xFFF1F5F9);

  // Borders & Dividers
  static const Color border = Color(0xFFE2E8F0);
  static const Color borderSubtle = Color(0xFFEEF2F6);
  static const Color divider = Color(0xFFE2E8F0);

  // Typography
  static const Color textPrimary = Color(0xFF0F172A); // Slate 900
  static const Color textSecondary = Color(0xFF475569); // Slate 600
  static const Color textMuted = Color(0xFF64748B); // Slate 500
  static const Color textDisabled = Color(0xFF94A3B8); // Slate 400

  // Brand & Functional Themes
  static const Color primary = Color(0xFF059669); // Deep Emerald Green
  static const Color primaryHover = Color(0xFF047857);
  static const Color primaryLight = Color(0xFFECFDF5);
  static const Color primaryDark = Color(0xFF064E3B);

  static const Color navy = Color(0xFF1E3A8A); // Deep Navy Base
  static const Color navyLight = Color(0xFFEFF6FF);

  // Status Colors (Functional)
  static const Color success = Color(0xFF059669); // Emerald
  static const Color successBg = Color(0xFFECFDF5);
  static const Color successBorder = Color(0xFFA7F3D0);

  static const Color warning = Color(0xFFD97706); // Amber
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color warningBorder = Color(0xFFFDE68A);

  static const Color danger = Color(0xFFDC2626); // Red
  static const Color error = Color(0xFFDC2626); // Alias for danger
  static const Color dangerBg = Color(0xFFFEF2F2);
  static const Color dangerBorder = Color(0xFFFECACA);

  static const Color info = Color(0xFF2563EB); // Royal Blue
  static const Color infoBg = Color(0xFFEFF6FF);
  static const Color infoBorder = Color(0xFFBFDBFE);
}
