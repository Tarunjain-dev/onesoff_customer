import 'package:shared_preferences/shared_preferences.dart';

class AppPreferences {
  static const String _onboardingSeenKey = 'onboarding_seen';

  Future<bool> isOnboardingSeen() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    return preferences.getBool(_onboardingSeenKey) ?? false;
  }

  Future<void> setOnboardingSeen() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setBool(_onboardingSeenKey, true);
  }
}
