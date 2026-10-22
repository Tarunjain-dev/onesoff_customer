import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_cart.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_cart_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerOrdersScreen extends StatelessWidget {
  const CustomerOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool isDark = HelperFunctions.isDarkMode(context);
    final CustomerCartController controller =
        Get.isRegistered<CustomerCartController>()
        ? Get.find<CustomerCartController>()
        : Get.put(CustomerCartController());

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.scaffoldBackgroundColorDark
          : AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            _CartHeader(controller: controller),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value &&
                    !controller.isCheckoutMode.value &&
                    controller.cartItems.isEmpty) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (controller.errorMessage.value != null &&
                    !controller.isCheckoutMode.value &&
                    controller.cartItems.isEmpty) {
                  return _CartState(
                    icon: Icons.error_outline,
                    title: 'Unable to load cart',
                    subtitle: controller.errorMessage.value!,
                    actionLabel: 'Retry',
                    onAction: controller.fetchCart,
                  );
                }

                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: controller.fetchCart,
                  child: ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: ResponsiveUtility.only(
                      left: 18,
                      right: 18,
                      top: 18,
                      bottom: 112,
                    ),
                    children: <Widget>[
                      if (controller.isEmptyCart)
                        _EmptyCartCard(controller: controller)
                      else
                        ...controller.visibleItems.map(
                          (CustomerCartItem item) => Padding(
                            padding: EdgeInsets.only(
                              bottom: ResponsiveUtility.height(12),
                            ),
                            child: _CartItemCard(
                              item: item,
                              onRemove: () => controller.removeItem(item),
                            ),
                          ),
                        ),
                      SizedBox(height: ResponsiveUtility.height(20)),
                      Text(
                        'Your Cart Total',
                        style: TextStyle(
                          color: const Color(0xFF3F4146),
                          fontSize: ResponsiveUtility.fontSize(24),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: ResponsiveUtility.height(16)),
                      const _FulfilmentCard(),
                      if (controller.shouldShowWelcomeCoupon) ...<Widget>[
                        SizedBox(height: ResponsiveUtility.height(18)),
                        _CouponBlock(controller: controller),
                      ],
                      SizedBox(height: ResponsiveUtility.height(18)),
                      _SummaryBlock(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(26)),
                      _CheckoutButton(controller: controller),
                      SizedBox(height: ResponsiveUtility.height(46)),
                      const _CartNote(),
                    ],
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

class _CartHeader extends StatelessWidget {
  const _CartHeader({required this.controller});

  final CustomerCartController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(
      () => Container(
        color: AppColors.primary,
        padding: ResponsiveUtility.only(
          left: 18,
          right: 18,
          top: 70,
          bottom: 20,
        ),
        child: Row(
          children: <Widget>[
            Image.asset(
              AppImages.appLogo,
              height: ResponsiveUtility.height(32),
              width: ResponsiveUtility.width(32),
              fit: BoxFit.contain,
            ),
            SizedBox(width: ResponsiveUtility.width(10)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    controller.isCheckoutMode.value
                        ? "Onesoff's Store - Checkout"
                        : "Onesoff's Store - Shopping Cart",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: ResponsiveUtility.fontSize(17),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    'Review your selected parts before checkout.',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.62),
                      fontSize: ResponsiveUtility.fontSize(15),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'My Orders',
              onPressed: () => Get.toNamed(AppRoutes.customerOrderHistory),
              icon: const Icon(
                Icons.receipt_long_outlined,
                color: AppColors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCartCard extends StatelessWidget {
  const _EmptyCartCard({required this.controller});

  final CustomerCartController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: ResponsiveUtility.symmetric(horizontal: 18),
      padding: ResponsiveUtility.symmetric(horizontal: 18, vertical: 22),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(14)),
        border: Border.all(color: const Color(0xFFE0E0E0)),
      ),
      child: Column(
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Icon(
                Icons.inventory_2_outlined,
                color: const Color(0xFF111111),
                size: ResponsiveUtility.radius(25),
              ),
              SizedBox(width: ResponsiveUtility.width(8)),
              Text(
                '"Your cart is empty"',
                style: TextStyle(
                  color: AppColors.black,
                  fontSize: ResponsiveUtility.fontSize(16),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(18)),
          Text(
            "Discover something you'll love and start shopping.",
            textAlign: TextAlign.center,
            style: TextStyle(
              color: const Color(0xFF3B3B3B),
              fontSize: ResponsiveUtility.fontSize(11),
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(12)),
          SizedBox(
            width: ResponsiveUtility.width(224),
            height: ResponsiveUtility.height(44),
            child: OutlinedButton(
              onPressed: controller.exploreCollection,
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFA7242E),
                side: const BorderSide(color: Color(0xFFA7242E), width: 1.2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    ResponsiveUtility.radius(14),
                  ),
                ),
              ),
              child: Text(
                'Explore Collection ->',
                style: TextStyle(
                  fontSize: ResponsiveUtility.fontSize(15),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CartItemCard extends StatelessWidget {
  const _CartItemCard({required this.item, required this.onRemove});

  final CustomerCartItem item;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: ResponsiveUtility.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(14)),
        border: Border.all(color: const Color(0xFFE0E0E0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(
                  ResponsiveUtility.radius(9),
                ),
                child: _CartImage(
                  image: item.imageUrl,
                  width: ResponsiveUtility.width(92),
                  height: ResponsiveUtility.height(112),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(12)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            item.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: AppColors.black,
                              fontSize: ResponsiveUtility.fontSize(17),
                              fontWeight: FontWeight.w600,
                              height: 1.08,
                            ),
                          ),
                        ),
                        SizedBox(width: ResponsiveUtility.width(8)),
                        _DeleteButton(onTap: onRemove),
                      ],
                    ),
                    SizedBox(height: ResponsiveUtility.height(14)),
                    Text(
                      item.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: const Color(0xFF8A8A8A),
                        fontSize: ResponsiveUtility.fontSize(12),
                        height: 1.2,
                      ),
                    ),
                    SizedBox(height: ResponsiveUtility.height(8)),
                    GestureDetector(
                      onTap: () => Get.toNamed(
                        AppRoutes.productDetail,
                        arguments: <String, dynamic>{'id': item.productId},
                      ),
                      child: Text(
                        'View Product Detail',
                        style: TextStyle(
                          color: const Color(0xFF6791FF),
                          fontSize: ResponsiveUtility.fontSize(12),
                          decoration: TextDecoration.underline,
                          decorationColor: const Color(0xFF6791FF),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(12)),
          _CartMetaGrid(item: item),
          SizedBox(height: ResponsiveUtility.height(14)),
          _VariantBox(item: item),
          SizedBox(height: ResponsiveUtility.height(12)),
          Text(
            'Note: Please return the outfit on time. Late return charges will apply after the booking end date. Additional rental charges will be calculated on a per-day basis until the outfit is returned.',
            style: TextStyle(
              color: const Color(0xFF8C8C8C),
              fontSize: ResponsiveUtility.fontSize(9.5),
              height: 1.18,
            ),
          ),
        ],
      ),
    );
  }
}

class _CartMetaGrid extends StatelessWidget {
  const _CartMetaGrid({required this.item});

  final CustomerCartItem item;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _MetaLine('Size', item.size),
              _MetaLine('Rental Duration', '${item.rentalDays} Days'),
              _MetaLine('Product Code', item.productId),
              _MetaLine('Return Date', item.returnDate),
            ],
          ),
        ),
        SizedBox(width: ResponsiveUtility.width(8)),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _MetaLine('Shop', item.shopName),
              _MetaLine('Shop Location', item.shopLocation),
              _MetaLine('Alteration', item.alteration),
            ],
          ),
        ),
        SizedBox(width: ResponsiveUtility.width(8)),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _MetaLine('Issue Date', item.issueDate),
              _MetaLine('Gender', item.gender),
              _MetaLine('Color', item.color),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: ResponsiveUtility.height(2)),
      child: Text(
        '$label : $value',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: const Color(0xFF7A7A7A),
          fontSize: ResponsiveUtility.fontSize(10.5),
          height: 1.1,
        ),
      ),
    );
  }
}

