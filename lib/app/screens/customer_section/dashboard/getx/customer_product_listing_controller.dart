import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/repositories/customer_product_repository.dart';
import 'package:onesoff_customer/app/screens/customer_section/dashboard/getx/customer_dashboard_controller.dart';

class CustomerProductListingController extends GetxController {
  final CustomerProductRepository _repository =
      Get.find<CustomerProductRepository>();

  late final ProductFilterArgs filter;
  final RxBool isLoading = false.obs;
  final RxnString errorMessage = RxnString();
  final RxList<CustomerProduct> products = <CustomerProduct>[].obs;

  @override
  void onInit() {
    super.onInit();
    final dynamic args = Get.arguments;
    filter = args is ProductFilterArgs
        ? args
        : const ProductFilterArgs(title: 'Products');
    fetchProducts();
  }

  Future<void> fetchProducts() async {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      final List<CustomerProduct> nextProducts = await _repository.getProducts(
        gender: filter.gender,
        category: filter.category,
        search: filter.search,
        limit: 50,
      );
      products.assignAll(nextProducts);
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
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
    return 'Unable to load products. Please try again.';
  }
}
