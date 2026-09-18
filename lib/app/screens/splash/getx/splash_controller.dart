import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/storage/app_preferences.dart';
import 'package:onesoff_customer/app/global_controllers.dart/app_session_controllers.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';

class SplashController extends GetxController {
  static const Duration _delay = Duration(seconds: 3);
  final AppSessionController _sessionController =
      Get.find<AppSessionController>();
  final AppPreferences _preferences = Get.find<AppPreferences>();

  @override
  void onReady() {
    super.onReady();
    moveToOnboarding();
  }

  Future<void> moveToOnboarding() async {
    await Future<void>.delayed(_delay);
    if (isClosed) return;

    final bool restored = await _sessionController.restoreSession();
    if (isClosed) return;
    if (restored) {
      Get.offAllNamed(AppRoutes.customerBottomNavBar);
      return;
    }

    final bool onboardingSeen = await _preferences.isOnboardingSeen();
    if (isClosed) return;
    Get.offNamed(onboardingSeen ? AppRoutes.login : AppRoutes.onboarding);
  }
}
