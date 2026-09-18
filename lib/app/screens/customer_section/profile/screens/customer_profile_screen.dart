import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_profile.dart';
import 'package:onesoff_customer/app/global_controllers.dart/app_session_controllers.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/getx/customer_profile_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';
import 'package:onesoff_customer/app/utils/device_utility/helperFunctions.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class CustomerProfileScreen extends StatelessWidget {
  const CustomerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bool isDark = HelperFunctions.isDarkMode(context);
    final CustomerProfileController controller =
        Get.isRegistered<CustomerProfileController>()
        ? Get.find<CustomerProfileController>()
        : Get.put(CustomerProfileController());

    return Scaffold(
      backgroundColor: isDark
          ? AppColors.scaffoldBackgroundColorDark
          : AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            const _ProfileHeader(),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.primary,
                onRefresh: controller.fetchProfile,
                child: Obx(
                  () => ListView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: ResponsiveUtility.only(
                      left: 10,
                      right: 10,
                      top: 10,
                      bottom: 20,
                    ),
                    children: <Widget>[
                      _UserSummaryCard(controller: controller),
                      if (controller.errorMessage.value != null)
                        _ProfileErrorCard(
                          message: controller.errorMessage.value!,
                          onRetry: controller.fetchProfile,
                        ),
                      SizedBox(height: ResponsiveUtility.height(20)),
                      const _SettingsCard(),
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

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader();

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
                      "Onesoff's Store - User Profile",
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'manage your personal details & settings.',
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

class _UserSummaryCard extends StatelessWidget {
  const _UserSummaryCard({required this.controller});

  final CustomerProfileController controller;

  @override
  Widget build(BuildContext context) {
    final CustomerProfile? profile = controller.profile.value;
    final bool loading = controller.isLoading.value && profile == null;

    return Container(
      padding: ResponsiveUtility.only(left: 10, right: 10, top: 10, bottom: 20),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(10)),
        border: Border.all(color: const Color(0xFFC5A5AD), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: ResponsiveUtility.radius((38)),
                height: ResponsiveUtility.radius(38),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary, width: 1.0),
                ),
                child: Center(
                  child: Text(
                    loading ? '..' : (profile?.initials ?? 'CU'),
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: ResponsiveUtility.fontSize(16),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      loading
                          ? 'Loading profile...'
                          : profile?.displayName ?? 'Customer',
                      style: TextStyle(
                        color: AppColors.black,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      loading
                          ? 'Please wait'
                          : profile?.displayPhone ?? 'Phone number not added',
                      style: TextStyle(
                        color: const Color(0xFF666666),
                        fontSize: ResponsiveUtility.fontSize(12),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          _SummaryLine(
            icon: Icons.location_on_outlined,
            label: loading
                ? 'Loading delivery location...'
                : profile?.deliveryLocation ?? 'Delivery location not added',
          ),
          SizedBox(height: ResponsiveUtility.height(10)),
          _SummaryLine(
            icon: Icons.check_circle_outline,
            label: loading
                ? 'Loading membership...'
                : profile?.memberSince ?? 'Active Member',
          ),
        ],
      ),
    );
  }
}

class _ProfileErrorCard extends StatelessWidget {
  const _ProfileErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: ResponsiveUtility.only(top: 12),
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
                  fontWeight: FontWeight.w500,
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

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Icon(
          icon,
          color: AppColors.primary,
          size: ResponsiveUtility.radius(18),
        ),
        SizedBox(width: ResponsiveUtility.width(10)),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: const Color(0xFF626A7A),
              fontSize: ResponsiveUtility.fontSize(12),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(10)),
        border: Border.all(color: const Color(0xFFC5A5AD), width: 1.4),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          Container(
            width: double.infinity,
            padding: ResponsiveUtility.only(
              left: 10,
              top: 10,
              bottom: 10,
              right: 10,
            ),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFC5A5AD))),
            ),
            child: Text(
              'General Settings',
              style: TextStyle(
                color: AppColors.black,
                fontSize: ResponsiveUtility.fontSize(16),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          _SettingsRow(
            title: 'Personal & Delivery Information',
            subtitle: 'Update name, email & other information.',
            icon: Icons.person_rounded,
            onTap: () => Get.toNamed(AppRoutes.personalDeliveryInformation),
          ),
          const _SettingsRow(
            title: 'Refund Details',
            subtitle: 'Get Refund & Security Deposits Details.',
            icon: Icons.receipt,
          ),
          _SettingsRow(
            title: 'Platform Agreements',
            subtitle: 'Agreements & Policies.',
            icon: Icons.link_rounded,
            onTap: () => Get.toNamed(AppRoutes.platformAgreements),
          ),
          const _SettingsRow(
            title: 'Help & Support',
            subtitle: 'Raise Tickets for inquiries & customer support.',
            icon: Icons.help_center,
          ),
          _SettingsRow(
            title: 'Logout',
            subtitle: 'Logout from this account.',
            icon: Icons.logout,
            bottomPadding: 24,
            onTap: () => _showLogoutDialog(context),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    Get.dialog<void>(
      AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: <Widget>[
          TextButton(onPressed: Get.back, child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Get.back<void>();
              await Get.find<AppSessionController>().logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.white,
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.onTap,
    this.bottomPadding = 8,
  });

  final String title;
  final IconData icon;
  final String subtitle;
  final VoidCallback? onTap;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: ResponsiveUtility.only(
          left: 10,
          right: 10,
          top: 10,
          bottom: bottomPadding,
        ),
        child: Row(
          children: <Widget>[
            Icon(
              icon,
              color: AppColors.primary,
              size: ResponsiveUtility.radius(18),
            ),
            SizedBox(width: ResponsiveUtility.width(10)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: ResponsiveUtility.fontSize(14),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: ResponsiveUtility.height(2)),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: const Color(0xFF777777),
                      fontSize: ResponsiveUtility.fontSize(12),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: const Color(0xFF999999),
              size: ResponsiveUtility.radius(22),
            ),
          ],
        ),
      ),
    );
  }
}
