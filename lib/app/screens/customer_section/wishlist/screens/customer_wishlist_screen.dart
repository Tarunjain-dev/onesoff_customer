import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/customer_section/widgets/customer_product_card.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/getx/customer_wishlist_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerWishlistScreen extends StatelessWidget {
  const CustomerWishlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool isDark = HelperFunctions.isDarkMode(context);
    final CustomerWishlistController controller =
        Get.isRegistered<CustomerWishlistController>()
        ? Get.find<CustomerWishlistController>()
        : Get.put(CustomerWishlistController());

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.scaffoldBackgroundColorDark
          : AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            const _WishlistHeader(),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value && controller.products.isEmpty) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (controller.errorMessage.value != null &&
                    controller.products.isEmpty) {
                  return _WishlistState(
                    icon: Icons.error_outline,
                    title: 'Unable to load wishlist',
                    subtitle: controller.errorMessage.value!,
                    actionLabel: 'Retry',
                    onAction: controller.fetchWishlist,
                  );
                }

                if (controller.products.isEmpty) {
                  return const _WishlistState(
                    icon: Icons.favorite_border,
                    title: 'No wishlist products yet',
                    subtitle: 'Tap the heart on any product to save it here.',
                  );
                }

                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: controller.fetchWishlist,
                  child: GridView.builder(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: ResponsiveUtility.only(
                      left: 10,
                      right: 10,
                      top: 10,
                      bottom: 96,
                    ),
                    itemCount: controller.products.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: ResponsiveUtility.width(6),
                      mainAxisSpacing: ResponsiveUtility.height(6),
                      childAspectRatio: 0.4,
                    ),
                    itemBuilder: (BuildContext context, int index) {
                      final product = controller.products[index];
                      return CustomerProductCard(
                        product: product,
                        isFavorite: true,
                        onFavoriteTap: () => controller.toggleWishlist(product),
                      );
                    },
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}

class _WishlistState extends StatelessWidget {
  const _WishlistState({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: ResponsiveUtility.symmetric(horizontal: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              icon,
              color: AppColors.primary,
              size: ResponsiveUtility.radius(42),
            ),
            SizedBox(height: ResponsiveUtility.height(12)),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.black,
                fontSize: ResponsiveUtility.fontSize(18),
                fontWeight: FontWeight.w800,
              ),
            ),
            SizedBox(height: ResponsiveUtility.height(6)),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: const Color(0xFF6A7282),
                fontSize: ResponsiveUtility.fontSize(13),
              ),
            ),
            if (actionLabel != null && onAction != null) ...<Widget>[
              SizedBox(height: ResponsiveUtility.height(16)),
              ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.white,
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WishlistHeader extends StatelessWidget {
  const _WishlistHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary,
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 70, bottom: 14),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Image.asset(
                AppImages.appLogo,
                height: ResponsiveUtility.height(30),
                width: ResponsiveUtility.width(30),
                fit: BoxFit.contain,
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      "Onesoff's Store - Wishlist",
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Your curated collection of premium ethnic-wear.',
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
