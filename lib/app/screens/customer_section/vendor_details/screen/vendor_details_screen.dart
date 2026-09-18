import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/models/vendor_details.dart';
import 'package:onesoff_customer/app/screens/customer_section/vendor_details/getx/vendor_details_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/widgets/customer_product_card.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/getx/customer_wishlist_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class VendorDetailsScreen extends GetView<VendorDetailsController> {
  const VendorDetailsScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
            const _VendorHeader(),
            _VendorSummary(controller: controller),
            _VendorTabs(controller: controller),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value &&
                    controller.details.value == null) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (controller.errorMessage.value != null &&
                    controller.details.value == null) {
                  return _VendorState(
                    icon: Icons.error_outline,
                    title: 'Unable to load vendor',
                    subtitle: controller.errorMessage.value!,
                    actionLabel: 'Retry',
                    onAction: controller.fetchVendorDetails,
                  );
                }

                return IndexedStack(
                  index: controller.selectedTabIndex.value,
                  children: <Widget>[
                    _VendorProducts(
                      controller: controller,
                      wishlistController: wishlistController,
                    ),
                    _VendorReviews(controller: controller),
                    _VendorAbout(controller: controller),
                  ],
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}

class _VendorHeader extends StatelessWidget {
  const _VendorHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary,
      padding: ResponsiveUtility.only(left: 20, right: 20, top: 70, bottom: 10),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              GestureDetector(
                onTap: Get.back,
                child: Icon(
                  Icons.arrow_back,
                  color: AppColors.white,
                  size: ResponsiveUtility.radius(26),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(20)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      "OnesOff's - Vendor",
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Discover vendor curated outfits.',
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.62),
                        fontSize: ResponsiveUtility.fontSize(14),
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

class _VendorSummary extends StatelessWidget {
  const _VendorSummary({required this.controller});

  final VendorDetailsController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final VendorDetails vendor = controller.vendor;
      final VendorReviewSummary summary = controller.summary;
      return Container(
        color: AppColors.white,
        padding: ResponsiveUtility.only(
          left: 20,
          right: 20,
          top: 10,
          bottom: 10,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '${vendor.shopName}\n- Onesoff\'s vendor.',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: ResponsiveUtility.fontSize(16),
                      fontWeight: FontWeight.w600,
                      height: 1.18,
                    ),
                  ),
                  SizedBox(height: ResponsiveUtility.height(12)),
                  Container(
                    padding: ResponsiveUtility.symmetric(
                      horizontal: 13,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(
                        ResponsiveUtility.radius(6),
                      ),
                    ),
                    child: Text(
                      vendor.badgeName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(14),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(width: ResponsiveUtility.width(16)),
            Column(
              children: <Widget>[
                Stack(
                  children: <Widget>[
                    Container(
                      width: ResponsiveUtility.radius(110),
                      height: ResponsiveUtility.radius(110),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(
                          ResponsiveUtility.radius(14),
                        ),
                        border: Border.all(
                          color: AppColors.primary,
                          width: 2,
                          strokeAlign: BorderSide.strokeAlignOutside,
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: _VendorImage(image: vendor.imageUrl),
                    ),
                    Positioned(
                      right: ResponsiveUtility.width(8),
                      top: ResponsiveUtility.height(8),
                      child: Container(
                        width: ResponsiveUtility.radius(28),
                        height: ResponsiveUtility.radius(28),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.primary,
                            strokeAlign: BorderSide.strokeAlignOutside,
                          ),
                        ),
                        child: Icon(
                          Icons.workspace_premium,
                          color: const Color(0xFFFFA000),
                          size: ResponsiveUtility.radius(17),
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: ResponsiveUtility.height(7)),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Icon(
                      Icons.star,
                      color: const Color(0xFFFF9800),
                      size: ResponsiveUtility.radius(15),
                    ),
                    Text(
                      summary.averageRating.toStringAsFixed(1),
                      style: TextStyle(
                        color: AppColors.black,
                        fontSize: ResponsiveUtility.fontSize(14),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                Text(
                  '(${summary.totalReviews} Reviews / ${controller.productCount} Products)',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: ResponsiveUtility.fontSize(12),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    });
  }
}

class _VendorTabs extends StatelessWidget {
  const _VendorTabs({required this.controller});

  final VendorDetailsController controller;

  @override
  Widget build(BuildContext context) {
    const List<String> tabs = <String>['Products', 'Reviews', 'About'];

    return Container(
      height: ResponsiveUtility.height(46),
      color: const Color(0xFFF5F5F5),
      child: Obx(
        () => Row(
          children: List<Widget>.generate(tabs.length, (int index) {
            final bool isActive = controller.selectedTabIndex.value == index;
            return Expanded(
              child: GestureDetector(
                onTap: () => controller.changeTab(index),
                behavior: HitTestBehavior.opaque,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    Text(
                      tabs[index],
                      style: TextStyle(
                        color: isActive
                            ? const Color(0xFF330013)
                            : const Color(0xFF928287),
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: ResponsiveUtility.height(6)),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: ResponsiveUtility.width(isActive ? 128 : 0),
                      height: 2,
                      color: AppColors.black,
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _VendorProducts extends StatelessWidget {
  const _VendorProducts({
    required this.controller,
    required this.wishlistController,
  });

  final VendorDetailsController controller;
  final CustomerWishlistController? wishlistController;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final List<CustomerProduct> products =
          controller.details.value?.products ?? <CustomerProduct>[];
      if (products.isEmpty) {
        return const _VendorState(
          icon: Icons.inventory_2_outlined,
          title: 'No products yet',
          subtitle: 'This vendor has not listed any active products.',
        );
      }

      return RefreshIndicator(
        color: AppColors.primary,
        onRefresh: controller.fetchVendorDetails,
        child: GridView.builder(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: ResponsiveUtility.only(left: 6, right: 6, top: 8, bottom: 6),
          itemCount: products.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: ResponsiveUtility.width(10),
            mainAxisSpacing: ResponsiveUtility.height(10),
            childAspectRatio: 0.38,
          ),
          itemBuilder: (BuildContext context, int index) {
            final CustomerProduct product = products[index];
            return CustomerProductCard(
              product: product,
              isFavorite: wishlistController?.isWishlisted(product.id) ?? false,
              onFavoriteTap: wishlistController == null
                  ? null
                  : () => wishlistController!.toggleWishlist(product),
            );
          },
        ),
      );
    });
  }
}

class _VendorReviews extends StatelessWidget {
  const _VendorReviews({required this.controller});

  final VendorDetailsController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final VendorReviewSummary summary = controller.summary;
      final List<VendorReview> reviews =
          controller.details.value?.reviews ?? <VendorReview>[];
      if (summary.totalReviews == 0 && reviews.isEmpty) {
        return const _VendorState(
          icon: Icons.star_border,
          title: 'No reviews yet',
          subtitle: 'Customer reviews will appear here once approved.',
        );
      }

      return ListView(
        physics: const BouncingScrollPhysics(),
        padding: ResponsiveUtility.only(
          left: 20,
          right: 20,
          top: 30,
          bottom: 20,
        ),
        children: <Widget>[
          Center(
            child: Column(
              children: <Widget>[
                Text(
                  summary.averageRating.toStringAsFixed(1),
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: ResponsiveUtility.fontSize(24),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: ResponsiveUtility.height(4)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List<Widget>.generate(
                    5,
                    (int index) => Icon(
                      index < summary.averageRating.floor()
                          ? Icons.star
                          : Icons.star_border,
                      color: const Color(0xFFD47F16),
                      size: ResponsiveUtility.radius(20),
                    ),
                  ),
                ),
                SizedBox(height: ResponsiveUtility.height(4)),
                Text(
                  'Based on ${summary.totalReviews} reviews',
                  style: TextStyle(
                    color: const Color(0xFF5A4C51),
                    fontSize: ResponsiveUtility.fontSize(12),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(20)),
          ...List<Widget>.generate(5, (int index) {
            final int rating = 5 - index;
            final int count = summary.ratingBreakdown[rating] ?? 0;
            final double factor = summary.totalReviews == 0
                ? 0
                : count / summary.totalReviews;
            return _RatingBar(label: '$rating', value: count, factor: factor);
          }),
          SizedBox(height: ResponsiveUtility.height(10)),
          ...reviews.map(
            (VendorReview review) => Padding(
              padding: EdgeInsets.only(bottom: ResponsiveUtility.height(10)),
              child: _LargeReviewTile(review: review),
            ),
          ),
        ],
      );
    });
  }
}

class _RatingBar extends StatelessWidget {
  const _RatingBar({
    required this.label,
    required this.value,
    required this.factor,
  });

  final String label;
  final int value;
  final double factor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(bottom: 8),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: ResponsiveUtility.width(72),
            child: Row(
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: const Color(0xFF1B1B1B),
                    fontSize: ResponsiveUtility.fontSize(14),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(width: ResponsiveUtility.width(10)),
                Icon(
                  Icons.star,
                  color: const Color(0xFF5C4950),
                  size: ResponsiveUtility.radius(20),
                ),
              ],
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(ResponsiveUtility.radius(16)),
              child: LinearProgressIndicator(
                minHeight: ResponsiveUtility.height(12),
                value: factor,
                color: AppColors.primary,
                backgroundColor: const Color(0xFFEBDCDC),
              ),
            ),
          ),
          SizedBox(width: ResponsiveUtility.width(10)),
          SizedBox(
            width: ResponsiveUtility.width(44),
            child: Text(
              '$value',
              textAlign: TextAlign.right,
              style: TextStyle(
                color: const Color(0xFF5A4C51),
                fontSize: ResponsiveUtility.fontSize(14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LargeReviewTile extends StatelessWidget {
  const _LargeReviewTile({required this.review});

  final VendorReview review;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 10, bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F4F4),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  review.customerName,
                  style: TextStyle(
                    color: const Color(0xFF131A25),
                    fontSize: ResponsiveUtility.fontSize(14),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(
                Icons.star,
                color: const Color(0xFFD7A10B),
                size: ResponsiveUtility.radius(17),
              ),
              Text(
                review.rating.toStringAsFixed(1),
                style: TextStyle(
                  color: AppColors.black,
                  fontSize: ResponsiveUtility.fontSize(14),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(4)),
          Text(
            review.displayMonth,
            style: TextStyle(
              color: const Color(0xFF666666),
              fontSize: ResponsiveUtility.fontSize(12),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          Text(
            review.comment,
            style: TextStyle(
              color: const Color(0xFF5D6674),
              fontSize: ResponsiveUtility.fontSize(12),
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _VendorImage extends StatelessWidget {
  const _VendorImage({required this.image});

  final String image;

  @override
  Widget build(BuildContext context) {
    final bool isNetwork =
        image.startsWith('http://') || image.startsWith('https://');
    if (isNetwork) {
      return Image.network(
        image,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) =>
            Image.asset(AppImages.delhi, fit: BoxFit.cover),
      );
    }
    return Image.asset(image, fit: BoxFit.cover);
  }
}

class _VendorState extends StatelessWidget {
  const _VendorState({
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

class _VendorAbout extends StatelessWidget {
  const _VendorAbout({required this.controller});

  final VendorDetailsController controller;

  @override
  Widget build(BuildContext context) {
    final VendorDetails vendor = controller.vendor;
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: ResponsiveUtility.only(left: 20, right: 20, top: 20, bottom: 20),
      children: <Widget>[
        Text(
          'About ${vendor.shopName}',
          style: TextStyle(
            color: AppColors.black,
            fontSize: ResponsiveUtility.fontSize(16),
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: ResponsiveUtility.height(8)),
        const Divider(color: Color(0xFFD4D4D4)),
        SizedBox(height: ResponsiveUtility.height(8)),
        const _AboutPoint(text: 'Bridal & designer wear on rent'),
        const _AboutPoint(text: '10+ years experience'),
        const _AboutPoint(text: 'Quality checked outfits'),
        SizedBox(height: ResponsiveUtility.height(8)),
        const Divider(color: Color(0xFFD4D4D4)),
        SizedBox(height: ResponsiveUtility.height(8)),
        _InfoTextBlock(title: 'Address:', value: vendor.address),
        const Divider(color: Color(0xFFD4D4D4)),
        SizedBox(height: ResponsiveUtility.height(8)),
        _InfoTextBlock(
          title: 'Working Days:',
          value: 'Mon-Sat    |    10 AM - 9 PM',
        ),
      ],
    );
  }
}

class _AboutPoint extends StatelessWidget {
  const _AboutPoint({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(bottom: 10),
      child: Row(
        children: <Widget>[
          Icon(
            Icons.check_box,
            color: const Color(0xFFA03333),
            size: ResponsiveUtility.radius(13),
          ),
          SizedBox(width: ResponsiveUtility.width(10)),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: AppColors.black,
                fontSize: ResponsiveUtility.fontSize(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoTextBlock extends StatelessWidget {
  const _InfoTextBlock({required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: AppColors.black,
              fontSize: ResponsiveUtility.fontSize(14),
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(6)),
          Text(
            value,
            style: TextStyle(
              color: AppColors.black,
              fontSize: ResponsiveUtility.fontSize(12),
            ),
          ),
        ],
      ),
    );
  }
}
