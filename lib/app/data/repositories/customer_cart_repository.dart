import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_cart.dart';

class CustomerCartRepository {
  CustomerCartRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<CustomerCartItem>> getCart() async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.cart,
    );
    return _extractItems(response.data)
        .map(CustomerCartItem.fromJson)
        .where((CustomerCartItem item) => item.productId.isNotEmpty)
        .toList();
  }

  Future<CustomerCartItem> addToCart(CustomerCartItem item) async {
    final Response<dynamic> response = await _apiClient.dio.post<dynamic>(
      ApiEndpoints.cartAdd,
      data: item.toCartPayload(),
    );
    final Map<String, dynamic> data = _extractData(response.data);
    return CustomerCartItem.fromJson(data).copyWith(
      cartItemId: _string(data['id'] ?? data['cartItemId']) ?? item.cartItemId,
    );
  }

  Future<void> removeFromCart(String cartItemId) async {
    await _apiClient.dio.delete<dynamic>(ApiEndpoints.cartRemove(cartItemId));
  }

  Future<void> clearCart() async {
    await _apiClient.dio.delete<dynamic>(ApiEndpoints.cartClear);
  }

  Future<WelcomeCoupon?> getWelcomeCoupon() async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.firstOrderOffer,
    );
    final Map<String, dynamic> data = _extractData(response.data);
    final bool isEligible = data['isEligible'] == true;
    final Map<String, dynamic> coupon = _asMap(data['coupon']);
    if (!isEligible || coupon.isEmpty) return null;
    return WelcomeCoupon.fromJson(coupon);
  }

  Future<CouponValidation> validateCoupon({
    required String code,
    required num orderValue,
    String? vendorId,
  }) async {
    final Response<dynamic> response = await _apiClient.dio.post<dynamic>(
      ApiEndpoints.validateCoupon,
      data: <String, dynamic>{
        'code': code,
        'orderValue': orderValue,
        if (vendorId != null && vendorId.isNotEmpty) 'vendorId': vendorId,
      },
    );
    return CouponValidation.fromJson(_extractData(response.data));
  }

  Future<RazorpayInitResult> initRazorpay({
    required List<CustomerCartItem> items,
    required String? couponCode,
    required Map<String, dynamic> deliveryAddress,
  }) async {
    final List<Map<String, dynamic>> payloadItems = items
        .map((CustomerCartItem item) => item.toCheckoutPayload())
        .toList();
    final CustomerCartItem firstItem = items.first;
    final Response<dynamic> response = await _apiClient.dio.post<dynamic>(
      ApiEndpoints.razorpayInit,
      data: <String, dynamic>{
        'items': payloadItems,
        'startDate': firstItem.issueDateIso,
        'endDate': firstItem.returnDateIso,
        if (couponCode != null && couponCode.isNotEmpty)
          'couponCode': couponCode,
        'deliveryAddress': deliveryAddress,
      },
    );
    return RazorpayInitResult.fromJson(_extractData(response.data));
  }

  Future<void> verifyRazorpay({
    required String internalOrderId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    await _apiClient.dio.post<dynamic>(
      ApiEndpoints.razorpayVerify,
      data: <String, dynamic>{
        'internalOrderId': internalOrderId,
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      },
    );
  }

  Future<void> cancelRazorpay(String internalOrderId) async {
    await _apiClient.dio.post<dynamic>(
      ApiEndpoints.razorpayCancel,
      data: <String, dynamic>{'internalOrderId': internalOrderId},
    );
  }

  Future<void> reportPaymentFailure(String internalOrderId) async {
    await _apiClient.dio.post<dynamic>(
      ApiEndpoints.paymentFailure,
      data: <String, dynamic>{'orderId': internalOrderId},
    );
  }

  List<Map<String, dynamic>> _extractItems(dynamic response) {
    final Map<String, dynamic> data = _extractData(response);
    for (final String key in <String>['items', 'cartItems', 'cart']) {
      final dynamic value = data[key];
      if (value is List) return _mapList(value);
    }
    if (response is List) return _mapList(response);
    return <Map<String, dynamic>>[];
  }

  Map<String, dynamic> _extractData(dynamic response) {
    final Map<String, dynamic> root = _asMap(response);
    final dynamic data = root['data'];
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return root;
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

  String? _string(dynamic value) {
    if (value == null) return null;
    final String text = value.toString().trim();
    return text.isEmpty ? null : text;
  }
}
