// ignore_for_file: void_checks
import 'package:get/get.dart';
import 'package:onesoff_customer/app/global_controllers.dart/customer_bottom_nav_controller.dart';
import 'package:onesoff_customer/app/screens/auth/login/getx/loigin_controller.dart';
import 'package:onesoff_customer/app/screens/auth/login/screen/login_screen.dart';
import 'package:onesoff_customer/app/screens/auth/otp_verification/getx/otp_controller.dart';
import 'package:onesoff_customer/app/screens/auth/otp_verification/screen/otp_verification_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/customer_bottom_nav_bar.dart';
import 'package:onesoff_customer/app/screens/customer_section/dashboard/getx/customer_product_listing_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/dashboard/screens/customer_product_listing_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_cart_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_order_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/screens/customer_order_detail_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/screens/customer_order_history_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/screens/customer_refund_details_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/product_detail/getx/product_detail_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/product_detail/screen/product_detail_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/getx/customer_profile_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/screens/personal_delivery_information_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/screens/platform_agreements_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/vendor_details/getx/vendor_details_controller.dart';
import 'package:onesoff_customer/app/screens/customer_section/vendor_details/screen/vendor_details_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/getx/customer_wishlist_controller.dart';
import 'package:onesoff_customer/app/screens/onboarding/getx/onboarding_controller.dart';
import 'package:onesoff_customer/app/screens/onboarding/screen/onboarding_screen.dart';
import 'package:onesoff_customer/app/screens/splash/getx/splash_controller.dart';
import 'package:onesoff_customer/app/screens/splash/screen/splash_screen.dart';

abstract class AppRoutes {
  AppRoutes._();

  // -- App Routes
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String login = '/login';
  static const String otpVerification = '/otp-verification';
  static const String customerBottomNavBar = '/customer-dashboard';
  static const String productDetail = '/product-detail';
  static const String vendorDetails = '/vendor-details';
  static const String customerProductListing = '/customer-products';
  static const String personalDeliveryInformation =
      '/personal-delivery-information';
  static const String platformAgreements = '/platform-agreements';
  static const String customerOrderHistory = '/customer-orders';
  static const String customerOrderDetail = '/customer-order-detail';
  static const String customerRefundDetails = '/customer-refund-details';

  // -- App Pages
  static final List<GetPage<dynamic>> pages = <GetPage<dynamic>>[
    GetPage(
      name: AppRoutes.splash,
      page: () => const SplashScreen(),
      binding: BindingsBuilder(() => Get.put(SplashController())),
      transition: Transition.fadeIn,
    ),
    GetPage(
      name: AppRoutes.onboarding,
      page: () => const OnboardingScreen(),
      binding: BindingsBuilder(() => Get.lazyPut(() => OnboardingController())),
      transition: Transition.fadeIn,
    ),
    GetPage(
      name: AppRoutes.login,
      page: () => const LoginScreen(),
      binding: BindingsBuilder(() => Get.lazyPut(() => LoginController())),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.otpVerification,
      page: () => const OtpVerificationScreen(),
      binding: BindingsBuilder(() => Get.lazyPut(() => OtpController())),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.customerBottomNavBar,
      page: () => const CustomerBottomNavBar(),
      binding: BindingsBuilder(() {
        Get.lazyPut(() => CustomerBottomNavController());
        Get.lazyPut(() => CustomerProfileController(), fenix: true);
        Get.lazyPut(() => CustomerWishlistController(), fenix: true);
        Get.lazyPut(() => CustomerCartController(), fenix: true);
      }),
    ),
    GetPage(
      name: AppRoutes.productDetail,
      page: () => const ProductDetailScreen(),
      binding: BindingsBuilder(() {
        if (!Get.isRegistered<CustomerWishlistController>()) {
          Get.lazyPut(() => CustomerWishlistController(), fenix: true);
        }
        Get.lazyPut(() => ProductDetailController());
      }),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.vendorDetails,
      page: () => const VendorDetailsScreen(),
      binding: BindingsBuilder(() {
        if (!Get.isRegistered<CustomerWishlistController>()) {
          Get.lazyPut(() => CustomerWishlistController(), fenix: true);
        }
        Get.lazyPut(() => VendorDetailsController());
      }),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.customerProductListing,
      page: () => const CustomerProductListingScreen(),
      binding: BindingsBuilder(
        () => Get.lazyPut(() => CustomerProductListingController()),
      ),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.personalDeliveryInformation,
      page: () => const PersonalDeliveryInformationScreen(),
      binding: BindingsBuilder(() {
        if (!Get.isRegistered<CustomerProfileController>()) {
          Get.lazyPut(() => CustomerProfileController(), fenix: true);
        }
      }),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.platformAgreements,
      page: () => const PlatformAgreementsScreen(),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.customerOrderHistory,
      page: () => const CustomerOrderHistoryScreen(),
      binding: BindingsBuilder(
        () => Get.lazyPut(() => CustomerOrderController()),
      ),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.customerOrderDetail,
      page: () => const CustomerOrderDetailScreen(),
      transition: Transition.rightToLeft,
    ),
    GetPage(
      name: AppRoutes.customerRefundDetails,
      page: () => const CustomerRefundDetailsScreen(),
      transition: Transition.rightToLeft,
    ),
  ];
}
