import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/repositories/customer_product_repository.dart';
import 'package:onesoff_customer/app/global_controllers.dart/customer_bottom_nav_controller.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';

enum CustomerDashboardSection { women, men, jewellery }

class ProductFilterArgs {
  const ProductFilterArgs({
    required this.title,
    this.gender,
    this.category,
    this.search,
  });

  final String title;
  final String? gender;
  final String? category;
  final String? search;
}

class CustomerDashboardController extends GetxController {
  final CustomerProductRepository _productRepository =
      Get.find<CustomerProductRepository>();

  final PageController featuredPageController = PageController();
  final TextEditingController searchController = TextEditingController();
  final RxInt featuredIndex = 0.obs;
  final RxBool isLoading = false.obs;
  final RxnString errorMessage = RxnString();
  final RxList<CustomerProduct> womenProducts = <CustomerProduct>[].obs;
  final RxList<CustomerProduct> menProducts = <CustomerProduct>[].obs;
  final RxList<CustomerProduct> jewelleryProducts = <CustomerProduct>[].obs;

  static const ProductFilterArgs womenFilter = ProductFilterArgs(
    title: "Onesoff's Womens Outfits.",
    gender: 'Female',
  );

  static const ProductFilterArgs menFilter = ProductFilterArgs(
    title: "Onesoff's Mens Outfits.",
    gender: 'Male',
  );

  static const ProductFilterArgs jewelleryFilter = ProductFilterArgs(
    title: "Onesoff's Jewellery & Accessories.",
    category: 'Jewellery & Accessories',
  );

  @override
  void onInit() {
    super.onInit();
    fetchDashboardProducts();
  }

  void onFeaturedPageChanged(int index) {
    featuredIndex.value = index;
  }

  Future<void> fetchDashboardProducts() async {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      final List<List<CustomerProduct>> results = await Future.wait(
        <Future<List<CustomerProduct>>>[
          _productRepository.getProducts(gender: womenFilter.gender, limit: 6),
          _productRepository.getProducts(gender: menFilter.gender, limit: 6),
          _productRepository.getProducts(
            category: jewelleryFilter.category,
            limit: 6,
          ),
        ],
      );
      womenProducts.assignAll(results[0]);
      menProducts.assignAll(results[1]);
      jewelleryProducts.assignAll(results[2]);
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  void openSection(ProductFilterArgs filter) {
    Get.toNamed(AppRoutes.customerProductListing, arguments: filter);
  }

  void submitSearch() {
    final String query = searchController.text.trim();
    if (query.isEmpty) return;
    Get.toNamed(
      AppRoutes.customerProductListing,
      arguments: ProductFilterArgs(
        title: 'Search results for "$query"',
        search: query,
      ),
    );
  }

  void openCategories() {
    Get.find<CustomerBottomNavController>().changeTab(1);
  }

  String _readableError(Object error) {
    if (error is DioException) {
      final dynamic responseData = error.response?.data;
      if (responseData is Map && responseData['message'] != null) {
        return responseData['message'].toString();
      }
      if (responseData is Map && responseData['error'] != null) {
        return responseData['error'].toString();
      }
      if (error.response?.statusCode != null) {
        return 'Server error ${error.response?.statusCode}. Please try again.';
      }
    }
    return 'Unable to load dashboard products. Please try again.';
  }

  @override
  void onClose() {
    featuredPageController.dispose();
    searchController.dispose();
    super.onClose();
  }
}
