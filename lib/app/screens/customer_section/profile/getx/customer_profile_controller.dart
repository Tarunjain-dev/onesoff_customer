import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_profile.dart';
import 'package:onesoff_customer/app/data/repositories/customer_profile_repository.dart';

class CustomerProfileController extends GetxController {
  final CustomerProfileRepository _repository =
      Get.find<CustomerProfileRepository>();

  final Rxn<CustomerProfile> profile = Rxn<CustomerProfile>();
  final RxBool isLoading = false.obs;
  final RxBool isSaving = false.obs;
  final RxnString errorMessage = RxnString();

  final TextEditingController nameController = TextEditingController();
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController aadharController = TextEditingController();
  final TextEditingController addressLine1Controller = TextEditingController();
  final TextEditingController landmarkController = TextEditingController();
  final TextEditingController pincodeController = TextEditingController();
  final TextEditingController cityController = TextEditingController();
  final TextEditingController stateController = TextEditingController();
  final TextEditingController additionalInfoController =
      TextEditingController();

  @override
  void onInit() {
    super.onInit();
    fetchProfile();
  }

  Future<void> fetchProfile() async {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      final CustomerProfile nextProfile = await _repository.getProfile();
      profile.value = nextProfile;
      _fillForm(nextProfile);
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> saveProfile() async {
    final String name = nameController.text.trim();
    final String phone = _phoneDigits(phoneController.text);
    final String email = emailController.text.trim();
    final String aadhar = _digits(aadharController.text);
    final String pincode = _digits(pincodeController.text);
    final String city = cityController.text.trim();
    final String state = stateController.text.trim();

    if (name.isEmpty) {
      _showError('Name Required', 'Please enter customer name.');
      return;
    }
    if (phone.length != 10) {
      _showError('Invalid Number', 'Please enter a valid 10 digit number.');
      return;
    }
    if (email.isNotEmpty && !GetUtils.isEmail(email)) {
      _showError('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (aadhar.isNotEmpty && aadhar.length != 12) {
      _showError('Invalid Aadhaar', 'Aadhaar number must be 12 digits.');
      return;
    }
    if (pincode.isNotEmpty && pincode.length > 6) {
      _showError('Invalid Pincode', 'Pincode can contain up to 6 digits.');
      return;
    }
    if (city.isNotEmpty && !RegExp(r'^[A-Za-z\s]+$').hasMatch(city)) {
      _showError('Invalid City', 'City should contain alphabetic text only.');
      return;
    }
    if (state.isNotEmpty && !RegExp(r'^[A-Za-z\s]+$').hasMatch(state)) {
      _showError('Invalid State', 'State should contain alphabetic text only.');
      return;
    }

    final Map<String, dynamic> payload = <String, dynamic>{
      'name': name,
      'phone': phone,
      if (email.isNotEmpty) 'email': email,
      if (aadhar.isNotEmpty) 'aadharNumber': aadhar,
      if (addressLine1Controller.text.trim().isNotEmpty)
        'addressLine1': addressLine1Controller.text.trim(),
      if (landmarkController.text.trim().isNotEmpty)
        'landmark': landmarkController.text.trim(),
      if (pincode.isNotEmpty) 'pincode': pincode,
      if (city.isNotEmpty) 'city': city,
      if (state.isNotEmpty) 'state': state,
      if (additionalInfoController.text.trim().isNotEmpty)
        'additionalInfo': additionalInfoController.text.trim(),
    };

    isSaving.value = true;
    try {
      final CustomerProfile nextProfile = await _repository.updateProfile(
        payload,
      );
      profile.value = nextProfile;
      _fillForm(nextProfile);
      Get.snackbar(
        'Profile Updated',
        'Your personal and delivery information has been saved.',
        snackPosition: SnackPosition.BOTTOM,
      );
      Get.back<void>();
    } catch (error) {
      _showError('Save Failed', _readableError(error));
    } finally {
      isSaving.value = false;
    }
  }

  void _fillForm(CustomerProfile value) {
    nameController.text = value.name ?? '';
    phoneController.text = value.phone ?? '';
    emailController.text = value.email ?? '';
    aadharController.text = value.aadharNumber ?? '';
    addressLine1Controller.text = value.addressLine1 ?? '';
    landmarkController.text = value.landmark ?? '';
    pincodeController.text = value.pincode ?? '';
    cityController.text = value.city ?? '';
    stateController.text = value.state ?? '';
    additionalInfoController.text = value.additionalInfo ?? '';
  }

  void _showError(String title, String message) {
    Get.snackbar(title, message, snackPosition: SnackPosition.BOTTOM);
  }

  String _readableError(Object error) {
    if (error is DioException) {
      final dynamic responseData = error.response?.data;
      if (responseData is Map && responseData['message'] != null) {
        return responseData['message'].toString();
      }
      if (responseData is Map && responseData['error'] != null) {
        return responseData['error'].toString();
      }
      if (error.response?.statusCode == 401) {
        return 'Your session has expired. Please login again.';
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

  String _digits(String value) => value.replaceAll(RegExp(r'[^0-9]'), '');

  String _phoneDigits(String value) {
    final String digits = _digits(value);
    return digits.length >= 10 ? digits.substring(digits.length - 10) : digits;
  }

  @override
  void onClose() {
    nameController.dispose();
    phoneController.dispose();
    emailController.dispose();
    aadharController.dispose();
    addressLine1Controller.dispose();
    landmarkController.dispose();
    pincodeController.dispose();
    cityController.dispose();
    stateController.dispose();
    additionalInfoController.dispose();
    super.onClose();
  }
}
