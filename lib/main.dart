import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/repositories/auth_repository.dart';
import 'package:onesoff_customer/app/data/repositories/customer_cart_repository.dart';
import 'package:onesoff_customer/app/data/repositories/customer_profile_repository.dart';
import 'package:onesoff_customer/app/data/repositories/customer_product_repository.dart';
import 'package:onesoff_customer/app/data/repositories/customer_wishlist_repository.dart';
import 'package:onesoff_customer/app/data/repositories/vendor_details_repository.dart';
import 'package:onesoff_customer/app/data/storage/app_preferences.dart';
import 'package:onesoff_customer/app/data/storage/auth_storage.dart';
import 'package:onesoff_customer/app/global_controllers.dart/app_session_controllers.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_strings.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final AuthStorage authStorage = Get.put(AuthStorage(), permanent: true);
  final ApiClient apiClient = Get.put(ApiClient(authStorage), permanent: true);
  Get.put(AppPreferences(), permanent: true);
  Get.put(AuthRepository(apiClient, authStorage), permanent: true);
  Get.put(CustomerCartRepository(apiClient), permanent: true);
  Get.put(CustomerProfileRepository(apiClient), permanent: true);
  Get.put(CustomerProductRepository(apiClient), permanent: true);
  Get.put(CustomerWishlistRepository(apiClient), permanent: true);
  Get.put(VendorDetailsRepository(apiClient), permanent: true);
  Get.put(AppSessionController(), permanent: true);
  runApp(const OnesOffApp());
}

class OnesOffApp extends StatelessWidget {
  const OnesOffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      debugShowCheckedModeBanner: false,
      title: AppStrings.appName,
      initialRoute: AppRoutes.splash,
      getPages: AppRoutes.pages,
      themeMode: ThemeMode.light, // toggle this for light & dark mode.
      theme: ThemeData(useMaterial3: true, brightness: Brightness.light),
      darkTheme: ThemeData(useMaterial3: true, brightness: Brightness.dark),
    );
  }
}
