import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/models/product_detail.dart';

class CustomerProductRepository {
  CustomerProductRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<CustomerProduct>> getProducts({
    String? gender,
    String? category,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.products,
      queryParameters: <String, dynamic>{
        if (gender != null && gender.trim().isNotEmpty) 'gender': gender.trim(),
        if (category != null && category.trim().isNotEmpty)
          'category': category.trim(),
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'page': page,
        'limit': limit,
      },
      options: Options(extra: <String, dynamic>{'skipAuth': true}),
    );

    return _extractProducts(response.data)
        .map(CustomerProduct.fromJson)
        .where((CustomerProduct product) => product.id.isNotEmpty)
        .toList();
  }

  Future<ProductDetail> getProductDetail(String productId) async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.product(productId),
      options: Options(extra: <String, dynamic>{'skipAuth': true}),
    );
    return ProductDetail.fromJson(_extractData(response.data));
  }

  Future<ProductAvailabilityCalendar> getAvailabilityCalendar({
    required String productId,
    required String month,
    String? variantId,
  }) async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.productAvailabilityCalendar(productId),
      queryParameters: <String, dynamic>{
        'month': month,
        if (variantId != null && variantId.isNotEmpty) 'variantId': variantId,
      },
      options: Options(extra: <String, dynamic>{'skipAuth': true}),
    );
    return ProductAvailabilityCalendar.fromJson(_extractData(response.data));
  }

  Future<ProductReviewsResult> getProductReviews(String productId) async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.productReviews(productId),
      queryParameters: const <String, dynamic>{'page': 1, 'limit': 10},
      options: Options(extra: <String, dynamic>{'skipAuth': true}),
    );
    return ProductReviewsResult.fromJson(_extractData(response.data));
  }

  Future<void> createTrialRequest({
    required String productId,
    String? variantId,
    required DateTime preferredDate,
  }) async {
    final String date = preferredDate.toIso8601String().substring(0, 10);
    await _apiClient.dio.post<dynamic>(
      ApiEndpoints.trialRequest,
      data: <String, dynamic>{
        'productId': productId,
        if (variantId != null && variantId.isNotEmpty) 'variantId': variantId,
        'preferredDate': date,
        'trialDate': date,
      },
    );
  }

  Map<String, dynamic> _extractData(dynamic response) {
    final Map<String, dynamic> root = _asMap(response);
    final dynamic data = root['data'];
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return root;
  }

  List<Map<String, dynamic>> _extractProducts(dynamic response) {
    final Map<String, dynamic> root = _asMap(response);
    final dynamic data = root['data'] ?? root;
    if (data is List) return _mapList(data);

    final Map<String, dynamic> dataMap = _asMap(data);
    for (final String key in <String>['products', 'items', 'results', 'rows']) {
      final dynamic value = dataMap[key];
      if (value is List) return _mapList(value);
    }
    return <Map<String, dynamic>>[];
  }

  List<Map<String, dynamic>> _mapList(List<dynamic> values) {
    return values
        .whereType<Map<dynamic, dynamic>>()
        .map((Map<dynamic, dynamic> item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }
}
