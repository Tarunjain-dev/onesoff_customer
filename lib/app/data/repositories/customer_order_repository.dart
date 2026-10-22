import 'package:dio/dio.dart';
import 'package:onesoff_customer/app/data/api/api_client.dart';
import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_order.dart';
import 'package:onesoff_customer/app/data/models/customer_refund_detail.dart';

class CustomerOrderRepository {
  CustomerOrderRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<List<CustomerOrder>> getOrders() async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.customerOrders,
    );
    final dynamic root = response.data;
    final Map<String, dynamic> data = root is Map && root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root is Map
        ? Map<String, dynamic>.from(root)
        : <String, dynamic>{};
    final dynamic rawOrders = data['orders'];
    if (rawOrders is! List) return <CustomerOrder>[];
    return rawOrders
        .whereType<Map>()
        .map((item) => CustomerOrder.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<CustomerCancellationResult> cancelOrder(String orderId) async {
    final Response<dynamic> response = await _apiClient.dio.post<dynamic>(
      ApiEndpoints.cancelCustomerOrder(orderId),
    );
    final dynamic root = response.data;
    final Map<String, dynamic> data = root is Map && root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : <String, dynamic>{};
    return CustomerCancellationResult(
      totalRefundAmount:
          num.tryParse(data['totalRefundAmount']?.toString() ?? '') ?? 0,
      refundWindow: data['refundWindow']?.toString() ?? '7-10 working days',
    );
  }

  Future<List<CustomerRefundDetail>> getRefundDetails() async {
    final Response<dynamic> response = await _apiClient.dio.get<dynamic>(
      ApiEndpoints.customerRefundDetails,
    );
    final dynamic root = response.data;
    final dynamic raw = root is Map ? root['data'] : root;
    if (raw is! List) return <CustomerRefundDetail>[];
    return raw
        .whereType<Map>()
        .map(
          (item) =>
              CustomerRefundDetail.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }
}

class CustomerCancellationResult {
  const CustomerCancellationResult({
    required this.totalRefundAmount,
    required this.refundWindow,
  });
  final num totalRefundAmount;
  final String refundWindow;
}
