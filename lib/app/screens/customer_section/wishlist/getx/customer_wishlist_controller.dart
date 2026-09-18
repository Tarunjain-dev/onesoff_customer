import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/repositories/customer_wishlist_repository.dart';

class CustomerWishlistController extends GetxController {
  final CustomerWishlistRepository _repository =
      Get.find<CustomerWishlistRepository>();

  final RxList<CustomerProduct> products = <CustomerProduct>[].obs;
  final RxSet<String> wishlistIds = <String>{}.obs;
  final RxSet<String> updatingIds = <String>{}.obs;
  final RxBool isLoading = false.obs;
  final RxnString errorMessage = RxnString();

  @override
  void onInit() {
    super.onInit();
    fetchWishlist();
  }

  Future<void> fetchWishlist() async {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      final List<CustomerProduct> nextProducts = await _repository
          .getWishlist();
      products.assignAll(nextProducts);
      wishlistIds
        ..clear()
        ..addAll(nextProducts.map((CustomerProduct product) => product.id));
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  bool isWishlisted(String productId) => wishlistIds.contains(productId);

  Future<void> toggleWishlist(CustomerProduct product) async {
    if (product.id.isEmpty || updatingIds.contains(product.id)) return;

    final bool wasWishlisted = wishlistIds.contains(product.id);
    updatingIds.add(product.id);
    _setWishlistState(product, shouldAdd: !wasWishlisted);

    try {
      if (wasWishlisted) {
        await _repository.removeProduct(product.id);
      } else {
        await _repository.addProduct(product.id);
      }
    } catch (error) {
      _setWishlistState(product, shouldAdd: wasWishlisted);
      Get.snackbar(
        'Wishlist Update Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      updatingIds.remove(product.id);
    }
  }

  void _setWishlistState(CustomerProduct product, {required bool shouldAdd}) {
    if (shouldAdd) {
      wishlistIds.add(product.id);
      if (!products.any((CustomerProduct item) => item.id == product.id)) {
        products.insert(0, product);
      }
      return;
    }

    wishlistIds.remove(product.id);
    products.removeWhere((CustomerProduct item) => item.id == product.id);
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
      if (error.response?.statusCode == 401) {
        return 'Your session has expired. Please login again.';
      }
      if (error.response?.statusCode != null) {
        return 'Server error ${error.response?.statusCode}. Please try again.';
      }
    }
    final String message = error.toString();
    if (message.contains('SocketException') || message.contains('timeout')) {
      return 'Unable to connect to server. Please try again.';
    }
    return 'Please try again in a moment.';
  }
}
