import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_cart.dart';
import 'package:onesoff_customer/app/data/models/product_detail.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_cart_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/product_detail/getx/product_detail_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/widgets/customer_product_card.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/getx/customer_wishlist_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class ProductDetailScreen extends GetView<ProductDetailController> {
  const ProductDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: Stack(
        children: <Widget>[
          SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: EdgeInsets.only(bottom: ResponsiveUtility.height(104)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _ProductGallery(controller: controller),
                Padding(
                  padding: ResponsiveUtility.only(left: 10, right: 10, top: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Obx(() {
                        if (controller.isLoading.value &&
                            controller.product.value == null) {
                          return const LinearProgressIndicator(
                            color: AppColors.primary,
                            minHeight: 2,
                          );
                        }
                        if (controller.errorMessage.value != null &&
                            controller.product.value == null) {
                          return _ErrorBlock(
                            message: controller.errorMessage.value!,
                            onRetry: controller.fetchProductDetail,
                          );
                        }
                        return _ProductTitleBlock(controller: controller);
                      }),
                      SizedBox(height: ResponsiveUtility.height(18)),
                      const _InfoChips(),
                      SizedBox(height: ResponsiveUtility.height(16)),
                      _RentingPeriod(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(18)),
                      _SizeRange(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(18)),
                      _TimelineCard(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(18)),
                      _MeasurementCard(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(14)),
                      _TrialRequestCard(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(14)),
                      _ProductDetailsCard(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(14)),
                      _SellerCard(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(14)),
                      _ReviewsCard(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(14)),
                      Text(
                        'Recommended products',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: ResponsiveUtility.height(3)),
                      Text(
                        'Explore similar items that match your style',
                        style: TextStyle(
                          color: const Color(0xFF5E6673),
                          fontSize: ResponsiveUtility.fontSize(12),
                        ),
                      ),
                      SizedBox(height: ResponsiveUtility.height(10)),
                      _RecommendedProducts(controller: controller),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _BottomActions(controller: controller),
        ],
      ),
    );
  }
}

