import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/auth/login/getx/loigin_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_strings.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class LoginScreen extends GetView<LoginController> {
  const LoginScreen({super.key});

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
      body: LayoutBuilder(
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
                          color: isDarkMode
                              ? Color(0xff4F1026)
                              : AppColors.primary,
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
                          color: AppColors.white,
                        ),
                        SizedBox(height: ResponsiveUtility.height(14)),
                        Text(
                          AppStrings.loginWelcomeTitle,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: ResponsiveUtility.fontSize(20),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: ResponsiveUtility.height(6)),
                        Text(
                          AppStrings.loginWelcomeSubtitle,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: ResponsiveUtility.fontSize(12),
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        SizedBox(height: ResponsiveUtility.height(20)),
                        _LoginCard(controller: controller),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({required this.controller});

  final LoginController controller;

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
        color: isDarkMode ? Color(0xff19050A) : AppColors.white,
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
          Obx(
            () => _AuthTabSelector(
              selectedIndex: controller.selectedTabIndex.value,
              onTabChanged: controller.changeTab,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(18)),
          Obx(
            () => AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              child: controller.isSignup
                  ? _SignupForm(
                      key: const ValueKey<String>('signup'),
                      controller: controller,
                      isDarkMode: isDarkMode,
                    )
                  : _LoginForm(
                      key: const ValueKey<String>('login'),
                      controller: controller,
                      isDarkMode: isDarkMode,
                    ),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(14)),
          Obx(
            () => SizedBox(
              width: double.infinity,
              height: ResponsiveUtility.height(54),
              child: ElevatedButton(
                onPressed: controller.isLoading.value
                    ? null
                    : controller.onRequestOtp,
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
                        controller.isSignup ? 'Signup' : AppStrings.requestOtp,
                        style: TextStyle(
                          fontSize: ResponsiveUtility.fontSize(16),
                          fontWeight: FontWeight.w500,
                        ),
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
                  fontSize: ResponsiveUtility.fontSize(13),
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
                      fontSize: ResponsiveUtility.fontSize(13),
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

class _AuthTabSelector extends StatelessWidget {
  const _AuthTabSelector({
    required this.selectedIndex,
    required this.onTabChanged,
  });

  final int selectedIndex;
  final ValueChanged<int> onTabChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: ResponsiveUtility.height(44),
      padding: ResponsiveUtility.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF5EFF1),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
      ),
      child: Stack(
        children: <Widget>[
          AnimatedAlign(
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOutCubic,
            alignment: selectedIndex == 0
                ? Alignment.centerLeft
                : Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: 0.5,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(
                    ResponsiveUtility.radius(9),
                  ),
                ),
              ),
            ),
          ),
          Row(
            children: <Widget>[
              _TabButton(
                label: 'Login',
                isSelected: selectedIndex == 0,
                onTap: () => onTabChanged(0),
              ),
              _TabButton(
                label: 'Signup',
                isSelected: selectedIndex == 1,
                onTap: () => onTabChanged(1),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? AppColors.white : AppColors.primary,
              fontSize: ResponsiveUtility.fontSize(15),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    super.key,
    required this.controller,
    required this.isDarkMode,
  });

  final LoginController controller;
  final bool isDarkMode;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _CardTitle(
          title: AppStrings.loginTitle,
          subtitle: AppStrings.loginDescription,
          isDarkMode: isDarkMode,
        ),
        SizedBox(height: ResponsiveUtility.height(14)),
        _AuthTextField(
          label: AppStrings.mobileNumberLabel,
          hint: AppStrings.mobileNumberHint,
          controller: controller.mobileController,
          isDarkMode: isDarkMode,
          prefixText: '+91',
          maxLength: 10,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
        ),
      ],
    );
  }
}

class _SignupForm extends StatelessWidget {
  const _SignupForm({
    super.key,
    required this.controller,
    required this.isDarkMode,
  });

  final LoginController controller;
  final bool isDarkMode;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _CardTitle(
          title: 'Signup',
          subtitle: 'Create your account to continue',
          isDarkMode: isDarkMode,
        ),
        SizedBox(height: ResponsiveUtility.height(14)),
        _AuthTextField(
          label: 'Customer Name',
          hint: 'Enter your name',
          controller: controller.signupNameController,
          isDarkMode: isDarkMode,
        ),
        _AuthTextField(
          label: 'Phone Number',
          hint: AppStrings.mobileNumberHint,
          controller: controller.signupMobileController,
          isDarkMode: isDarkMode,
          prefixText: '+91',
          maxLength: 10,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
        ),
        _AuthTextField(
          label: 'Email (Optional)',
          hint: 'Enter your email id',
          controller: controller.signupEmailController,
          isDarkMode: isDarkMode,
          keyboardType: TextInputType.emailAddress,
        ),
        _AuthTextField(
          label: 'Aadhaar Number',
          hint: 'Enter 12 digit Aadhaar',
          controller: controller.signupAadhaarController,
          isDarkMode: isDarkMode,
          maxLength: 12,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
          bottomSpacing: 0,
        ),
      ],
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle({
    required this.title,
    required this.subtitle,
    required this.isDarkMode,
  });

  final String title;
  final String subtitle;
  final bool isDarkMode;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: TextStyle(
            color: isDarkMode ? Color(0xffD1CFCF) : AppColors.titleTextColor,
            fontSize: ResponsiveUtility.fontSize(18),
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: ResponsiveUtility.height(6)),
        Text(
          subtitle,
          style: TextStyle(
            color: isDarkMode
                ? Color(0xffD1CFCF).withValues(alpha: 0.8)
                : AppColors.descriptionTextColor,
            fontSize: ResponsiveUtility.fontSize(14),
          ),
        ),
      ],
    );
  }
}