class _VariantBox extends StatelessWidget {
  const _VariantBox({required this.item});

  final CustomerCartItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: ResponsiveUtility.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F0F0),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  'Selected Variant',
                  style: TextStyle(
                    color: AppColors.black,
                    fontSize: ResponsiveUtility.fontSize(12),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                'SKU Code : ${item.sku}',
                style: TextStyle(
                  color: const Color(0xFF6F6F6F),
                  fontSize: ResponsiveUtility.fontSize(9),
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          _VariantLine('Gender', item.gender),
          SizedBox(height: ResponsiveUtility.height(8)),
          _VariantLine('Color', item.color),
          SizedBox(height: ResponsiveUtility.height(8)),
          _VariantLine('SKU Code', item.sku),
        ],
      ),
    );
  }
}

class _VariantLine extends StatelessWidget {
  const _VariantLine(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label : $value',
      style: TextStyle(
        color: const Color(0xFF707070),
        fontSize: ResponsiveUtility.fontSize(12),
      ),
    );
  }
}

class _DeleteButton extends StatelessWidget {
  const _DeleteButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: ResponsiveUtility.radius(34),
        height: ResponsiveUtility.radius(34),
        decoration: BoxDecoration(
          color: const Color(0xFFF2F2F2),
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(8)),
        ),
        child: Icon(
          Icons.delete_outline,
          color: Colors.red,
          size: ResponsiveUtility.radius(22),
        ),
      ),
    );
  }
}

