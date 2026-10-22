import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_order.dart';
import 'package:onesoff_customer/app/data/models/customer_refund_detail.dart';
import 'package:onesoff_customer/app/data/repositories/customer_order_repository.dart';

class CustomerOrderController extends GetxController {
  final CustomerOrderRepository _repository =
      Get.find<CustomerOrderRepository>();

  final RxList<CustomerOrder> orders = <CustomerOrder>[].obs;
  final RxBool isLoading = false.obs;
  final RxnString errorMessage = RxnString();
  final RxnString cancellingOrderId = RxnString();
  final RxList<CustomerRefundDetail> refundDetails =
      <CustomerRefundDetail>[].obs;

  @override
  void onInit() {
    super.onInit();
    fetchOrders();
    fetchRefundDetails();
  }

  Future<void> fetchRefundDetails() async {
    try {
      refundDetails.assignAll(await _repository.getRefundDetails());
    } catch (_) {
      refundDetails.clear();
    }
  }

  Future<void> fetchOrders() async {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      orders.assignAll(await _repository.getOrders());
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  Future<bool> cancelOrder(CustomerOrder order) async {
    cancellingOrderId.value = order.id;
    try {
      final CustomerCancellationResult result = await _repository.cancelOrder(
        order.id,
      );
      await fetchOrders();
      await fetchRefundDetails();
      Get.snackbar(
        'Cancellation submitted',
        'Eligible refund: ₹${result.totalRefundAmount.toStringAsFixed(2)}. Refund request sent to admin; processing may take ${result.refundWindow}.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return true;
    } catch (error) {
      Get.snackbar(
        'Cancellation failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
      return false;
    } finally {
      cancellingOrderId.value = null;
    }
  }

  String _readableError(Object error) {
    if (error is DioException) {
      final dynamic body = error.response?.data;
      if (body is Map && body['message'] != null)
        return body['message'].toString();
      if (error.response?.statusCode == 401)
        return 'Your session has expired. Please login again.';
    }
    return 'Please try again in a moment.';
  }
}
