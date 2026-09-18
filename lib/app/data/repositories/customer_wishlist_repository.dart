import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';

class CustomerWishlistRepository {
  CustomerWishlistRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<CustomerProduct>> getWishlist() async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.wishlist,
    );
    return _extractProducts(response.data)
        .map(CustomerProduct.fromJson)
        .where((CustomerProduct product) => product.id.isNotEmpty)
        .toList();
  }

  Future<void> addProduct(String productId) async {
    await _apiClient.dio.post<dynamic>(
      ApiEndpoints.wishlist,
      data: <String, dynamic>{'productId': productId},
    );
  }

  Future<void> removeProduct(String productId) async {
    await _apiClient.dio.delete<dynamic>(
      ApiEndpoints.wishlistProduct(productId),
    );
  }

  List<Map<String, dynamic>> _extractProducts(dynamic response) {
    final Map<String, dynamic> root = _asMap(response);
    final dynamic data = root['data'] ?? root;
    if (data is List) return _wishlistItems(data);

    final Map<String, dynamic> dataMap = _asMap(data);
    for (final String key in <String>[
      'wishlist',
      'products',
      'items',
      'rows',
    ]) {
      final dynamic value = dataMap[key];
      if (value is List) return _wishlistItems(value);
    }
    return <Map<String, dynamic>>[];
  }

  List<Map<String, dynamic>> _wishlistItems(List<dynamic> values) {
    return values.whereType<Map<dynamic, dynamic>>().map((
      Map<dynamic, dynamic> item,
    ) {
      final Map<String, dynamic> entry = Map<String, dynamic>.from(item);
      final dynamic product = entry['product'];
      if (product is Map<String, dynamic>) return product;
      if (product is Map) return Map<String, dynamic>.from(product);
      return entry;
    }).toList();
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }
}
