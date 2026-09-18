import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/auth/otp_verification/getx/otp_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_strings.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class OtpVerificationScreen extends GetView<OtpController> {
  const OtpVerificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final Size size = ResponsiveUtility.screenSize();
    final double headerHeight = size.height * 0.33;

    /// --  Dark mod instance.
    bool isDarkMode = HelperFunctions.isDarkMode(context);

    return Scaffold(
      backgroundColor: isDarkMode
          ? AppColors.scaffoldBackgroundColorDark
          : AppColors.scaffoldBackgroundColor,
      body: SafeArea(
        bottom: false,
        top: false,
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            return SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Stack(
                  children: <Widget>[
                    Column(
                      children: <Widget>[
                        Container(
                          height: headerHeight,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.vertical(
                              bottom: Radius.circular(
                                ResponsiveUtility.radius(34),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        ResponsiveUtility.width(20),
                        ResponsiveUtility.height(70),
                        ResponsiveUtility.width(20),
                        ResponsiveUtility.height(20),
                      ),
                      child: Column(
                        children: <Widget>[
                          Image.asset(
                            AppImages.appLogo,
                            width: ResponsiveUtility.radius(62),
                            height: ResponsiveUtility.radius(62),
                            color: Colors.white.withValues(alpha: 1.0),
                          ),
                          SizedBox(height: ResponsiveUtility.height(14)),
                          Text(
                            AppStrings.loginWelcomeTitle,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 1.0),
                              fontSize: ResponsiveUtility.fontSize(20),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          SizedBox(height: ResponsiveUtility.height(6)),
                          Text(
                            AppStrings.loginWelcomeSubtitle,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 1.0),
                              fontSize: ResponsiveUtility.fontSize(14),
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          SizedBox(height: ResponsiveUtility.height(20)),
                          _OtpCard(controller: controller),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _OtpCard extends StatelessWidget {
  const _OtpCard({required this.controller});

  final OtpController controller;

  @override
  Widget build(BuildContext context) {
    /// --  Dark mod instance.
    bool isDarkMode = HelperFunctions.isDarkMode(context);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        ResponsiveUtility.width(14),
        ResponsiveUtility.height(18),
        ResponsiveUtility.width(14),
        ResponsiveUtility.height(18),
      ),
      decoration: BoxDecoration(
        color: isDarkMode ? Color(0xff19050A) : const Color(0xFFFBFBFC),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(18)),
        boxShadow: [
          BoxShadow(
            color: isDarkMode
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            spreadRadius: 4,
          ),
        ],
        border: Border.all(
          color: isDarkMode
              ? Color(0xff242424)
              : AppColors.black.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            AppStrings.verifyOtpTitle,
            style: TextStyle(
              color: isDarkMode ? Color(0xffD1CFCF) : AppColors.titleTextColor,
              fontSize: ResponsiveUtility.fontSize(16),
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(6)),
          Text(
            '${AppStrings.otpDescription} +91 ${controller.mobileNumber}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: isDarkMode
                  ? Color(0xffD1CFCF).withValues(alpha: 0.8)
                  : AppColors.descriptionTextColor,
              fontSize: ResponsiveUtility.fontSize(14),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(18)),
          Text(
            AppStrings.enterOtpCode,
            style: TextStyle(
              color: isDarkMode ? Color(0xffD1CFCF) : AppColors.titleTextColor,
              fontSize: ResponsiveUtility.fontSize(14),
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: List<Widget>.generate(
              controller.otpControllers.length,
              (int index) => Expanded(
                flex: 1,
                child: Padding(
                  padding: EdgeInsets.only(
                    right: index == controller.otpControllers.length - 1
                        ? 0
                        : ResponsiveUtility.width(1.0),
                  ),
                  child: AspectRatio(
                    aspectRatio: 0.9,
                    child: Padding(
                      padding: const EdgeInsets.all(4.0),
                      child: TextField(
                        controller: controller.otpControllers[index],
                        focusNode: controller.otpFocusNodes[index],
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        inputFormatters: <TextInputFormatter>[
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(1),
                        ],
                        style: TextStyle(
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w600,
                        ),
                        decoration: InputDecoration(
                          contentPadding: EdgeInsets.zero,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(
                              ResponsiveUtility.radius(12),
                            ),
                            borderSide: BorderSide(
                              color: isDarkMode
                                  ? Color(0xff242424)
                                  : Color(0xFF6E7785),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(
                              ResponsiveUtility.radius(12),
                            ),
                            borderSide: BorderSide(
                              color: isDarkMode
                                  ? Color(0xff242424)
                                  : Color(0xFF6E7785),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(
                              ResponsiveUtility.radius(12),
                            ),
                            borderSide: BorderSide(color: AppColors.primary),
                          ),
                        ),
                        onChanged: (String value) =>
                            controller.onOtpChanged(index, value),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(14)),
          SizedBox(
            width: double.infinity,
            height: ResponsiveUtility.height(54),
            child: Obx(
              () => ElevatedButton(
                onPressed: controller.isLoading.value
                    ? null
                    : controller.onVerifyOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  disabledBackgroundColor: AppColors.primary.withValues(
                    alpha: 0.55,
                  ),
                  foregroundColor: AppColors.textOnDark,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(
                      ResponsiveUtility.radius(12),
                    ),
                  ),
                ),
                child: controller.isLoading.value
                    ? SizedBox(
                        width: ResponsiveUtility.radius(22),
                        height: ResponsiveUtility.radius(22),
                        child: const CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.white,
                        ),
                      )
                    : Text(
                        AppStrings.verifyOtpButton,
                        style: TextStyle(
                          fontSize: ResponsiveUtility.fontSize(16),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
              ),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          Center(
            child: Obx(
              () => TextButton(
                onPressed: controller.isResending.value
                    ? null
                    : controller.onResendOtp,
                child: Text(
                  controller.isResending.value
                      ? 'Sending OTP...'
                      : 'Resend OTP',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: ResponsiveUtility.fontSize(14),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          SizedBox(
            width: double.infinity,
            height: ResponsiveUtility.height(54),
            child: OutlinedButton.icon(
              onPressed: controller.onChangeMobileNumber,
              style: OutlinedButton.styleFrom(
                foregroundColor: isDarkMode ? Colors.white : AppColors.primary,
                backgroundColor: isDarkMode
                    ? const Color(0xFFF5EFF1).withValues(alpha: 0.4)
                    : const Color(0xFFF5EFF1),
                side: BorderSide.none,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    ResponsiveUtility.radius(12),
                  ),
                ),
              ),
              icon: const Icon(Icons.arrow_circle_left_outlined),
              label: Text(
                AppStrings.changeMobileNumber,
                style: TextStyle(
                  fontSize: ResponsiveUtility.fontSize(16),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(16)),
          Center(
            child: Text.rich(
              TextSpan(
                text: AppStrings.termsPrefix,
                style: TextStyle(
                  color: isDarkMode
                      ? Color(0xffD1CFCF).withValues(alpha: 0.8)
                      : AppColors.descriptionTextColor,
                  fontSize: ResponsiveUtility.fontSize(12),
                ),
                children: <InlineSpan>[
                  TextSpan(
                    text: AppStrings.termsLinkText,
                    style: TextStyle(
                      color: isDarkMode
                          ? Color(0xffA6A6D0).withValues(alpha: 0.8)
                          : const Color(0xFF404E83),
                      decoration: TextDecoration.underline,
                      decorationColor: Color(0xffA6A6D0),
                      fontSize: ResponsiveUtility.fontSize(12),
                    ),
                  ),
                ],
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}
