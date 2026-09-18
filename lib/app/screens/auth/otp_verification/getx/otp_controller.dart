import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/repositories/auth_repository.dart';
import 'package:onesoff_customer/app/global_controllers.dart/app_session_controllers.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';

class OtpController extends GetxController {
  final AppSessionController session = Get.find<AppSessionController>();
  final AuthRepository _authRepository = Get.find<AuthRepository>();
  final RxBool isLoading = false.obs;
  final RxBool isResending = false.obs;
  final List<TextEditingController> otpControllers =
      List<TextEditingController>.generate(6, (_) => TextEditingController());
  final List<FocusNode> otpFocusNodes = List<FocusNode>.generate(
    6,
    (_) => FocusNode(),
  );

  late final String mobileNumber;
  late final bool isSignup;
  String? name;
  String? email;
  String? aadhar;

  @override
  void onInit() {
    super.onInit();
    final dynamic arguments = Get.arguments;
    if (arguments is Map<String, dynamic>) {
      mobileNumber =
          (arguments['phone'] as String?) ?? session.mobileNumber.value;
      isSignup = arguments['isSignup'] == true;
      name = arguments['name'] as String?;
      email = arguments['email'] as String?;
      aadhar = arguments['aadhar'] as String?;
    } else {
      mobileNumber = (arguments as String?) ?? session.mobileNumber.value;
      isSignup = false;
    }
  }

  void onOtpChanged(int index, String value) {
    if (value.isNotEmpty && index < otpFocusNodes.length - 1) {
      otpFocusNodes[index + 1].requestFocus();
      return;
    }
    if (value.isEmpty && index > 0) {
      otpFocusNodes[index - 1].requestFocus();
    }
  }

  String get otpValue => otpControllers
      .map((TextEditingController controller) => controller.text)
      .join();

  Future<void> onVerifyOtp() async {
    if (otpValue.length < 6) {
      Get.snackbar(
        'OTP Required',
        'Please enter all 6 digits of OTP.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    isLoading.value = true;
    try {
      final AuthSession authSession = await _authRepository.verifyOtp(
        phone: mobileNumber,
        otp: otpValue,
        name: name,
        email: email,
        aadhar: aadhar,
      );
      session.setMobileNumber(authSession.phone ?? mobileNumber);
      session.markAuthenticated(userRole: authSession.role);
      Get.offAllNamed(AppRoutes.customerBottomNavBar);
    } catch (error) {
      Get.snackbar(
        'Verification Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> onResendOtp() async {
    isResending.value = true;
    try {
      await _authRepository.sendOtp(phone: mobileNumber);
      Get.snackbar(
        'OTP Sent',
        'A new OTP has been sent to +91 $mobileNumber.',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (error) {
      Get.snackbar(
        'Resend Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isResending.value = false;
    }
  }

  void onChangeMobileNumber() {
    Get.back();
  }

  @override
  void onClose() {
    for (final TextEditingController controller in otpControllers) {
      controller.dispose();
    }
    for (final FocusNode node in otpFocusNodes) {
      node.dispose();
    }
    super.onClose();
  }

  String _readableError(Object error) {
    if (error is DioException) {
      debugPrint(
        'OTP API failed: type=${error.type}, status=${error.response?.statusCode}, message=${error.message}, data=${error.response?.data}',
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
    if (message.contains('FormatException')) {
      return 'Server response did not include login tokens.';
    }
    if (message.contains('SocketException') || message.contains('timeout')) {
      return 'Unable to connect to server. Please try again.';
    }
    return 'Please check the OTP and try again.';
  }
}