class _ProductGallery extends StatelessWidget {
  const _ProductGallery({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: ResponsiveUtility.height(390),
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          Obx(
            () => _DetailImage(
              image:
                  controller.images[controller.selectedImageIndex.value.clamp(
                    0,
                    controller.images.length - 1,
                  )],
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
          ),
          Positioned(
            left: ResponsiveUtility.width(18),
            top: ResponsiveUtility.height(42),
            child: _RoundOverlayButton(icon: Icons.arrow_back, onTap: Get.back),
          ),
          Positioned(
            right: ResponsiveUtility.width(18),
            top: ResponsiveUtility.height(42),
            child: Obx(() {
              final ProductDetail? product = controller.product.value;
              final CustomerWishlistController? wishlistController =
                  Get.isRegistered<CustomerWishlistController>()
                  ? Get.find<CustomerWishlistController>()
                  : null;
              final bool isFavorite =
                  product != null &&
                  wishlistController?.isWishlisted(product.id) == true;
              return _RoundOverlayButton(
                icon: isFavorite ? Icons.favorite : Icons.favorite_border,
                iconColor: isFavorite ? Colors.red : AppColors.white,
                onTap: product == null || wishlistController == null
                    ? () {}
                    : () => wishlistController.toggleWishlist(
                        product.toCustomerProduct(),
                      ),
              );
            }),
          ),
          Positioned(
            right: ResponsiveUtility.width(18),
            top: ResponsiveUtility.height(122),
            child: Obx(
              () => Column(
                children: List<Widget>.generate(
                  controller.images.length,
                  (int index) => GestureDetector(
                    onTap: () => controller.selectImage(index),
                    child: Obx(
                      () => Container(
                        width: ResponsiveUtility.radius(36),
                        height: ResponsiveUtility.radius(42),
                        margin: EdgeInsets.only(
                          bottom: ResponsiveUtility.height(7),
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(
                            ResponsiveUtility.radius(8),
                          ),
                          border: Border.all(
                            strokeAlign: BorderSide.strokeAlignOutside,
                            color: controller.selectedImageIndex.value == index
                                ? AppColors.primary
                                : const Color(0xff575757),
                            width: 1.2,
                          ),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: _DetailImage(
                          image: controller.images[index],
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
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

class _ProductTitleBlock extends StatelessWidget {
  const _ProductTitleBlock({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final ProductDetail? product = controller.product.value;
      final int days = controller.selectedPeriodDays;
      final num rating = controller.averageRating;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  product?.name ?? 'Product details',
                  style: TextStyle(
                    color: const Color(0xFF181818),
                    fontSize: ResponsiveUtility.fontSize(16.5),
                    fontWeight: FontWeight.w600,
                    height: 1.04,
                  ),
                ),
              ),
              Container(
                padding: ResponsiveUtility.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1D8),
                  borderRadius: BorderRadius.circular(
                    ResponsiveUtility.radius(5),
                  ),
                ),
                child: Row(
                  children: <Widget>[
                    Icon(
                      Icons.star,
                      color: const Color(0xFFFF9E18),
                      size: ResponsiveUtility.radius(14),
                    ),
                    SizedBox(width: ResponsiveUtility.width(3)),
                    Text(
                      rating > 0 ? rating.toStringAsFixed(1) : '0.0',
                      style: TextStyle(
                        color: const Color(0xFFFF8A00),
                        fontSize: ResponsiveUtility.fontSize(10),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(4)),
          Text(
            product?.description ?? 'Loading product description...',
            style: TextStyle(
              color: const Color(0xFF87909C),
              fontSize: ResponsiveUtility.fontSize(12),
              height: 1.2,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Expanded(
                child: Text.rich(
                  TextSpan(
                    text: product?.rentLabel(days) ?? 'Rent Price : Rs. 0',
                    style: TextStyle(
                      color: const Color(0xFF181818),
                      fontSize: ResponsiveUtility.fontSize(14),
                      fontWeight: FontWeight.w600,
                    ),
                    children: <InlineSpan>[
                      TextSpan(
                        text: ' (for ${days}days)',
                        style: TextStyle(
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Text(
                'SKU Code : ${controller.selectedVariant?.sku ?? product?.sku ?? '-'}',
                style: TextStyle(
                  color: const Color(0xFFA0A5AE),
                  fontSize: ResponsiveUtility.fontSize(10),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          Text(
            '${product?.securityDepositLabel(days) ?? 'Security Deposit: Rs. 0'}\nCalculated as Rs. ${product?.securityDepositPerDay.round() ?? 0} refundable deposit per day.',
            style: TextStyle(
              color: const Color(0xFF7B818C),
              fontSize: ResponsiveUtility.fontSize(12),
              height: 1.28,
            ),
          ),
        ],
      );
    });
  }
}

class _InfoChips extends StatelessWidget {
  const _InfoChips();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: _InfoChip(
            label: 'Custom Fitting',
            onTap: () => _showFeatureDialog(
              title: 'Custom Fitting',
              description:
                  'Vendor-assisted fitting support helps you request small comfort adjustments before your rental is confirmed.',
            ),
          ),
        ),
        SizedBox(width: ResponsiveUtility.width(7)),
        Expanded(
          child: _InfoChip(
            label: 'Refundable deposit',
            onTap: () => _showFeatureDialog(
              title: 'Refundable Deposit',
              description:
                  'The security deposit is collected for booking safety and is refunded after the outfit is returned and checked.',
            ),
          ),
        ),
        SizedBox(width: ResponsiveUtility.width(7)),
        Expanded(
          child: _InfoChip(
            label: 'Pickup & Deposit',
            onTap: () => _showFeatureDialog(
              title: 'Pickup & Deposit',
              description:
                  'Pickup and return coordination is handled around your rental dates so the outfit reaches you on time.',
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: ResponsiveUtility.height(34),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(5)),
        ),
        child: Center(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.white,
              fontSize: ResponsiveUtility.fontSize(11),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _RentingPeriod extends StatelessWidget {
  const _RentingPeriod({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final List<int> periods = controller.rentingPeriods;
      return _OptionBlock(
        title: 'Renting Period',
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: List<Widget>.generate(
              periods.length,
              (int index) => Padding(
                padding: EdgeInsets.only(right: ResponsiveUtility.width(24)),
                child: _RadioOption(
                  label: '${periods[index]} Days',
                  isSelected: controller.selectedPeriodIndex.value == index,
                  onTap: () => controller.selectPeriod(index),
                ),
              ),
            ),
          ),
        ),
      );
    });
  }
}

class _SizeRange extends StatelessWidget {
  const _SizeRange({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final List<String> labels = controller.sizeLabels;
      return _OptionBlock(
        title: 'Size Range & Colors',
        trailing: Row(
          children: <Widget>[
            Icon(
              Icons.straighten,
              color: const Color(0xFF8EA0B9),
              size: ResponsiveUtility.radius(16),
            ),
            Text(
              'Size Chart',
              style: TextStyle(
                color: const Color(0xFF6F7D90),
                fontSize: ResponsiveUtility.fontSize(12),
                decoration: TextDecoration.underline,
              ),
            ),
          ],
        ),
        child: Wrap(
          spacing: ResponsiveUtility.width(22),
          runSpacing: ResponsiveUtility.height(10),
          children: List<Widget>.generate(
            labels.length,
            (int index) => _RadioOption(
              label: labels[index],
              isSelected: controller.selectedSizeIndex.value == index,
              onTap: () => controller.selectSize(index),
            ),
          ),
        ),
      );
    });
  }
}

class _OptionBlock extends StatelessWidget {
  const _OptionBlock({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(
              title,
              style: TextStyle(
                color: AppColors.primary,
                fontSize: ResponsiveUtility.fontSize(14),
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            ?trailing,
          ],
        ),
        SizedBox(height: ResponsiveUtility.height(14)),
        child,
      ],
    );
  }
}

class _RadioOption extends StatelessWidget {
  const _RadioOption({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: <Widget>[
          Container(
            width: ResponsiveUtility.radius(18),
            height: ResponsiveUtility.radius(18),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primary : const Color(0xFFEFF1F3),
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? AppColors.primary : const Color(0xFFD2D6DB),
              ),
            ),
            child: isSelected
                ? Center(
                    child: Container(
                      width: ResponsiveUtility.radius(6),
                      height: ResponsiveUtility.radius(6),
                      decoration: const BoxDecoration(
                        color: AppColors.white,
                        shape: BoxShape.circle,
                      ),
                    ),
                  )
                : null,
          ),
          SizedBox(width: ResponsiveUtility.width(10)),
          Text(
            label,
            style: TextStyle(
              color: const Color(0xFF67717F),
              fontSize: ResponsiveUtility.fontSize(12),
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          'Renting Timeline',
          style: TextStyle(
            color: AppColors.primary,
            fontSize: ResponsiveUtility.fontSize(14),
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: ResponsiveUtility.height(12)),
        GestureDetector(
          onTap: () => _showBookingCalendar(context, controller),
          child: _CardShell(
            padding: ResponsiveUtility.symmetric(horizontal: 12, vertical: 12),
            child: Obx(
              () => Row(
                children: <Widget>[
                  Expanded(
                    child: _DateInputBox(
                      label: 'Start Date',
                      value: controller.formattedStartDate,
                    ),
                  ),
                  SizedBox(width: ResponsiveUtility.width(8)),
                  Expanded(
                    child: _DateInputBox(
                      label: 'End Date',
                      value: controller.formattedEndDate,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DateInputBox extends StatelessWidget {
  const _DateInputBox({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: ResponsiveUtility.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(8)),
        border: Border.all(color: const Color(0xFFE2E4E8)),
      ),
      child: Row(
        children: <Widget>[
          Icon(
            Icons.calendar_today_outlined,
            color: const Color(0xFF657080),
            size: ResponsiveUtility.radius(16),
          ),
          SizedBox(width: ResponsiveUtility.width(6)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: const Color(0xFFA8AFB9),
                    fontSize: ResponsiveUtility.fontSize(9),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: const Color(0xFF334052),
                    fontSize: ResponsiveUtility.fontSize(12),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MeasurementCard extends StatelessWidget {
  const _MeasurementCard({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return _CardShell(
      padding: EdgeInsets.zero,
      child: Column(
        children: <Widget>[
          Padding(
            padding: ResponsiveUtility.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: <Widget>[
                _MeasureCell(label: 'Chest', isHeader: true),
                _MeasureCell(label: 'Waist', isHeader: true),
                _MeasureCell(label: 'Height', isHeader: true),
              ],
            ),
          ),
          Container(
            padding: ResponsiveUtility.symmetric(horizontal: 16, vertical: 14),
            color: const Color(0xFFF1F1F1),
            child: Obx(
              () => Row(
                children: <Widget>[
                  _MeasureCell(label: controller.selectedVariant?.size ?? '-'),
                  const _MeasureCell(label: '-'),
                  const _MeasureCell(label: '-'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MeasureCell extends StatelessWidget {
  const _MeasureCell({required this.label, this.isHeader = false});

  final String label;
  final bool isHeader;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: isHeader ? AppColors.primary : const Color(0xFF657080),
          fontSize: ResponsiveUtility.fontSize(14),
          fontWeight: isHeader ? FontWeight.w800 : FontWeight.w600,
        ),
      ),
    );
  }
}

class _TrialRequestCard extends StatelessWidget {
  const _TrialRequestCard({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return _CardShell(
      color: const Color(0xFFF7F7F7),
      padding: ResponsiveUtility.only(left: 14, right: 12, top: 14, bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: ResponsiveUtility.radius(32),
                height: ResponsiveUtility.radius(32),
                decoration: const BoxDecoration(
                  color: Color(0xFFFFEEF3),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.event_available_outlined,
                  color: AppColors.primary,
                  size: ResponsiveUtility.radius(18),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              Text(
                'Trial Request',
                style: TextStyle(
                  color: const Color(0xFF181818),
                  fontSize: ResponsiveUtility.fontSize(14),
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              SizedBox(
                width: ResponsiveUtility.width(72),
                height: ResponsiveUtility.height(28),
                child: ElevatedButton(
                  onPressed: () => _showTrialDialog(context, controller),
                  style: ElevatedButton.styleFrom(
                    elevation: 0,
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        ResponsiveUtility.radius(8),
                      ),
                    ),
                    padding: EdgeInsets.zero,
                  ),
                  child: Text(
                    'Request',
                    style: TextStyle(fontSize: ResponsiveUtility.fontSize(12)),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          Text(
            'Try the outfit before final booking. Choose today or tomorrow, and the vendor will confirm availability for your trial visit.',
            style: TextStyle(
              color: const Color(0xFF7B818C),
              fontSize: ResponsiveUtility.fontSize(12),
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductDetailsCard extends StatelessWidget {
  const _ProductDetailsCard({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(
      () => _CardShell(
        color: const Color(0xFFF4F4F4),
        padding: ResponsiveUtility.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: controller.isDetailsExpanded.value ? 18 : 20,
        ),
        child: Column(
          children: <Widget>[
            _ExpandableHeader(
              title: 'Product Details',
              isExpanded: controller.isDetailsExpanded.value,
              onTap: controller.toggleDetailsExpanded,
            ),
            if (controller.isDetailsExpanded.value) ...<Widget>[
              const Divider(height: 22),
              if (controller.product.value?.specifications.isEmpty ?? true)
                const _SpecRow(label: 'Specifications', value: 'Not available')
              else
                ...controller.product.value!.specifications.map(
                  (ProductSpecification spec) =>
                      _SpecRow(label: spec.label, value: spec.value),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SpecRow extends StatelessWidget {
  const _SpecRow({required this.label, this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: ResponsiveUtility.symmetric(vertical: 9),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFE1E1E1))),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: const Color(0xFF393939),
                fontSize: ResponsiveUtility.fontSize(12),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value ?? '',
            style: TextStyle(
              color: const Color(0xFF393939),
              fontSize: ResponsiveUtility.fontSize(12),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SellerCard extends StatelessWidget {
  const _SellerCard({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final ProductVendor? vendor = controller.product.value?.vendor;
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF7F7F7),
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
          border: Border.all(color: const Color(0xFFE8E8E8)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: <Widget>[
            Container(
              height: ResponsiveUtility.height(28),
              width: double.infinity,
              color: const Color(0xFF4F1726),
              alignment: Alignment.centerLeft,
              padding: ResponsiveUtility.symmetric(horizontal: 12),
              child: Text(
                'Sold By',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: ResponsiveUtility.fontSize(14),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Padding(
              padding: ResponsiveUtility.symmetric(
                horizontal: 12,
                vertical: 12,
              ),
              child: Row(
                children: <Widget>[
                  ClipOval(
                    child: _DetailImage(
                      image: vendor?.imageUrl ?? AppImages.indore,
                      width: ResponsiveUtility.radius(50),
                      height: ResponsiveUtility.radius(50),
                      fit: BoxFit.cover,
                    ),
                  ),
                  SizedBox(width: ResponsiveUtility.width(10)),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          vendor?.name ?? 'Vendor details unavailable',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: const Color(0xFF263142),
                            fontSize: ResponsiveUtility.fontSize(12),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          vendor?.location ?? 'Location not added',
                          style: TextStyle(
                            color: const Color(0xFF7B818C),
                            fontSize: ResponsiveUtility.fontSize(10),
                          ),
                        ),
                        SizedBox(height: ResponsiveUtility.height(5)),
                        Container(
                          padding: ResponsiveUtility.symmetric(
                            horizontal: 8,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFF7A20),
                            borderRadius: BorderRadius.circular(
                              ResponsiveUtility.radius(4),
                            ),
                          ),
                          child: Text(
                            vendor?.badgeName ?? 'Verified Vendor',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: ResponsiveUtility.fontSize(10),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: ResponsiveUtility.width(8)),
                  SizedBox(
                    width: ResponsiveUtility.width(96),
                    height: ResponsiveUtility.height(38),
                    child: ElevatedButton(
                      onPressed: () => Get.toNamed(
                        AppRoutes.vendorDetails,
                        arguments: <String, dynamic>{
                          'vendorId': vendor?.id,
                          'vendor': <String, dynamic>{
                            'id': vendor?.id,
                            'shopName': vendor?.name,
                            'profileImageUrl': vendor?.imageUrl,
                            'badgeName': vendor?.badgeName,
                            'address': vendor?.location,
                          },
                        },
                      ),
                      style: ElevatedButton.styleFrom(
                        elevation: 0,
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            ResponsiveUtility.radius(7),
                          ),
                        ),
                      ),
                      child: Text(
                        'View Shop',
                        style: TextStyle(
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    });
  }
}

class _ReviewsCard extends StatelessWidget {
  const _ReviewsCard({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(
      () => _CardShell(
        color: const Color(0xFFF7F7F7),
        padding: ResponsiveUtility.only(
          left: 12,
          right: 12,
          top: 20,
          bottom: controller.isReviewsExpanded.value ? 12 : 20,
        ),
        child: Column(
          children: <Widget>[
            Padding(
              padding: ResponsiveUtility.symmetric(horizontal: 10),
              child: _ExpandableHeader(
                title: 'Product Reviews',
                isExpanded: controller.isReviewsExpanded.value,
                onTap: controller.toggleReviewsExpanded,
              ),
            ),
            if (controller.isReviewsExpanded.value) ...<Widget>[
              SizedBox(height: ResponsiveUtility.height(10)),
              if (controller.reviews.value?.reviews.isEmpty ?? true)
                const _EmptyText('No reviews yet.')
              else
                ...controller.reviews.value!.reviews.map(
                  (ProductReview review) => Padding(
                    padding: EdgeInsets.only(
                      bottom: ResponsiveUtility.height(10),
                    ),
                    child: _ReviewTile(review: review),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});

  final ProductReview review;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: ResponsiveUtility.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFEFEF),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(10)),
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
                    color: const Color(0xFF313846),
                    fontSize: ResponsiveUtility.fontSize(12),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Icon(
                Icons.star,
                color: const Color(0xFFD7A10B),
                size: ResponsiveUtility.radius(14),
              ),
              SizedBox(width: ResponsiveUtility.width(4)),
              Text(
                review.rating.toStringAsFixed(1),
                style: TextStyle(
                  color: const Color(0xFF2D3440),
                  fontSize: ResponsiveUtility.fontSize(12),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(5)),
          Text(
            _monthYear(review.createdAt),
            style: TextStyle(
              color: const Color(0xFF7A818C),
              fontSize: ResponsiveUtility.fontSize(10),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          Text(
            review.comment.isEmpty ? 'No comment provided.' : review.comment,
            style: TextStyle(
              color: const Color(0xFF697484),
              fontSize: ResponsiveUtility.fontSize(12),
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }

  String _monthYear(DateTime? date) {
    if (date == null) return '';
    const List<String> months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[date.month - 1]} ${date.year}';
  }
}

class _RecommendedProducts extends StatelessWidget {
  const _RecommendedProducts({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.recommendedProducts.isEmpty) {
        return const _EmptyText('No recommended products yet.');
      }
      return GridView.builder(
        itemCount: controller.recommendedProducts.length,
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: ResponsiveUtility.width(4),
          mainAxisSpacing: ResponsiveUtility.height(2),
          childAspectRatio: 0.38,
        ),
        itemBuilder: (BuildContext context, int index) {
          return CustomerProductCard(
            product: controller.recommendedProducts[index],
            isFavorite:
                Get.isRegistered<CustomerWishlistController>() &&
                Get.find<CustomerWishlistController>().isWishlisted(
                  controller.recommendedProducts[index].id,
                ),
            onFavoriteTap: Get.isRegistered<CustomerWishlistController>()
                ? () => Get.find<CustomerWishlistController>().toggleWishlist(
                    controller.recommendedProducts[index],
                  )
                : null,
          );
        },
      );
    });
  }
}

class _BottomActions extends StatelessWidget {
  const _BottomActions({required this.controller});

  final ProductDetailController controller;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: ResponsiveUtility.only(
          left: 20,
          right: 26,
          top: 20,
          bottom: 26,
        ),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.white.withValues(alpha: 0.5),
              Colors.white.withValues(alpha: 0.8),
              Colors.white,
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: AppColors.black.withValues(alpha: 0.10),
              blurRadius: 18,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: SizedBox(
                height: ResponsiveUtility.height(46),
                child: OutlinedButton(
                  onPressed: () => _addToCart(controller),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFA5A5A5),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xFFA5A5A5)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        ResponsiveUtility.radius(12),
                      ),
                    ),
                  ),
                  child: Text(
                    'Add to Cart',
                    style: TextStyle(
                      fontSize: ResponsiveUtility.fontSize(16),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(width: ResponsiveUtility.width(12)),
            Expanded(
              child: SizedBox(
                height: ResponsiveUtility.height(46),
                child: ElevatedButton(
                  onPressed: () => _buyNow(controller),
                  style: ElevatedButton.styleFrom(
                    elevation: 0,
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        ResponsiveUtility.radius(12),
                      ),
                    ),
                  ),
                  child: Text(
                    'Rent it now',
                    style: TextStyle(
                      fontSize: ResponsiveUtility.fontSize(16),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void _addToCart(ProductDetailController controller) {
  final CustomerCartItem? item = _cartItemFromDetail(controller);
  if (item == null) return;
  final CustomerCartController cartController =
      Get.isRegistered<CustomerCartController>()
      ? Get.find<CustomerCartController>()
      : Get.put(CustomerCartController());
  cartController.addProduct(item);
}

void _buyNow(ProductDetailController controller) {
  final CustomerCartItem? item = _cartItemFromDetail(controller);
  if (item == null) return;
  final CustomerCartController cartController =
      Get.isRegistered<CustomerCartController>()
      ? Get.find<CustomerCartController>()
      : Get.put(CustomerCartController());
  cartController.buyNow(item);
}

CustomerCartItem? _cartItemFromDetail(ProductDetailController controller) {
  final ProductDetail? product = controller.product.value;
  if (product == null || product.id.isEmpty) {
    Get.snackbar(
      'Product Not Ready',
      'Please wait while product details are loading.',
      snackPosition: SnackPosition.BOTTOM,
    );
    return null;
  }

  final DateTime now = DateTime.now();
  final DateTime startDate =
      controller.bookingStartDate.value ??
      DateTime(now.year, now.month, now.day);
  final DateTime endDate =
      controller.bookingEndDate.value ??
      startDate.add(Duration(days: controller.selectedPeriodDays - 1));
  final CustomerCartController cartController =
      Get.isRegistered<CustomerCartController>()
      ? Get.find<CustomerCartController>()
      : Get.put(CustomerCartController());

  return cartController.itemFromProductDetail(
    product: product,
    variant: controller.selectedVariant,
    rentalDays: controller.selectedPeriodDays,
    startDate: startDate,
    endDate: endDate,
  );
}

class _ExpandableHeader extends StatelessWidget {
  const _ExpandableHeader({
    required this.title,
    required this.isExpanded,
    required this.onTap,
  });

  final String title;
  final bool isExpanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                color: AppColors.primary,
                fontSize: ResponsiveUtility.fontSize(14),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Icon(
            isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
            color: AppColors.primary,
            size: ResponsiveUtility.radius(24),
          ),
        ],
      ),
    );
  }
}

class _CardShell extends StatelessWidget {
  const _CardShell({
    required this.child,
    required this.padding,
    this.color = AppColors.white,
  });

  final Widget child;
  final EdgeInsets padding;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
        border: Border.all(color: const Color(0xFFE8E8E8)),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class _RoundOverlayButton extends StatelessWidget {
  const _RoundOverlayButton({
    required this.icon,
    required this.onTap,
    this.iconColor = AppColors.white,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: ResponsiveUtility.radius(44),
        height: ResponsiveUtility.radius(44),
        decoration: BoxDecoration(
          color: AppColors.black.withValues(alpha: 0.25),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: iconColor, size: ResponsiveUtility.radius(25)),
      ),
    );
  }
}

class _DetailImage extends StatelessWidget {
  const _DetailImage({
    required this.image,
    required this.fit,
    this.alignment = Alignment.center,
    this.width,
    this.height,
  });

  final String image;
  final BoxFit fit;
  final Alignment alignment;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final bool isNetwork =
        image.startsWith('http://') || image.startsWith('https://');
    if (isNetwork) {
      return Image.network(
        image,
        fit: fit,
        alignment: alignment,
        width: width,
        height: height,
        errorBuilder: (_, _, _) => const ColoredBox(
          color: Color(0xFFF1E8EA),
          child: Center(child: Icon(Icons.image_not_supported_outlined)),
        ),
      );
    }
    return Image.asset(
      image,
      fit: fit,
      alignment: alignment,
      width: width,
      height: height,
    );
  }
}

class _EmptyText extends StatelessWidget {
  const _EmptyText(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: ResponsiveUtility.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F1F1),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(10)),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: const Color(0xFF697484),
          fontSize: ResponsiveUtility.fontSize(12),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ErrorBlock extends StatelessWidget {
  const _ErrorBlock({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _CardShell(
      padding: ResponsiveUtility.all(14),
      color: const Color(0xFFFFF4F4),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: AppColors.primary,
                fontSize: ResponsiveUtility.fontSize(12),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

void _showTrialDialog(
  BuildContext context,
  ProductDetailController controller,
) {
  final DateTime today = DateTime.now();
  final DateTime todayDate = DateTime(today.year, today.month, today.day);
  final DateTime tomorrow = todayDate.add(const Duration(days: 1));

  Get.dialog<void>(
    AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(16)),
      ),
      title: Row(
        children: <Widget>[
          Container(
            width: ResponsiveUtility.radius(38),
            height: ResponsiveUtility.radius(38),
            decoration: const BoxDecoration(
              color: Color(0xFFFFEEF3),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.checkroom_outlined,
              color: AppColors.primary,
              size: ResponsiveUtility.radius(21),
            ),
          ),
          SizedBox(width: ResponsiveUtility.width(10)),
          const Expanded(child: Text('Book Trial Request')),
        ],
      ),
      content: Obx(
        () => Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              'Select a preferred day. The vendor will review your request and confirm whether the outfit is available for trial.',
              style: TextStyle(
                color: const Color(0xFF687282),
                fontSize: ResponsiveUtility.fontSize(12),
                height: 1.25,
              ),
            ),
            SizedBox(height: ResponsiveUtility.height(14)),
            _TrialDateButton(
              label: 'Today',
              date: todayDate,
              isLoading: controller.isTrialSubmitting.value,
              onTap: () => controller.submitTrialRequest(todayDate),
            ),
            SizedBox(height: ResponsiveUtility.height(10)),
            _TrialDateButton(
              label: 'Tomorrow',
              date: tomorrow,
              isLoading: controller.isTrialSubmitting.value,
              onTap: () => controller.submitTrialRequest(tomorrow),
            ),
          ],
        ),
      ),
    ),
  );
}

class _TrialDateButton extends StatelessWidget {
  const _TrialDateButton({
    required this.label,
    required this.date,
    required this.isLoading,
    required this.onTap,
  });

  final String label;
  final DateTime date;
  final bool isLoading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final String dateLabel =
        '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: Container(
        width: double.infinity,
        padding: ResponsiveUtility.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
          border: Border.all(color: const Color(0xFFE6D7D9)),
        ),
        child: Row(
          children: <Widget>[
            Icon(
              Icons.calendar_today_outlined,
              color: AppColors.primary,
              size: ResponsiveUtility.radius(18),
            ),
            SizedBox(width: ResponsiveUtility.width(10)),
            Expanded(
              child: Text(
                '$label  $dateLabel',
                style: TextStyle(
                  color: const Color(0xFF2D3440),
                  fontSize: ResponsiveUtility.fontSize(13),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (isLoading)
              SizedBox(
                width: ResponsiveUtility.radius(16),
                height: ResponsiveUtility.radius(16),
                child: const CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              )
            else
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.primary,
                size: ResponsiveUtility.radius(22),
              ),
          ],
        ),
      ),
    );
  }
}

void _showFeatureDialog({required String title, required String description}) {
  Get.dialog<void>(
    AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(16)),
      ),
      title: Text(title),
      content: Text(
        description,
        style: TextStyle(
          color: const Color(0xFF687282),
          fontSize: ResponsiveUtility.fontSize(13),
          height: 1.35,
        ),
      ),
      actions: <Widget>[
        TextButton(onPressed: Get.back, child: const Text('Got it')),
      ],
    ),
  );
}

void _showBookingCalendar(
  BuildContext context,
  ProductDetailController controller,
) {
  Get.dialog<void>(
    Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(14)),
      ),
      child: Padding(
        padding: ResponsiveUtility.all(16),
        child: Obx(() {
          final DateTime month = controller.visibleMonth.value;
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  IconButton(
                    onPressed: () => controller.changeVisibleMonth(-1),
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Expanded(
                    child: Text(
                      _monthTitle(month),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => controller.changeVisibleMonth(1),
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
              if (controller.isCalendarLoading.value)
                const LinearProgressIndicator(color: AppColors.primary),
              SizedBox(height: ResponsiveUtility.height(8)),
              Row(
                children: const <Widget>[
                  _Weekday('S'),
                  _Weekday('M'),
                  _Weekday('T'),
                  _Weekday('W'),
                  _Weekday('T'),
                  _Weekday('F'),
                  _Weekday('S'),
                ],
              ),
              SizedBox(height: ResponsiveUtility.height(8)),
              _CalendarGrid(controller: controller, month: month),
              SizedBox(height: ResponsiveUtility.height(10)),
              Row(
                children: <Widget>[
                  _LegendDot(color: AppColors.primary, label: 'Selected'),
                  SizedBox(width: ResponsiveUtility.width(12)),
                  const _LegendDot(color: Color(0xFFE8E8E8), label: 'Booked X'),
                ],
              ),
            ],
          );
        }),
      ),
    ),
  );
}

class _CalendarGrid extends StatelessWidget {
  const _CalendarGrid({required this.controller, required this.month});

  final ProductDetailController controller;
  final DateTime month;

  @override
  Widget build(BuildContext context) {
    final DateTime firstDay = DateTime(month.year, month.month);
    final int leading = firstDay.weekday % 7;
    final int daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final int cells = leading + daysInMonth;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: cells,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
      ),
      itemBuilder: (BuildContext context, int index) {
        if (index < leading) return const SizedBox.shrink();
        final int day = index - leading + 1;
        final DateTime date = DateTime(month.year, month.month, day);
        final bool blocked =
            controller.isUnavailable(date) ||
            !controller.isWindowAvailableForStart(date);
        final bool selected = controller.isSelectedWindowDate(date);
        final DateTime now = DateTime.now();
        final bool isPast = date.isBefore(
          DateTime(now.year, now.month, now.day),
        );

        return GestureDetector(
          onTap: blocked || isPast
              ? null
              : () {
                  controller.selectBookingStart(date);
                  Get.back<void>();
                },
          child: Container(
            margin: ResponsiveUtility.all(3),
            decoration: BoxDecoration(
              color: selected ? AppColors.primary : const Color(0xFFF6F6F6),
              borderRadius: BorderRadius.circular(ResponsiveUtility.radius(8)),
              border: Border.all(
                color: blocked ? const Color(0xFFD9B8BF) : Colors.transparent,
              ),
            ),
            child: Center(
              child: Text(
                blocked ? 'X' : '$day',
                style: TextStyle(
                  color: selected
                      ? AppColors.white
                      : blocked || isPast
                      ? const Color(0xFFB5B5B5)
                      : const Color(0xFF303846),
                  fontSize: ResponsiveUtility.fontSize(12),
                  fontWeight: blocked || selected
                      ? FontWeight.w800
                      : FontWeight.w600,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Weekday extends StatelessWidget {
  const _Weekday(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: const Color(0xFF697484),
          fontSize: ResponsiveUtility.fontSize(11),
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: ResponsiveUtility.radius(12),
          height: ResponsiveUtility.radius(12),
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        SizedBox(width: ResponsiveUtility.width(5)),
        Text(
          label,
          style: TextStyle(
            color: const Color(0xFF697484),
            fontSize: ResponsiveUtility.fontSize(11),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

String _monthTitle(DateTime date) {
  const List<String> months = <String>[
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return '${months[date.month - 1]} ${date.year}';
}
