import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/getx/customer_profile_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class PersonalDeliveryInformationScreen extends StatelessWidget {
  const PersonalDeliveryInformationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    
    final CustomerProfileController controller = Get.isRegistered<CustomerProfileController>() ? Get.find<CustomerProfileController>() : Get.put(CustomerProfileController());

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            const _ProfileSubHeader(
              title: 'Personal & Delivery information',
              subtitle: 'Update name, email & other information.',
            ),
            Expanded(
              child: Obx(
                () => ListView(
                  physics: const BouncingScrollPhysics(),
                  padding: ResponsiveUtility.only(
                    left: 20,
                    right: 20,
                    top: 20,
                    bottom: 20,
                  ),
                  children: <Widget>[
                    if (controller.isLoading.value &&
                        controller.profile.value == null)
                      const LinearProgressIndicator(
                        color: AppColors.primary,
                        minHeight: 2,
                      ),
                    _FormFieldBlock(
                      label: 'Customer Name',
                      hint: 'Enter your name',
                      controller: controller.nameController,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'Contact Number',
                      hint: '+91 8305776537',
                      controller: controller.phoneController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'Email Address  (optional)',
                      hint: 'Enter your email id',
                      controller: controller.emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'Aadhar Number',
                      hint: '0000 0000 0000',
                      controller: controller.aadharController,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.next,
                    ),
                    Text('Upload Aadhar Card', style: _labelStyle()),
                    SizedBox(height: ResponsiveUtility.height(10)),
                    const _UploadCard(),
                    SizedBox(height: ResponsiveUtility.height(22)),
                    _FormFieldBlock(
                      label: 'House address / Building name',
                      hint: 'Flat no, building name, street or locality',
                      controller: controller.addressLine1Controller,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'Landmark',
                      hint: 'Near hospital, main road or metro station',
                      controller: controller.landmarkController,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'Pincode',
                      hint: '000000',
                      controller: controller.pincodeController,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'City',
                      hint: 'Enter city',
                      controller: controller.cityController,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'State',
                      hint: 'Enter state',
                      controller: controller.stateController,
                      textInputAction: TextInputAction.next,
                    ),
                    _FormFieldBlock(
                      label: 'Additional information',
                      hint: 'Any floor, gate or delivery instruction',
                      controller: controller.additionalInfoController,
                      textInputAction: TextInputAction.done,
                      bottomSpacing: 20,
                    ),
                    Padding(
                      padding: ResponsiveUtility.symmetric(horizontal: 10),
                      child: SizedBox(
                        height: ResponsiveUtility.height(44),
                        child: ElevatedButton(
                          onPressed: controller.isSaving.value
                              ? null
                              : controller.saveProfile,
                          style: ElevatedButton.styleFrom(
                            elevation: 0,
                            backgroundColor: AppColors.primary,
                            disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.45),
                            foregroundColor: AppColors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                ResponsiveUtility.radius(10),
                              ),
                            ),
                          ),
                          child: controller.isSaving.value
                              ? SizedBox(
                                  height: ResponsiveUtility.radius(24),
                                  width: ResponsiveUtility.radius(24),
                                  child: const CircularProgressIndicator(
                                    color: AppColors.white,
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : Text(
                                  'Save Changes',
                                  style: TextStyle(
                                    fontSize: ResponsiveUtility.fontSize(16),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static TextStyle _labelStyle() {
    return TextStyle(
      color: const Color(0xFF252525),
      fontSize: ResponsiveUtility.fontSize(14),
      fontWeight: FontWeight.w500,
    );
  }
}

class _ProfileSubHeader extends StatelessWidget {
  const _ProfileSubHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary,
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 70, bottom: 20),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              GestureDetector(
                onTap: Get.back,
                child: Icon(
                  Icons.arrow_back,
                  color: AppColors.white,
                  size: ResponsiveUtility.radius(18),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.62),
                        fontSize: ResponsiveUtility.fontSize(12),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FormFieldBlock extends StatelessWidget {
  const _FormFieldBlock({
    required this.label,
    required this.hint,
    required this.controller,
    this.keyboardType,
    this.textInputAction,
    this.bottomSpacing = 10,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final double bottomSpacing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(bottom: bottomSpacing),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: PersonalDeliveryInformationScreen._labelStyle()),
          SizedBox(height: ResponsiveUtility.height(8)),
          TextField(
            controller: controller,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(
                color: const Color(0xFF6A7282),
                fontSize: ResponsiveUtility.fontSize(14),
              ),
              contentPadding: ResponsiveUtility.symmetric(
                horizontal: 10,
                vertical: 10,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ResponsiveUtility.radius(8),
                ),
                borderSide: const BorderSide(color: Color(0xFFD8D8D8)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ResponsiveUtility.radius(8),
                ),
                borderSide: const BorderSide(color: AppColors.primary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: ResponsiveUtility.height(120),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(8)),
        border: Border.all(
          color: const Color(0xFFD8D8D8),
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            Icons.upload,
            color: const Color(0xFF777777),
            size: ResponsiveUtility.radius(24),
          ),
          SizedBox(height: ResponsiveUtility.height(6)),
          Text(
            'Tap to upload',
            style: TextStyle(
              color: const Color(0xFF333333),
              fontSize: ResponsiveUtility.fontSize(16),
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(4)),
          Text(
            'Front & back in single PDF or separate images',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: const Color(0xFF777777),
              fontSize: ResponsiveUtility.fontSize(12),
            ),
          ),
        ],
      ),
    );
  }
}
