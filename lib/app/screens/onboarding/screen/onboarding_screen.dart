import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/onboarding/getx/onboarding_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_strings.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class OnboardingScreen extends GetView<OnboardingController> {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    
    final double safeBottom = MediaQuery.viewPaddingOf(context).bottom;
    final double controlsBottomPadding = ResponsiveUtility.height(22) + safeBottom;
    final double controlsReservedHeight = ResponsiveUtility.height(110) + safeBottom;

    /// --  Dark mod instance.
    bool isDarkMode = HelperFunctions.isDarkMode(context);

    return Scaffold(
      backgroundColor: isDarkMode ? AppColors.scaffoldBackgroundColorDark : AppColors.scaffoldBackgroundColor,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Stack(
          children: <Widget>[
            PageView.builder(
              controller: controller.pageController,
              itemCount: controller.pages.length,
              onPageChanged: controller.onPageChanged,
              itemBuilder: (BuildContext context, int index) {
                return _OnboardingPage(
                  page: controller.pages[index],
                  controlsReservedHeight: controlsReservedHeight,
                );
              },
            ),
            Positioned(
              left: ResponsiveUtility.width(26),
              right: ResponsiveUtility.width(26),
              bottom: controlsBottomPadding,
              child: _OnboardingFooter(
                controller: controller,
                pageCount: controller.pages.length,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({
    required this.page,
    required this.controlsReservedHeight,
  });

  final OnboardingItem page;
  final double controlsReservedHeight;

  @override
  Widget build(BuildContext context) {
    final Size size = ResponsiveUtility.screenSize();
    final double panelTop = size.height * 0.36;
    final double slopeDepth = ResponsiveUtility.height(96); 
    final double imageHeight = panelTop + slopeDepth + ResponsiveUtility.height(10); 

     /// --  Dark mod instance.
    bool isDarkMode = HelperFunctions.isDarkMode(context);

    return Stack(
      children: <Widget>[
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: imageHeight,
          child: Image.asset(page.imagePath, fit: BoxFit.cover, alignment: Alignment.topCenter,),
        ),
        Positioned.fill(
          top: panelTop,
          child: Container(
            decoration: const BoxDecoration(
              boxShadow: <BoxShadow>[
                BoxShadow(color: AppColors.shadow, blurRadius: 8, offset: Offset(0, -1),),
              ],
            ),
            child: ClipPath(
              clipper: _DiagonalPanelClipper(slopeDepth: slopeDepth),
              child: Container(
                color: isDarkMode ? AppColors.scaffoldBackgroundColorDark : AppColors.scaffoldBackgroundColor,
                padding: EdgeInsets.fromLTRB(
                  ResponsiveUtility.width(30),
                  slopeDepth + ResponsiveUtility.height(24),
                  ResponsiveUtility.width(30),
                  controlsReservedHeight,
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        page.title,
                        style: TextStyle(
                          color: isDarkMode ? AppColors.white :AppColors.textPrimary,
                          fontSize: ResponsiveUtility.fontSize(24),
                          fontWeight: FontWeight.w700,
                          height: 1.08,
                        ),
                      ),
                      SizedBox(height: ResponsiveUtility.height(16)), 
                      Text(
                        page.description,
                        style: TextStyle(
                          color: isDarkMode ? Color(0xff8D8D8D).withValues(alpha: 1.0) :AppColors.descriptionTextColor,
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w400,
                          height: 1.3,
                        ),
                      ),
                      SizedBox(height: ResponsiveUtility.height(10)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _OnboardingFooter extends StatelessWidget {
  const _OnboardingFooter({
    required this.controller,
    required this.pageCount,
  });

  final OnboardingController controller;
  final int pageCount;

  @override
  Widget build(BuildContext context) {
    
    /// --  Dark mod instance.
    bool isDarkMode = HelperFunctions.isDarkMode(context);

    return Obx(
      () => Row(
        children: <Widget>[
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: controller.onSkipTap,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size(
                    ResponsiveUtility.width(56),
                    ResponsiveUtility.height(36),
                  ),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  AppStrings.skip,
                  style: TextStyle(
                    color: isDarkMode ? AppColors.white : AppColors.descriptionTextColor,
                    fontSize: ResponsiveUtility.fontSize(18),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: List<Widget>.generate(
                  pageCount,
                  (int dotIndex) {
                    final bool isActive = dotIndex == controller.currentIndex.value;
                    final double dotSize = isActive ? 14 : 12;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      width: ResponsiveUtility.width(dotSize),
                      height: ResponsiveUtility.height(dotSize),
                      margin: EdgeInsets.symmetric(horizontal: ResponsiveUtility.width(3)),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isActive ? 
                        AppColors.primary : 
                        isDarkMode ? AppColors.white.withValues(alpha: 0.2) : AppColors.inactiveDot,
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: _DiamondActionButton(
                label: controller.isLastPage ? AppStrings.start : AppStrings.next,
                onTap: controller.onPrimaryButtonTap,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DiamondActionButton extends StatelessWidget {
  const _DiamondActionButton({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {

    final double side = ResponsiveUtility.radius(74);
    return GestureDetector(
      onTap: onTap,
      child: Transform.rotate(
        angle: math.pi / 4,
        child: Container(
          width: side,
          height: side,
          decoration: BoxDecoration(
            color: AppColors.primary ,
            borderRadius: BorderRadius.circular(ResponsiveUtility.radius(14)),
            boxShadow: const <BoxShadow>[
              BoxShadow(
                color: AppColors.shadow,
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Transform.rotate(
            angle: -math.pi / 4,
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: ResponsiveUtility.fontSize(18),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DiagonalPanelClipper extends CustomClipper<Path> {
  const _DiagonalPanelClipper({required this.slopeDepth});

  final double slopeDepth;

  @override
  Path getClip(Size size) {
    final double effectiveDepth = slopeDepth.clamp(24.0, size.height * 0.45).toDouble();
    return Path()
      ..lineTo(size.width, effectiveDepth)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) {
    return false;
  }
}
