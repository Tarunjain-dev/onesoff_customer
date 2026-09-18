import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/customer_section/dashboard/getx/customer_product_listing_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/widgets/customer_product_card.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/getx/customer_wishlist_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerProductListingScreen extends StatelessWidget {
  const CustomerProductListingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final CustomerProductListingController controller =
        Get.find<CustomerProductListingController>();
    final CustomerWishlistController? wishlistController =
        Get.isRegistered<CustomerWishlistController>()
        ? Get.find<CustomerWishlistController>()
        : null;

    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            _ListingHeader(title: controller.filter.title),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value && controller.products.isEmpty) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (controller.errorMessage.value != null &&
                    controller.products.isEmpty) {
                  return _ListingState(
                    icon: Icons.error_outline,
                    title: 'Unable to load products',
                    subtitle: controller.errorMessage.value!,
                    actionLabel: 'Retry',
                    onAction: controller.fetchProducts,
                  );
                }

                if (controller.products.isEmpty) {
                  return const _ListingState(
                    icon: Icons.inventory_2_outlined,
                    title: 'No products found',
                    subtitle: 'Try another section or search keyword.',
                  );
                }

                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: controller.fetchProducts,
                  child: GridView.builder(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: ResponsiveUtility.only(
                      left: 18,
                      right: 18,
                      top: 18,
                      bottom: 24,
                    ),
                    itemCount: controller.products.length,
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: ResponsiveUtility.height(14),
                      crossAxisSpacing: ResponsiveUtility.width(14),
                      childAspectRatio: 0.58,
                    ),
                    itemBuilder: (BuildContext context, int index) {
                      final product = controller.products[index];
                      return CustomerProductCard(
                        product: product,
                        isFavorite:
                            wishlistController?.isWishlisted(product.id) ??
                            false,
                        onFavoriteTap: wishlistController == null
                            ? null
                            : () => wishlistController.toggleWishlist(product),
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

class _ListingHeader extends StatelessWidget {
  const _ListingHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: AppColors.primary,
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 62, bottom: 18),
      child: Row(
        children: <Widget>[
          GestureDetector(
            onTap: Get.back,
            child: Icon(
              Icons.arrow_back,
              color: AppColors.white,
              size: ResponsiveUtility.radius(28),
            ),
          ),
          SizedBox(width: ResponsiveUtility.width(14)),
          Expanded(
            child: Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.white,
                fontSize: ResponsiveUtility.fontSize(18),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ListingState extends StatelessWidget {
  const _ListingState({
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
