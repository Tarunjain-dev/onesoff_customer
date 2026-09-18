import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/repositories/auth_repository.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';

class AppSessionController extends GetxController {
  final RxnString role = RxnString();
  final RxString mobileNumber = ''.obs;
  final RxBool isAuthenticated = false.obs;
  final AuthRepository _authRepository = Get.find<AuthRepository>();

  void setRole(String userRole) {
    role.value = userRole;
  }

  void setMobileNumber(String phone) {
    mobileNumber.value = phone;
  }

  Future<bool> restoreSession() async {
    final bool restored = await _authRepository.restoreSession();
    isAuthenticated.value = restored;
    if (restored) {
      role.value = 'CUSTOMER';
    }
    return restored;
  }

  void markAuthenticated({String? userRole}) {
    isAuthenticated.value = true;
    role.value = userRole ?? 'CUSTOMER';
  }

  Future<void> logout() async {
    await _authRepository.logout();
    clearSession();
    Get.offAllNamed(AppRoutes.login);
  }

  void clearSession() {
    role.value = null;
    mobileNumber.value = '';
    isAuthenticated.value = false;
  }
}