class _FulfilmentCard extends StatelessWidget {
  const _FulfilmentCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: ResponsiveUtility.symmetric(horizontal: 16, vertical: 18),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F7F7),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(14)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Fulfillment Mode',
            style: TextStyle(
              color: const Color(0xFF3F4146),
              fontSize: ResponsiveUtility.fontSize(15),
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(12)),
          Row(
            children: <Widget>[
              Container(
                width: ResponsiveUtility.radius(22),
                height: ResponsiveUtility.radius(22),
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Container(
                    width: ResponsiveUtility.radius(7),
                    height: ResponsiveUtility.radius(7),
                    decoration: const BoxDecoration(
                      color: AppColors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              Text(
                'Self Pickup',
                style: TextStyle(
                  color: const Color(0xFF424242),
                  fontSize: ResponsiveUtility.fontSize(13),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CouponBlock extends StatelessWidget {
  const _CouponBlock({required this.controller});

  final CustomerCartController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          'Welcome Coupon',
          style: TextStyle(
            color: const Color(0xFF3F4146),
            fontSize: ResponsiveUtility.fontSize(17),
            fontWeight: FontWeight.w500,
          ),
        ),
        SizedBox(height: ResponsiveUtility.height(7)),
        Text(
          'New customers can use this once on rental charges. Deposits and delivery charges remain separate.',
          style: TextStyle(
            color: const Color(0xFF8A8A8A),
            fontSize: ResponsiveUtility.fontSize(12),
            height: 1.18,
          ),
        ),
        SizedBox(height: ResponsiveUtility.height(18)),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: controller.couponController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: const Color(0xFFD8D8D8),
                  hintText:
                      controller.welcomeCoupon.value?.code ?? 'Coupons Code',
                  hintStyle: TextStyle(
                    color: const Color(0xFF8A8A8A),
                    fontSize: ResponsiveUtility.fontSize(15),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(
                      ResponsiveUtility.radius(12),
                    ),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: ResponsiveUtility.symmetric(horizontal: 16),
                ),
                style: TextStyle(
                  color: const Color(0xFF424242),
                  fontSize: ResponsiveUtility.fontSize(15),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            SizedBox(width: ResponsiveUtility.width(12)),
            SizedBox(
              width: ResponsiveUtility.width(86),
              height: ResponsiveUtility.height(48),
              child: Obx(
                () => ElevatedButton(
                  onPressed: controller.isCouponLoading.value
                      ? null
                      : controller.applyCoupon,
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
                  child: controller.isCouponLoading.value
                      ? SizedBox(
                          width: ResponsiveUtility.radius(16),
                          height: ResponsiveUtility.radius(16),
                          child: const CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.white,
                          ),
                        )
                      : Text(
                          'Apply',
                          style: TextStyle(
                            fontSize: ResponsiveUtility.fontSize(15),
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
        if (controller.welcomeCoupon.value != null) ...<Widget>[
          SizedBox(height: ResponsiveUtility.height(8)),
          Text(
            controller.welcomeCoupon.value!.title,
            style: TextStyle(
              color: AppColors.primary,
              fontSize: ResponsiveUtility.fontSize(12),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    );
  }
}

class _SummaryBlock extends StatelessWidget {
  const _SummaryBlock({required this.controller});

  final CustomerCartController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(
      () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Summary',
            style: TextStyle(
              color: const Color(0xFF3F4146),
              fontSize: ResponsiveUtility.fontSize(17),
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          _SummaryLine(
            label: 'Total Rental Charges :',
            value: 'Rs. ${controller.rentalTotal}',
          ),
          _SummaryLine(
            label: 'Total Security Deposit (Refundable) :',
            value: 'Rs. ${controller.depositTotal}',
          ),
          const _SummaryLine(
            label: 'Shipping Charges',
            value: '- Self Pickup -',
          ),
          _SummaryLine(
            label: 'Total Payable Amount :',
            value: 'Rs. ${controller.payableTotal}',
          ),
          if (controller.discountTotal > 0)
            _SummaryLine(
              label: 'Coupon Discount :',
              value: '- Rs. ${controller.discountTotal}',
            ),
          _SummaryLine(
            label: 'Refundable Amount :',
            value: 'Rs. ${controller.depositTotal}',
          ),
        ],
      ),
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: ResponsiveUtility.height(7)),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: const Color(0xFF858585),
                fontSize: ResponsiveUtility.fontSize(12.5),
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: const Color(0xFF858585),
              fontSize: ResponsiveUtility.fontSize(12.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _CheckoutButton extends StatelessWidget {
  const _CheckoutButton({required this.controller});

  final CustomerCartController controller;

  @override
  Widget build(BuildContext context) {
    return Obx(
      () => SizedBox(
        width: double.infinity,
        height: ResponsiveUtility.height(54),
        child: ElevatedButton(
          onPressed:
              controller.visibleItems.isEmpty ||
                  controller.isCheckoutLoading.value
              ? null
              : controller.checkoutAndPay,
          style: ElevatedButton.styleFrom(
            elevation: 0,
            disabledBackgroundColor: const Color(0xFF927A83),
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
            ),
          ),
          child: controller.isCheckoutLoading.value
              ? SizedBox(
                  width: ResponsiveUtility.radius(18),
                  height: ResponsiveUtility.radius(18),
                  child: const CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.white,
                  ),
                )
              : Text(
                  'Check Out & Pay Rs. ${controller.grandTotal}',
                  style: TextStyle(
                    fontSize: ResponsiveUtility.fontSize(15),
                    fontWeight: FontWeight.w500,
                  ),
                ),
        ),
      ),
    );
  }
}

class _CartState extends StatelessWidget {
  const _CartState({
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

class _CartNote extends StatelessWidget {
  const _CartNote();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Note:\n  - In case of outfit booking: rent is for outfit only, accessories are not included.\n  - In case of accessories booking: rent is for accessories only, outfit is not included.',
      style: TextStyle(
        color: const Color(0xFF8A8A8A),
        fontSize: ResponsiveUtility.fontSize(11.5),
        height: 1.2,
      ),
    );
  }
}

class _CartImage extends StatelessWidget {
  const _CartImage({
    required this.image,
    required this.width,
    required this.height,
  });

  final String image;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final bool isNetwork =
        image.startsWith('http://') || image.startsWith('https://');
    if (isNetwork) {
      return Image.network(
        image,
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _FallbackImage(width: width, height: height),
      );
    }
    return Image.asset(image, width: width, height: height, fit: BoxFit.cover);
  }
}

class _FallbackImage extends StatelessWidget {
  const _FallbackImage({required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      AppImages.womensWear_1,
      width: width,
      height: height,
      fit: BoxFit.cover,
    );
  }
}
