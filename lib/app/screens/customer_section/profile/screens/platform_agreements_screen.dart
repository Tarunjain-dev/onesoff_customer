import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';
import 'package:onesoff_customer/app/utils/device_utility/responsive_utility.dart';

class PlatformAgreementsScreen extends StatelessWidget {
  const PlatformAgreementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: <Widget>[
            const _AgreementsHeader(),
            Expanded(
              child: ListView(
                physics: const BouncingScrollPhysics(),
                padding: ResponsiveUtility.only(
                  left: 20,
                  right: 20,
                  top: 20,
                  bottom: 20,
                ),
                children: const <Widget>[
                  _AgreementSettingsCard(),
                  SizedBox(height: 22),
                  _NoticeCard(
                    title: 'Please pay attention!',
                    body:
                        'Review the legal agreements, policies, and terms governing your use of Onesoff. We believe in transparency and trust in our luxury rental experience.',
                  ),
                  SizedBox(height: 22),
                  _NoticeCard(
                    title: 'Any questions regarding policies?',
                    body:
                        'If you have questions regarding these agreements, please contact our support team.',
                    buttonLabel: 'Contact Support',
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

class _AgreementsHeader extends StatelessWidget {
  const _AgreementsHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primary,
      padding: ResponsiveUtility.only(left: 18, right: 18, top: 70, bottom: 20),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              GestureDetector(
                onTap: Get.back,
                child: Icon(
                  Icons.arrow_back,
                  color: AppColors.white,
                  size: ResponsiveUtility.radius(18),
                ),
              ),
              SizedBox(width: ResponsiveUtility.width(10)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Platform Agreements',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: ResponsiveUtility.fontSize(16),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Update name, email & other information.',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
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

class _AgreementSettingsCard extends StatelessWidget {
  const _AgreementSettingsCard();

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
            padding: ResponsiveUtility.only(left: 10, top: 10, bottom: 10),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFC5A5AD))),
            ),
            child: Text(
              'General Settings',
              style: TextStyle(
                color: AppColors.black,
                fontSize: ResponsiveUtility.fontSize(14),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const _AgreementRow(
            title: 'Terms of service',
            subtitle: 'Rules and guidelines for using the platform.',
            icon: Icons.copy,
          ),
          const _AgreementRow(
            title: 'Rental Agreement',
            subtitle: 'Terms specific to renting and returning garments.',
            icon: Icons.recent_actors,
          ),
          const _AgreementRow(
            title: 'Privacy policy',
            subtitle: 'How we handle and protect your personal data.',
            icon: Icons.privacy_tip,
          ),
          const _AgreementRow(
            title: 'Cancellation policy',
            subtitle: 'Guidelines for modifying or cancelling a reservation.',
            icon: Icons.cancel,
            bottomPadding: 20,
          ),
        ],
      ),
    );
  }
}

class _AgreementRow extends StatelessWidget {
  const _AgreementRow({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.bottomPadding = 10,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    return Padding(
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
            size: ResponsiveUtility.radius(18),
          ),
        ],
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.title,
    required this.body,
    this.buttonLabel,
  });

  final String title;
  final String body;
  final String? buttonLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: ResponsiveUtility.only(left: 10, right: 10, top: 10, bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(ResponsiveUtility.radius(10)),
        border: Border.all(color: const Color(0xFFC5A5AD), width: 1.4),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(
            Icons.shield_outlined,
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
                  style: TextStyle(
                    color: AppColors.black,
                    fontSize: ResponsiveUtility.fontSize(14),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: ResponsiveUtility.height(8)),
                Text(
                  body,
                  style: TextStyle(
                    color: const Color(0xFF626A7A),
                    fontSize: ResponsiveUtility.fontSize(12),
                    height: 1.38,
                  ),
                ),
                if (buttonLabel != null) ...<Widget>[
                  SizedBox(height: ResponsiveUtility.height(10)),
                  SizedBox(
                    width: ResponsiveUtility.width(316),
                    height: ResponsiveUtility.height(38),
                    child: ElevatedButton(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        elevation: 0,
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            ResponsiveUtility.radius(24),
                          ),
                        ),
                      ),
                      child: Text(
                        buttonLabel!,
                        style: TextStyle(
                          fontSize: ResponsiveUtility.fontSize(14),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
