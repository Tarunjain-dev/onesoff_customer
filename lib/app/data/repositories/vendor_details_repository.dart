import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/models/vendor_details.dart';

class VendorDetailsRepository {
  VendorDetailsRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<VendorDetailsBundle> getVendorDetails(
    String vendorId, {
    Map<String, dynamic> seedVendor = const <String, dynamic>{},
  }) async {
    final List<Response<dynamic>> responses = await Future.wait(
      <Future<Response<dynamic>>>[
        _apiClient.dio.get<dynamic>(
          ApiEndpoints.products,
          queryParameters: <String, dynamic>{
            'vendorId': vendorId,
            'page': 1,
            'limit': 30,
          },
          options: Options(extra: <String, dynamic>{'skipAuth': true}),
        ),
        _apiClient.dio.get<dynamic>(
          ApiEndpoints.vendorReviews(vendorId),
          queryParameters: const <String, dynamic>{'page': 1, 'limit': 20},
          options: Options(extra: <String, dynamic>{'skipAuth': true}),
        ),
      ],
    );

    final Map<String, dynamic> productsData = _extractData(responses[0].data);
    final Map<String, dynamic> reviewsData = _extractData(responses[1].data);
    final List<Map<String, dynamic>> productMaps = _extractList(
      productsData,
      <String>['products', 'items', 'rows'],
    );
    final List<CustomerProduct> products = productMaps
        .map(CustomerProduct.fromJson)
        .where((CustomerProduct product) => product.id.isNotEmpty)
        .toList();

    final List<Map<String, dynamic>> reviewMaps = _extractList(
      reviewsData,
      <String>['reviews', 'items', 'rows'],
    );

    final Map<String, dynamic> vendorMap = _bestVendorMap(
      reviewsData: reviewsData,
      products: productMaps,
      fallbackVendorId: vendorId,
      seedVendor: seedVendor,
    );

    return VendorDetailsBundle(
      vendor: VendorDetails.fromJson(vendorMap),
      summary: VendorReviewSummary.fromJson(_asMap(reviewsData['summary'])),
      products: products,
      reviews: reviewMaps.map(VendorReview.fromJson).toList(),
      totalProducts: _totalProducts(productsData, products.length),
    );
  }

  Map<String, dynamic> _bestVendorMap({
    required Map<String, dynamic> reviewsData,
    required List<Map<String, dynamic>> products,
    required String fallbackVendorId,
    required Map<String, dynamic> seedVendor,
  }) {
    final Map<String, dynamic> reviewVendor = _asMap(reviewsData['vendor']);
    final Map<String, dynamic> productVendor = products.isEmpty
        ? <String, dynamic>{}
        : _asMap(products.first['vendor']);
    return <String, dynamic>{
      'id': fallbackVendorId,
      ..._withoutEmpty(seedVendor),
      ..._withoutEmpty(productVendor),
      ..._withoutEmpty(reviewVendor),
    };
  }

  Map<String, dynamic> _withoutEmpty(Map<String, dynamic> value) {
    return Map<String, dynamic>.fromEntries(
      value.entries.where((MapEntry<String, dynamic> entry) {
        final dynamic item = entry.value;
        if (item == null) return false;
        if (item is String && item.trim().isEmpty) return false;
        return true;
      }),
    );
  }

  int _totalProducts(Map<String, dynamic> data, int fallback) {
    final Map<String, dynamic> pagination = _asMap(data['pagination']);
    final dynamic total = pagination['total'] ?? data['total'];
    if (total is int) return total;
    if (total is num) return total.round();
    return int.tryParse(total?.toString() ?? '') ?? fallback;
  }

  Map<String, dynamic> _extractData(dynamic response) {
    final Map<String, dynamic> root = _asMap(response);
    final dynamic data = root['data'];
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return root;
  }

  List<Map<String, dynamic>> _extractList(
    Map<String, dynamic> data,
    List<String> keys,
  ) {
    for (final String key in keys) {
      final dynamic value = data[key];
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
