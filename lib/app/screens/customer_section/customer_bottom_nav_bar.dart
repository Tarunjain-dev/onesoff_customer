import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/global_controllers.dart/customer_bottom_nav_controller.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerBottomNavBar extends StatelessWidget {
  const CustomerBottomNavBar({super.key});

  @override
  Widget build(BuildContext context) {
    /// -- Dark mode instance
    final isDark = HelperFunctions.isDarkMode(context);

    /// -- Controller instance
    final CustomerBottomNavController bottomNavController =
        Get.isRegistered<CustomerBottomNavController>()
        ? Get.find<CustomerBottomNavController>()
        : Get.put(CustomerBottomNavController());

    return SafeArea(
      top: false,
      bottom: false,
      child: Scaffold(
        extendBody: true,
        body: Obx(
          () => AnimatedSwitcher(
            duration: const Duration(milliseconds: 2),
            transitionBuilder: (child, animation) =>
                FadeTransition(opacity: animation, child: child),
            child: bottomNavController.screens[bottomNavController.index.value],
          ),
        ),

        bottomNavigationBar: Obx(
          () => ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
            ),
            child: Container(
              height: ResponsiveUtility.height(80),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xff111111) : Color(0xfffff8f6),
                border: Border(
                  top: BorderSide(
                    color: isDark ? Color(0xffBFBFBF) : Color(0xffD8C1C5),
                    width: 1,
                  ),
                ),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                ),
              ),
              padding: ResponsiveUtility.symmetric(horizontal: 10, vertical: 2),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildNavItem(
                    bottomNavController: bottomNavController,
                    index: 0,
                    icon: Icons.home,
                    activeIcon: Icons.home,
                    label: 'Dashboard',
                    isDark: isDark,
                  ),

                  _buildNavItem(
                    bottomNavController: bottomNavController,
                    index: 1,
                    icon: Icons.dashboard,
                    activeIcon: Icons.dashboard,
                    label: 'Category',
                    isDark: isDark,
                  ),

                  _buildNavItem(
                    bottomNavController: bottomNavController,
                    index: 2,
                    icon: Icons.shopping_cart_outlined,
                    activeIcon: Icons.shopping_cart,
                    label: 'My Cart',
                    isDark: isDark,
                  ),

                  _buildNavItem(
                    bottomNavController: bottomNavController,
                    index: 3,
                    icon: Icons.favorite,
                    activeIcon: Icons.favorite,
                    label: 'Wishlist',
                    isDark: isDark,
                  ),

                  _buildNavItem(
                    bottomNavController: bottomNavController,
                    index: 4,
                    icon: Icons.person_2,
                    activeIcon: Icons.person_2,
                    label: 'Profile',
                    isDark: isDark,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required CustomerBottomNavController bottomNavController,
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    required bool isDark,
  }) {
    final bool isActive = bottomNavController.index.value == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => bottomNavController.changeTab(index),
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 2),
          curve: Curves.easeInOut,

          padding: EdgeInsets.symmetric(vertical: ResponsiveUtility.height(8)),

          decoration: BoxDecoration(
            color: isActive
                ? isDark
                      ? const Color(0xff534346).withValues(alpha: 0.09)
                      : Color(0xffF5E5E1)
                : isDark
                ? const Color(0xff111111)
                : Color(0xfffff8f6),
            borderRadius: BorderRadius.circular(16),
          ),

          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 2),
                child: Icon(
                  isActive ? activeIcon : icon,
                  key: ValueKey(isActive),
                  size: 24,
                  color: isActive
                      ? isDark
                            ? Color(0xffBFBFBF)
                            : Color(0xff40021B)
                      : isDark
                      ? const Color(0xff534346)
                      : Color(0xff534346).withValues(alpha: 0.6),
                ),
              ),

              SizedBox(height: ResponsiveUtility.height(2)),

              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: TextStyle(
                  fontSize: ResponsiveUtility.fontSize(10),
                  fontWeight: FontWeight.w600,
                  color: isActive
                      ? isDark
                            ? Color(0xffBFBFBF)
                            : Color(0xff40021B)
                      : isDark
                      ? const Color(0xff534346)
                      : Color(0xff534346).withValues(alpha: 0.6),
                ),
                child: Text(label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
