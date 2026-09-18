import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/storage/app_preferences.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_strings.dart';

class OnboardingItem {
  const OnboardingItem({
    required this.imagePath,
    required this.title,
    required this.description,
  });

  final String imagePath;
  final String title;
  final String description;
}

class OnboardingController extends GetxController {
  final RxInt currentIndex = 0.obs;
  final PageController pageController = PageController();
  final AppPreferences _preferences = Get.find<AppPreferences>();

  final List<OnboardingItem> pages = <OnboardingItem>[
    OnboardingItem(
      imagePath: AppImages.onboarding1,
      title: AppStrings.onboardingOneTitle,
      description: AppStrings.onboardingOneDescription,
    ),
    OnboardingItem(
      imagePath: AppImages.onboarding2,
      title: AppStrings.onboardingTwoTitle,
      description: AppStrings.onboardingTwoDescription,
    ),
    OnboardingItem(
      imagePath: AppImages.onboarding3,
      title: AppStrings.onboardingThreeTitle,
      description: AppStrings.onboardingThreeDescription,
    ),
  ];

  bool get isLastPage => currentIndex.value == pages.length - 1;

  void onPageChanged(int index) {
    currentIndex.value = index;
  }

  Future<void> onPrimaryButtonTap() async {
    if (isLastPage) {
      goToLogin();
      return;
    }

    await pageController.nextPage(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  void onSkipTap() {
    goToLogin();
  }

  Future<void> goToLogin() async {
    await _preferences.setOnboardingSeen();
    Get.offNamed(AppRoutes.login);
  }

  @override
  void onClose() {
    pageController.dispose();
    super.onClose();
  }
}
