import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/screens/customer_section/dashboard/getx/customer_dashboard_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/getx/customer_profile_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/getx/customer_wishlist_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerDashboardScreen extends StatelessWidget {
  const CustomerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool isDark = HelperFunctions.isDarkMode(context);
    final CustomerDashboardController dashboardController =
        Get.isRegistered<CustomerDashboardController>()
        ? Get.find<CustomerDashboardController>()
        : Get.put(CustomerDashboardController());
    final CustomerProfileController profileController =
        Get.isRegistered<CustomerProfileController>()
        ? Get.find<CustomerProfileController>()
        : Get.put(CustomerProfileController());
    final CustomerWishlistController wishlistController =
        Get.isRegistered<CustomerWishlistController>()
        ? Get.find<CustomerWishlistController>()
        : Get.put(CustomerWishlistController());

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.scaffoldBackgroundColorDark
          : Colors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            _DashboardHeader(
              isDark: isDark,
              controller: dashboardController,
              profileController: profileController,
            ),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: dashboardController.fetchDashboardProducts,
                child: Obx(
                  () => ListView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: ResponsiveUtility.only(
                      left: 18,
                      right: 18,
                      top: 14,
                      bottom: 96,
                    ),
                    children: <Widget>[
                      _FeatureBanner(
                        controller: dashboardController,
                        isDark: isDark,
                      ),
                      if (dashboardController.isLoading.value &&
                          dashboardController.womenProducts.isEmpty &&
                          dashboardController.menProducts.isEmpty &&
                          dashboardController.jewelleryProducts.isEmpty)
                        const _DashboardLoading(),
                      if (dashboardController.errorMessage.value != null)
                        _DashboardError(
                          message: dashboardController.errorMessage.value!,
                          onRetry: dashboardController.fetchDashboardProducts,
                        ),
                      if (dashboardController.womenProducts.isNotEmpty) ...[
                        SizedBox(height: ResponsiveUtility.height(18)),
                        _ProductSection(
                          title: "Onesoff's Womens Outfits.",
                          products: dashboardController.womenProducts,
                          isDark: isDark,
                          wishlistController: wishlistController,
                          onSeeAll: () => dashboardController.openSection(
                            CustomerDashboardController.womenFilter,
                          ),
                        ),
                      ],
                      if (dashboardController.menProducts.isNotEmpty) ...[
                        SizedBox(height: ResponsiveUtility.height(18)),
                        _ProductSection(
                          title: "Onesoff's Mens Outfits.",
                          products: dashboardController.menProducts,
                          isDark: isDark,
                          wishlistController: wishlistController,
                          onSeeAll: () => dashboardController.openSection(
                            CustomerDashboardController.menFilter,
                          ),
                        ),
                      ],
                      SizedBox(height: ResponsiveUtility.height(18)),
                      _WhyChooseBanner(
                        isDark: isDark,
                        onDiscover: dashboardController.openCategories,
                      ),
                      if (dashboardController.jewelleryProducts.isNotEmpty) ...[
                        SizedBox(height: ResponsiveUtility.height(18)),
                        _ProductSection(
                          title: "Onesoff's Jewellery & Accessories.",
                          products: dashboardController.jewelleryProducts,
                          isDark: isDark,
                          wishlistController: wishlistController,
                          onSeeAll: () => dashboardController.openSection(
                            CustomerDashboardController.jewelleryFilter,
                          ),
                        ),
                      ],
                      SizedBox(height: ResponsiveUtility.height(18)),
                      Text(
                        "India's Biggest\nOnline Grocery Store",
                        style: TextStyle(
                          color: const Color(0xFFFFD3E2),
                          fontSize: ResponsiveUtility.fontSize(24),
                          fontWeight: FontWeight.w800,
                          height: 1.06,
                        ),
                      ),
                      const Divider(color: Color(0xffFFF3F3)),
                      Text(
                        'OnesOff',
                        style: TextStyle(
                          color: const Color(0xFFE83260).withValues(alpha: 0.7),
                          fontSize: ResponsiveUtility.fontSize(20),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
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

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader({
    required this.isDark,
    required this.controller,
    required this.profileController,
  });

  final bool isDark;
  final CustomerDashboardController controller;
  final CustomerProfileController profileController;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: isDark ? const Color(0xFF19050A) : AppColors.primary,
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 50, bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(height: ResponsiveUtility.height(18)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Image.asset(
                AppImages.appLogo,
                fit: BoxFit.contain,
                height: ResponsiveUtility.height(30),
                width: ResponsiveUtility.width(30),
              ),
              SizedBox(width: ResponsiveUtility.width(8)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Onesoff',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(10),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Obx(
                      () => Text(
                        'Welcome back, ${profileController.profile.value?.displayName ?? 'Customer'}!',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const _NotificationButton(),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(12)),
          Text(
            'What would you like to wear today?',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.72),
              fontSize: ResponsiveUtility.fontSize(13),
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          Row(
            children: <Widget>[
              Expanded(
                child: Container(
                  height: ResponsiveUtility.height(46),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(
                      ResponsiveUtility.radius(7),
                    ),
                  ),
                  padding: ResponsiveUtility.symmetric(horizontal: 14),
                  child: TextField(
                    controller: controller.searchController,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => controller.submitSearch(),
                    decoration: InputDecoration(
                      hintText: 'Search lehenga, saree, sherwani...',
                      hintStyle: TextStyle(
                        color: const Color(0xFF8F878A),
                        fontSize: ResponsiveUtility.fontSize(12),
                        fontWeight: FontWeight.w500,
                      ),
                      border: InputBorder.none,
                      suffixIcon: GestureDetector(
                        onTap: controller.submitSearch,
                        child: Icon(
                          Icons.search,
                          color: const Color(0xFF5A5657),
                          size: ResponsiveUtility.radius(25),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              const _CityTile(),
            ],
          ),
        ],
      ),
    );
  }
}

class _NotificationButton extends StatelessWidget {
  const _NotificationButton();

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: <Widget>[
        Container(
          width: ResponsiveUtility.radius(42),
          height: ResponsiveUtility.radius(42),
          decoration: BoxDecoration(
            color: Color(0xFFffffff).withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Padding(
            padding: ResponsiveUtility.all(10),
            child: Image.asset(
              AppImages.notifications,
              fit: BoxFit.contain,
              height: ResponsiveUtility.height(10),
              width: ResponsiveUtility.width(10),
            ),
          ),
        ),
        Positioned(
          right: ResponsiveUtility.width(-1),
          top: ResponsiveUtility.height(-3),
          child: Container(
            width: ResponsiveUtility.radius(17),
            height: ResponsiveUtility.radius(17),
            decoration: const BoxDecoration(
              color: AppColors.white,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '6',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: ResponsiveUtility.fontSize(10),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CityTile extends StatelessWidget {
  const _CityTile();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: ResponsiveUtility.width(46),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          ClipRRect(
            borderRadius: BorderRadius.circular(ResponsiveUtility.radius(5)),
            child: Image.asset(
              AppImages.indore,
              width: ResponsiveUtility.width(42),
              height: ResponsiveUtility.height(38),
              fit: BoxFit.cover,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(2)),
          Text(
            'Indore',
            style: TextStyle(
              color: AppColors.white,
              fontSize: ResponsiveUtility.fontSize(8),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureBanner extends StatelessWidget {
  const _FeatureBanner({required this.controller, required this.isDark});

  final CustomerDashboardController controller;
  final bool isDark;

  static const List<_FeaturedService> _services = <_FeaturedService>[
    _FeaturedService(
      image: AppImages.banner1,
      title: 'Wedding collections',
      subtitle: 'Get all the feature Indian wedding collections.',
    ),
    _FeaturedService(
      image: AppImages.womensWear_1,
      title: 'Bridal collections',
      subtitle: 'Premium lehengas, gowns, sarees and bridal styling.',
    ),
    _FeaturedService(
      image: AppImages.mensWear_1,
      title: 'Groom collections',
      subtitle: 'Sherwanis, kurtas and celebration-ready menswear.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _SectionTitle(title: 'Featured Collections', isDark: isDark),
        SizedBox(height: ResponsiveUtility.height(8)),
        SizedBox(
          height: ResponsiveUtility.height(126),
          child: PageView.builder(
            controller: controller.featuredPageController,
            onPageChanged: controller.onFeaturedPageChanged,
            itemCount: _services.length,
            itemBuilder: (BuildContext context, int index) {
              return Padding(
                padding: EdgeInsets.only(right: ResponsiveUtility.width(2)),
                child: _FeaturedServiceCard(service: _services[index]),
              );
            },
          ),
        ),
        SizedBox(height: ResponsiveUtility.height(7)),
        Obx(
          () => Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List<Widget>.generate(_services.length, (int index) {
              final bool isActive = controller.featuredIndex.value == index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: ResponsiveUtility.radius(isActive ? 8 : 5),
                height: ResponsiveUtility.radius(isActive ? 8 : 5),
                margin: EdgeInsets.symmetric(
                  horizontal: ResponsiveUtility.width(3),
                ),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primary : const Color(0xFFC6C2C3),
                  shape: BoxShape.circle,
                ),
              );
            }),
          ),
        ),
      ],
    );
  }
}

class _FeaturedServiceCard extends StatelessWidget {
  const _FeaturedServiceCard({required this.service});

  final _FeaturedService service;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ResponsiveUtility.radius(9)),
      child: Stack(
        children: <Widget>[
          Positioned.fill(child: Image.asset(service.image, fit: BoxFit.cover)),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: <Color>[
                    AppColors.black.withValues(alpha: 0.78),
                    AppColors.black.withValues(alpha: 0.08),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: ResponsiveUtility.width(12),
            bottom: ResponsiveUtility.height(13),
            right: ResponsiveUtility.width(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const _TinyBadge(
                  label: 'Most Booked',
                  icon: Icons.local_fire_department,
                ),
                SizedBox(height: ResponsiveUtility.height(4)),
                Text(
                  service.title,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: ResponsiveUtility.fontSize(15),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  service.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.white,
                    fontSize: ResponsiveUtility.fontSize(9),
                    fontWeight: FontWeight.w500,
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

class _ProductSection extends StatelessWidget {
  const _ProductSection({
    required this.title,
    required this.products,
    required this.isDark,
    required this.wishlistController,
    required this.onSeeAll,
  });

  final String title;
  final List<CustomerProduct> products;
  final bool isDark;
  final CustomerWishlistController wishlistController;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _SectionTitle(title: title, isDark: isDark),
        SizedBox(height: ResponsiveUtility.height(8)),
        GridView.builder(
          itemCount: products.length,
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: ResponsiveUtility.height(8),
            crossAxisSpacing: ResponsiveUtility.width(8),
            childAspectRatio: 0.48,
          ),
          itemBuilder: (BuildContext context, int index) {
            return _ProductCard(
              product: products[index],
              isDark: isDark,
              wishlistController: wishlistController,
            );
          },
        ),
        SizedBox(height: ResponsiveUtility.height(10)),
        _SeeAllProductsButton(onTap: onSeeAll),
      ],
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.isDark,
    required this.wishlistController,
  });

  final CustomerProduct product;
  final bool isDark;
  final CustomerWishlistController wishlistController;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Get.toNamed(AppRoutes.productDetail, arguments: product),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF19050A) : AppColors.white,
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(8)),
          border: Border.all(color: const Color(0xFFE6D7D9)),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: AppColors.black.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              flex: 6,
              child: Stack(
                children: <Widget>[
                  Positioned.fill(
                    child: _ProductImage(image: product.imageUrl),
                  ),
                  Positioned(
                    left: ResponsiveUtility.width(4),
                    top: ResponsiveUtility.height(4),
                    child: const _CircleIcon(
                      color: Color(0xFFFFB13A),
                      icon: Icons.local_fire_department,
                    ),
                  ),
                  Positioned(
                    right: ResponsiveUtility.width(4),
                    top: ResponsiveUtility.height(4),
                    child: Obx(() {
                      final bool isFavorite = wishlistController.isWishlisted(
                        product.id,
                      );
                      return GestureDetector(
                        onTap: () => wishlistController.toggleWishlist(product),
                        behavior: HitTestBehavior.opaque,
                        child: _CircleIcon(
                          color: AppColors.white,
                          icon: isFavorite
                              ? Icons.favorite
                              : Icons.favorite_border,
                          iconColor: isFavorite
                              ? Colors.red
                              : AppColors.primary,
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 5,
              child: Padding(
                padding: ResponsiveUtility.only(
                  left: 7,
                  right: 7,
                  top: 6,
                  bottom: 6,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark
                            ? AppColors.white
                            : const Color(0xFF242124),
                        fontSize: ResponsiveUtility.fontSize(9.2),
                        fontWeight: FontWeight.w800,
                        height: 1.06,
                      ),
                    ),
                    SizedBox(height: ResponsiveUtility.height(3)),
                    Text(
                      product.description,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark
                            ? AppColors.white.withValues(alpha: 0.62)
                            : const Color(0xFF5E5659),
                        fontSize: ResponsiveUtility.fontSize(8),
                        height: 1.12,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'Renting at',
                      style: TextStyle(
                        color: const Color(0xFFFF8F25),
                        fontSize: ResponsiveUtility.fontSize(7.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            product.rentLabel,
                            style: TextStyle(
                              color: isDark
                                  ? AppColors.white
                                  : AppColors.primary,
                              fontSize: ResponsiveUtility.fontSize(8.4),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: ResponsiveUtility.radius(14),
                          color: const Color(0xFF91888B),
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

class _WhyChooseBanner extends StatelessWidget {
  const _WhyChooseBanner({required this.isDark, required this.onDiscover});

  final bool isDark;
  final VoidCallback onDiscover;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(minHeight: ResponsiveUtility.height(132)),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1616) : const Color(0xFFFFD58C),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(7)),
      ),
      padding: ResponsiveUtility.only(left: 13, right: 7, top: 12, bottom: 10),
      child: Row(
        children: <Widget>[
          Expanded(
            flex: 6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  'Why Choose OnesOff?',
                  style: TextStyle(
                    color: const Color(0xFF000000),
                    fontSize: ResponsiveUtility.fontSize(16),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: ResponsiveUtility.height(4)),
                Text(
                  'Experience premium fashion rentals with trusted vendors, hygienic outfits, secure payments, and seamless delivery designed to make your special moments stress-free and stylish.',
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: const Color(0xFF000000),
                    fontSize: ResponsiveUtility.fontSize(10),
                    height: 1.14,
                    fontWeight: FontWeight.normal,
                  ),
                ),
                SizedBox(height: ResponsiveUtility.height(10)),
                SizedBox(
                  width: ResponsiveUtility.width(154),
                  height: ResponsiveUtility.height(33),
                  child: ElevatedButton(
                    onPressed: onDiscover,
                    style: ElevatedButton.styleFrom(
                      elevation: 0,
                      backgroundColor: AppColors.white,
                      foregroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          ResponsiveUtility.radius(4),
                        ),
                      ),
                    ),
                    child: Text(
                      'Discover OnesOff',
                      style: TextStyle(
                        fontSize: ResponsiveUtility.fontSize(11),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 4,
            child: Image.asset(
              AppImages.stichMachine,
              height: ResponsiveUtility.height(126),
              fit: BoxFit.contain,
            ),
          ),
        ],
      ),
    );
  }
}

class _SeeAllProductsButton extends StatelessWidget {
  const _SeeAllProductsButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: ResponsiveUtility.height(50),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF8F6),
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(7)),
          border: Border.all(color: const Color(0xFFE7BFC5)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            SizedBox(
              width: ResponsiveUtility.width(80),
              height: ResponsiveUtility.height(30),
              child: Stack(
                children: <Widget>[
                  _AvatarBubble(image: AppImages.womensWear_1, left: 0),
                  _AvatarBubble(image: AppImages.jewelry_1, left: 18),
                  _AvatarBubble(image: AppImages.womensWear_2, left: 36),
                ],
              ),
            ),
            SizedBox(width: ResponsiveUtility.width(2)),
            Text(
              'See all products',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: ResponsiveUtility.fontSize(14),
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardLoading extends StatelessWidget {
  const _DashboardLoading();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.symmetric(vertical: 24),
      child: const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );
  }
}

class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(top: 14),
      child: Container(
        padding: ResponsiveUtility.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF4F4),
          borderRadius: BorderRadius.circular(ResponsiveUtility.radius(8)),
          border: Border.all(color: const Color(0xFFE8C8C8)),
        ),
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

class _AvatarBubble extends StatelessWidget {
  const _AvatarBubble({required this.image, required this.left});

  final String image;
  final double left;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: ResponsiveUtility.width(left),
      child: Container(
        width: ResponsiveUtility.radius(29),
        height: ResponsiveUtility.radius(29),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          image: DecorationImage(image: AssetImage(image), fit: BoxFit.cover),
          border: Border.all(color: Color(0xffD8C1C5), width: 1),
        ),
        clipBehavior: Clip.antiAlias,
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.isDark});

  final String title;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        color: isDark ? AppColors.white : const Color(0xFF2C292A),
        fontSize: ResponsiveUtility.fontSize(14),
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _TinyBadge extends StatelessWidget {
  const _TinyBadge({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: ResponsiveUtility.symmetric(horizontal: 5, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            icon,
            color: const Color(0xFFFFB13A),
            size: ResponsiveUtility.radius(10),
          ),
          SizedBox(width: ResponsiveUtility.width(2)),
          Text(
            label,
            style: TextStyle(
              color: AppColors.white,
              fontSize: ResponsiveUtility.fontSize(7.5),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleIcon extends StatelessWidget {
  const _CircleIcon({
    required this.color,
    required this.icon,
    this.iconColor = AppColors.white,
  });

  final Color color;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: ResponsiveUtility.radius(18),
      height: ResponsiveUtility.radius(18),
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      child: Icon(icon, color: iconColor, size: ResponsiveUtility.radius(12)),
    );
  }
}

class _FeaturedService {
  const _FeaturedService({
    required this.image,
    required this.title,
    required this.subtitle,
  });

  final String image;
  final String title;
  final String subtitle;
}
