import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/splash/getx/splash_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_strings.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class SplashScreen extends GetView<SplashController> {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          Image.asset(AppImages.splash,fit: BoxFit.cover),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: <Color>[
                  Color(0xff000000).withValues(alpha: 0.0),
                  Color(0xff1A050A).withValues(alpha: 0.90),
                  Color(0xff0F0104).withValues(alpha: 1.0),
                ],
                stops: <double>[0.0, 0.64, 0.80],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: ResponsiveUtility.symmetric(horizontal: 24.0),
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: ResponsiveUtility.only(bottom: 64.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Image.asset(
                        AppImages.appLogo,
                        width: ResponsiveUtility.width(120),
                        height: ResponsiveUtility.height(120),
                        fit: BoxFit.contain,
                      ),
                      SizedBox(height: ResponsiveUtility.height(22)),
                      Text(
                        AppStrings.splashTagline,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.textOnDark,
                          fontSize: ResponsiveUtility.fontSize(16),
                          height: 1.28,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
