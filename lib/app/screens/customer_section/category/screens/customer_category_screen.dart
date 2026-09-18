import 'package:flutter/material.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerCategoryScreen extends StatelessWidget {
  const CustomerCategoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool isDark = HelperFunctions.isDarkMode(context);

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.scaffoldBackgroundColorDark
          : AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            _CategoryHeader(isDark: isDark),
            Expanded(
              child: ListView(
                physics: const BouncingScrollPhysics(),
                padding: ResponsiveUtility.only(
                  left: 18,
                  right: 18,
                  top: 16,
                  bottom: 96,
                ),
                children: const <Widget>[
                  _CategorySection(
                    title: "OnesOff's Premium Outfits.",
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.womensWear_2,
                              title: 'Women',
                              subtitle: 'Lehengas,\nSarees, Gowns',
                            ),
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.mensWear_2,
                              title: 'Mens',
                              subtitle: 'Sherwanis,\nKurta Sets',
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 14),
                      _CategoryCard(
                        image: AppImages.jewelry_1,
                        title: 'Accessories',
                        subtitle: 'Jewellery, Bags, Footwear',
                        height: 156,
                      ),
                    ],
                  ),
                  _CategorySection(
                    title: "OnesOff's Womens Collection",
                    children: <Widget>[
                      _CategoryCard(
                        image: AppImages.womensWear_1,
                        title: 'Bridal Lehengas',
                        subtitle: "OnesOff's Premium Bridal wear",
                        height: 340,
                      ),
                      SizedBox(height: 14),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.womensWear_3,
                              title: 'Gowns',
                              subtitle: 'Lehengas,\nSarees, Gowns',
                            ),
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.womensWear_2,
                              title: 'Sarees',
                              subtitle: 'Sherwanis,\nKurta Sets',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  _CategorySection(
                    title: "OnesOff's Mens Collection",
                    children: <Widget>[
                      _CategoryCard(
                        image: AppImages.mensWear_1,
                        title: 'Grooms Sherwani',
                        subtitle: "OnesOff's Premium mens wear",
                        height: 340,
                      ),
                      SizedBox(height: 14),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.mensWear_2,
                              title: 'Kurtha',
                              subtitle: 'Classic &\nContemporary',
                            ),
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.mensWear_3,
                              title: 'Suites',
                              subtitle: 'Sharp, Formal\n& Western',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  _CategorySection(
                    title: "OnesOff's Jewellery Collection",
                    children: <Widget>[
                      _CategoryCard(
                        image: AppImages.jewelry_3,
                        title: 'Grooms Sherwani',
                        subtitle: "OnesOff's Premium mens wear",
                        height: 340,
                      ),
                      SizedBox(height: 14),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.jewelry_1,
                              title: 'Kurtha',
                              subtitle: 'Classic &\nContemporary',
                            ),
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: _CategoryCard(
                              image: AppImages.jewelry_2,
                              title: 'Suites',
                              subtitle: 'Sharp, Formal\n& Western',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryHeader extends StatelessWidget {
  const _CategoryHeader({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: isDark ? const Color(0xFF19050A) : AppColors.primary,
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 50, bottom: 20),
      child: Column(
        children: <Widget>[
          SizedBox(height: ResponsiveUtility.height(22)),
          Row(
            children: <Widget>[
              Image.asset(
                AppImages.appLogo,
                height: ResponsiveUtility.height(30),
                width: ResponsiveUtility.width(30),
                fit: BoxFit.contain,
              ),
              SizedBox(width: ResponsiveUtility.width(8)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      "Onesoff's Store",
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(13),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'What would you like to wear today?',
                      style: TextStyle(
                        color: AppColors.white.withValues(alpha: 0.58),
                        fontSize: ResponsiveUtility.fontSize(12),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(18)),
          Row(
            children: <Widget>[
              Expanded(
                child: Container(
                  height: ResponsiveUtility.height(52),
                  padding: ResponsiveUtility.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: AppColors.white,
                    borderRadius: BorderRadius.circular(
                      ResponsiveUtility.radius(7),
                    ),
                  ),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          'Search lehenga, saree, sherwani...',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: const Color(0xFF8F878A),
                            fontSize: ResponsiveUtility.fontSize(13),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.search,
                        color: const Color(0xFF5A5657),
                        size: ResponsiveUtility.radius(26),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(12)),
              Container(
                width: ResponsiveUtility.radius(52),
                height: ResponsiveUtility.radius(52),
                decoration: BoxDecoration(
                  color: AppColors.white,
                  borderRadius: BorderRadius.circular(
                    ResponsiveUtility.radius(7),
                  ),
                ),
                child: Icon(
                  Icons.filter_alt_outlined,
                  color: AppColors.black,
                  size: ResponsiveUtility.radius(28),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: const Color(0xFF2C292A),
              fontSize: ResponsiveUtility.fontSize(14),
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: ResponsiveUtility.height(8)),
          ...children,
        ],
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.image,
    required this.title,
    required this.subtitle,
    this.height = 176,
  });

  final String image;
  final String title;
  final String subtitle;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: ResponsiveUtility.height(height),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(12)),
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            Image.asset(image, fit: BoxFit.cover),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: <Color>[
                    AppColors.black.withValues(alpha: 0.05),
                    AppColors.black.withValues(alpha: 0.58),
                  ],
                ),
              ),
            ),
            Positioned(
              left: ResponsiveUtility.width(12),
              right: ResponsiveUtility.width(48),
              bottom: ResponsiveUtility.height(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: ResponsiveUtility.fontSize(16),
                      fontWeight: FontWeight.w500,
                      height: 1.02,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.white.withValues(alpha: 0.92),
                      fontSize: ResponsiveUtility.fontSize(14),
                      fontWeight: FontWeight.w500,
                      height: 1.05,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              right: ResponsiveUtility.width(10),
              bottom: ResponsiveUtility.height(16),
              child: Container(
                width: ResponsiveUtility.radius(40),
                height: ResponsiveUtility.radius(40),
                decoration: BoxDecoration(
                  color: AppColors.white.withValues(alpha: 0.28),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.arrow_forward,
                  color: AppColors.white,
                  size: ResponsiveUtility.radius(28),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
