import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/repositories/auth_repository.dart';
import 'package:onesoff_customer/app/global_controllers.dart/app_session_controllers.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';

class LoginController extends GetxController {
  final RxInt selectedTabIndex = 0.obs;
  final RxBool isLoading = false.obs;
  final TextEditingController mobileController = TextEditingController();
  final TextEditingController signupNameController = TextEditingController();
  final TextEditingController signupMobileController = TextEditingController();
  final TextEditingController signupEmailController = TextEditingController();
  final TextEditingController signupAadhaarController = TextEditingController();
  final AppSessionController session = Get.find<AppSessionController>();
  final AuthRepository _authRepository = Get.find<AuthRepository>();

  bool get isSignup => selectedTabIndex.value == 1;

  void changeTab(int index) {
    selectedTabIndex.value = index;
  }

  String _normalizedPhone(String raw) {
    return raw.replaceAll(RegExp(r'[^0-9]'), '');
  }

  Future<void> onRequestOtp() async {
    final String phone = _normalizedPhone(
      isSignup
          ? signupMobileController.text.trim()
          : mobileController.text.trim(),
    );
    if (phone.length != 10) {
      Get.snackbar(
        'Invalid Number',
        'Please enter a valid 10 digit mobile number.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    final String name = signupNameController.text.trim();
    final String aadhaar = _normalizedPhone(
      signupAadhaarController.text.trim(),
    );
    final String email = signupEmailController.text.trim();

    if (isSignup && name.isEmpty) {
      Get.snackbar(
        'Name Required',
        'Please enter customer name.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    if (isSignup && aadhaar.length != 12) {
      Get.snackbar(
        'Invalid Aadhaar',
        'Please enter a valid 12 digit Aadhaar number.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    isLoading.value = true;
    try {
      await _authRepository.sendOtp(phone: phone);
      session.setMobileNumber(phone);
      Get.toNamed(
        AppRoutes.otpVerification,
        arguments: <String, dynamic>{
          'phone': phone,
          'isSignup': isSignup,
          if (isSignup) 'name': name,
          if (isSignup && email.isNotEmpty) 'email': email,
          if (isSignup) 'aadhar': aadhaar,
        },
      );
    } catch (error) {
      Get.snackbar(
        'OTP Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isLoading.value = false;
    }
  }

  void onGuestLoginAsCustomer() {
    session.setRole('customer');
    // Get.offAllNamed(AppRoutes.customerDashboard);
  }

  @override
  void onClose() {
    mobileController.dispose();
    signupNameController.dispose();
    signupMobileController.dispose();
    signupEmailController.dispose();
    signupAadhaarController.dispose();
    super.onClose();
  }

  String _readableError(Object error) {
    if (error is DioException) {
      debugPrint(
        'Send OTP failed: type=${error.type}, status=${error.response?.statusCode}, message=${error.message}, data=${error.response?.data}',
      );
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout ||
          error.type == DioExceptionType.connectionError) {
        return 'Unable to connect to server. Please check the API URL or network.';
      }
      final dynamic responseData = error.response?.data;
      if (responseData is Map && responseData['message'] != null) {
        return responseData['message'].toString();
      }
      if (responseData is Map && responseData['error'] != null) {
        return responseData['error'].toString();
      }
      if (error.response?.statusCode != null) {
        return 'Server error ${error.response?.statusCode}. Please try again.';
      }
    }
    final String message = error.toString();
    if (message.contains('SocketException') || message.contains('timeout')) {
      return 'Unable to connect to server. Please try again.';
    }
    return 'Please try again in a moment.';
  }
}
