import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:get/get.dart';

class ResponsiveUtility {
  /// -- Base design size
  static const double baseWidth = 392.0;
  static const double baseHeight = 812.0;
  static const double _minFontScale = 0.94;
  static const double _maxFontScale = 1.06;
  static const double _minLayoutScale = 0.88;
  static const double _maxLayoutScale = 1.12;

  /// -- Get device width/height dynamically.
  /// Avoid caching at class-load time because Get.width/Get.height can be 0
  /// before the first frame in release mode.
  static double get screenWidth {
    final context = Get.context;
    final mediaQuery = context != null ? MediaQuery.maybeOf(context) : null;
    if (mediaQuery != null && mediaQuery.size.width > 0) {
      return mediaQuery.size.width;
    }

    final dispatcher = WidgetsBinding.instance.platformDispatcher;
    final view = dispatcher.views.isNotEmpty ? dispatcher.views.first : null;
    if (view != null && view.devicePixelRatio > 0) {
      return view.physicalSize.width / view.devicePixelRatio;
    }

    return baseWidth;
  }

  static double get screenHeight {
    final context = Get.context;
    final mediaQuery = context != null ? MediaQuery.maybeOf(context) : null;
    if (mediaQuery != null && mediaQuery.size.height > 0) {
      return mediaQuery.size.height;
    }

    final dispatcher = WidgetsBinding.instance.platformDispatcher;
    final view = dispatcher.views.isNotEmpty ? dispatcher.views.first : null;
    if (view != null && view.devicePixelRatio > 0) {
      return view.physicalSize.height / view.devicePixelRatio;
    }

    return baseHeight;
  }

  static double get _widthScale => (screenWidth / baseWidth).clamp(_minLayoutScale, _maxLayoutScale);
  static double get _heightScale => (screenHeight / baseHeight).clamp(_minLayoutScale, _maxLayoutScale);

  /// -- Scaled width
  // example: width: ResponsiveUtility.width(200)
  static double width(double width) => width * _widthScale;

  /// -- Scaled height
  // example: height: ResponsiveUtility.height(200)
  static double height(double height) => height * _heightScale;

  /// -- Screen Size
  static Size screenSize() => MediaQuery.of(Get.context!).size;

  /// -- Scaled font size
  // example: fontSize: ResponsiveUtility.fontSize(18)
  static double fontSize(double fontSize) {
    // Balanced scale from both axes.
    // Geometric mean avoids width-only overgrowth on slightly wider phones.
    final balancedScale = math.sqrt(_widthScale * _heightScale);
    final clampedScale = balancedScale.clamp(_minFontScale, _maxFontScale);

    return fontSize * clampedScale;
  }

  /// -- Scaled radius
  // example: borderRadius: BorderRadius.circular(ResponsiveUtility.radius(10))
  static double radius(double radius) => radius * _widthScale;

  /// -- Scaled padding & margin
  // example: padding: ResponsiveUtility.all(16)
  static EdgeInsets all(double value) {
    return EdgeInsets.all(width(value));
  }

  // example: padding: ResponsiveUtility.symmetric(horizontal: 20, vertical: 10)
  static EdgeInsets symmetric({
    double horizontal = 0,
    double vertical = 0,
  }) {
    return EdgeInsets.symmetric(
      horizontal: width(horizontal),
      vertical: height(vertical),
    );
  }

  // example: padding: ResponsiveUtility.only(left:10, right:10, top: 8, bottom:8)
  static EdgeInsets only({
    double left = 0,
    double right = 0,
    double top = 0,
    double bottom = 0,
  }) {
    return EdgeInsets.only(
      left: width(left),
      right: width(right),
      top: height(top),
      bottom: height(bottom),
    );
  }

  /// -- Device Types
  static bool get isSmallPhone => screenWidth < 360;
  static bool get isMediumPhone => screenWidth >= 360 && screenWidth < 400;
  static bool get isLargePhone => screenWidth >= 400;
}
