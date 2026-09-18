import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class HelperFunctions {
  HelperFunctions._();

  // -- Check Dark Mode
  static bool isDarkMode(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark;
  }

  // -- Set status bar color
  static Future<void> setStatusBarColor({required Color color}) async {
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(statusBarColor: color),
    );
  }
}