class _AuthTextField extends StatelessWidget {
  const _AuthTextField({
    required this.label,
    required this.hint,
    required this.controller,
    required this.isDarkMode,
    this.prefixText,
    this.maxLength,
    this.keyboardType,
    this.inputFormatters,
    this.bottomSpacing = 14,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final bool isDarkMode;
  final String? prefixText;
  final int? maxLength;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final double bottomSpacing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: ResponsiveUtility.height(bottomSpacing)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: isDarkMode ? Color(0xffD1CFCF) : AppColors.titleTextColor,
              fontSize: ResponsiveUtility.fontSize(14),
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          TextField(
            controller: controller,
            keyboardType: keyboardType,
            inputFormatters: inputFormatters,
            maxLength: maxLength,
            style: TextStyle(fontSize: ResponsiveUtility.fontSize(16)),
            decoration: InputDecoration(
              counterText: '',
              hintText: hint,
              hintStyle: TextStyle(
                color: AppColors.descriptionTextColor,
                fontSize: ResponsiveUtility.fontSize(16),
              ),
              prefixIcon: prefixText == null
                  ? null
                  : Padding(
                      padding: EdgeInsets.only(
                        left: ResponsiveUtility.width(12),
                        right: ResponsiveUtility.width(6),
                      ),
                      child: Center(
                        widthFactor: 1.0,
                        child: Text(
                          prefixText!,
                          style: TextStyle(
                            color: AppColors.descriptionTextColor,
                            fontSize: ResponsiveUtility.fontSize(16),
                          ),
                        ),
                      ),
                    ),
              prefixIconConstraints: prefixText == null
                  ? null
                  : BoxConstraints(minWidth: ResponsiveUtility.width(56)),
              contentPadding: EdgeInsets.symmetric(
                horizontal: ResponsiveUtility.width(12),
                vertical: ResponsiveUtility.height(14),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ResponsiveUtility.radius(12),
                ),
                borderSide: BorderSide(
                  color: isDarkMode ? Color(0xff242424) : Color(0xFF6E7785),
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ResponsiveUtility.radius(12),
                ),
                borderSide: BorderSide(
                  color: isDarkMode ? Color(0xff242424) : Color(0xFF6E7785),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(
                  ResponsiveUtility.radius(12),
                ),
                borderSide: BorderSide(color: AppColors.primary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
