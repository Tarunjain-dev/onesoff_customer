import 'package:get/get.dart';
import 'package:onesoff_customer/app/screens/customer_section/category/screens/customer_category_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/dashboard/screens/customer_dashboard_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/screens/customer_orders_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/screens/customer_profile_screen.dart';
import 'package:onesoff_customer/app/screens/customer_section/wishlist/screens/customer_wishlist_screen.dart';

class CustomerBottomNavController extends GetxController {
  var index = 0.obs;

  final screens = [
    CustomerDashboardScreen(),
    CustomerCategoryScreen(),
    CustomerOrdersScreen(),
    CustomerWishlistScreen(),
    CustomerProfileScreen(),
  ];

  void changeTab(int i) {
    index.value = i;
  }
}
