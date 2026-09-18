import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerProductCard extends StatelessWidget {
  const CustomerProductCard({
    super.key,
    this.image,
    this.product,
    this.isFavorite = false,
    this.onTap,
    this.onFavoriteTap,
  }) : assert(image != null || product != null);

  final String? image;
  final CustomerProduct? product;
  final bool isFavorite;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;

  @override
  Widget build(BuildContext context) {
    final String resolvedImage = product?.imageUrl ?? image!;
    return GestureDetector(
      onTap:
          onTap ??
          () => Get.toNamed(
            AppRoutes.productDetail,
            arguments: product ?? resolvedImage,
          ),
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
          border: Border.all(color: const Color(0xFFD8D8D8)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              flex: 6,
              child: Stack(
                children: <Widget>[
                  Positioned.fill(child: _ProductImage(image: resolvedImage)),
                  Positioned(
                    left: ResponsiveUtility.width(4),
                    top: ResponsiveUtility.height(8),
                    child: _BadgeIcon(
                      icon: Icons.local_fire_department,
                      backgroundColor: AppColors.white,
                      iconColor: const Color(0xFFFFA000),
                      borderColor: const Color(0xFFFFA000),
                    ),
                  ),
                  Positioned(
                    right: ResponsiveUtility.width(4),
                    top: ResponsiveUtility.height(8),
                    child: GestureDetector(
                      onTap: onFavoriteTap,
                      behavior: HitTestBehavior.opaque,
                      child: _BadgeIcon(
                        icon: isFavorite
                            ? Icons.favorite
                            : Icons.favorite_border,
                        backgroundColor: AppColors.white,
                        iconColor: isFavorite ? Colors.red : AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 5,
              child: Padding(
                padding: ResponsiveUtility.only(
                  left: 9,
                  right: 9,
                  top: 8,
                  bottom: 8,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      product?.name ??
                          'Bridal Lehenga - Rose Gold with hosary.',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.black,
                        fontSize: ResponsiveUtility.fontSize(14),
                        fontWeight: FontWeight.w500,
                        height: 1.08,
                      ),
                    ),
                    SizedBox(height: ResponsiveUtility.height(5)),
                    Text(
                      product?.description ??
                          'Deep maroon lehenga with zari detailing and comfortable lining.',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: const Color(0xFF242424),
                        fontSize: ResponsiveUtility.fontSize(11),
                        height: 1.1,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'Renting at:',
                      style: TextStyle(
                        color: const Color(0xFFFF5A1F),
                        fontSize: ResponsiveUtility.fontSize(10),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            product?.rentLabel ?? 'Rs.3999/day',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: ResponsiveUtility.fontSize(12),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: const Color(0xFF777777),
                          size: ResponsiveUtility.radius(22),
                        ),
                      ],
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
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.image});

  final String image;

  @override
  Widget build(BuildContext context) {
    final bool isNetwork =
        image.startsWith('http://') || image.startsWith('https://');
    if (isNetwork) {
      return Image.network(
        image,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const ColoredBox(
          color: Color(0xFFF1E8EA),
          child: Center(child: Icon(Icons.image_not_supported_outlined)),
        ),
      );
    }
    return Image.asset(image, fit: BoxFit.cover);
  }
}

class _BadgeIcon extends StatelessWidget {
  const _BadgeIcon({
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
    this.borderColor,
  });

  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: ResponsiveUtility.radius(24),
      height: ResponsiveUtility.radius(24),
      decoration: BoxDecoration(
        color: backgroundColor,
        shape: BoxShape.circle,
        border: borderColor == null ? null : Border.all(color: borderColor!),
      ),
      child: Icon(icon, color: iconColor, size: ResponsiveUtility.radius(15)),
    );
  }
}
