import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_cart.dart';
import 'package:onesoff_customer/app/data/models/customer_profile.dart';
import 'package:onesoff_customer/app/data/models/product_detail.dart';
import 'package:onesoff_customer/app/data/repositories/customer_cart_repository.dart';
import 'package:onesoff_customer/app/global_controllers.dart/customer_bottom_nav_controller.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/screens/customer_section/profile/getx/customer_profile_controller.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

class CustomerCartController extends GetxController {
  final CustomerCartRepository _repository = Get.find<CustomerCartRepository>();
  Razorpay? _razorpay;
  RazorpayInitResult? _pendingPayment;

  final RxList<CustomerCartItem> cartItems = <CustomerCartItem>[].obs;
  final RxList<CustomerCartItem> checkoutItems = <CustomerCartItem>[].obs;
  final Rxn<WelcomeCoupon> welcomeCoupon = Rxn<WelcomeCoupon>();
  final Rxn<CouponValidation> couponValidation = Rxn<CouponValidation>();
  final RxBool isCheckoutMode = false.obs;
  final RxBool isLoading = false.obs;
  final RxBool isAdding = false.obs;
  final RxBool isRemoving = false.obs;
  final RxBool isCouponLoading = false.obs;
  final RxBool isCheckoutLoading = false.obs;
  final RxnString errorMessage = RxnString();
  final TextEditingController couponController = TextEditingController();

  @override
  void onInit() {
    super.onInit();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
    fetchCart();
    fetchWelcomeCoupon();
  }

  List<CustomerCartItem> get visibleItems =>
      isCheckoutMode.value ? checkoutItems : cartItems;

  bool get isEmptyCart => !isCheckoutMode.value && cartItems.isEmpty;

  int get rentalTotal => visibleItems.fold<int>(
    0,
    (int total, CustomerCartItem item) => total + item.rentalTotal,
  );

  int get depositTotal => visibleItems.fold<int>(
    0,
    (int total, CustomerCartItem item) => total + item.depositTotal,
  );

  int get discountTotal => couponValidation.value?.discount.round() ?? 0;
  int get payableTotal =>
      (rentalTotal - discountTotal).clamp(0, rentalTotal).toInt();
  int get grandTotal => payableTotal + depositTotal;
  bool get shouldShowWelcomeCoupon => welcomeCoupon.value != null;

  Future<void> fetchCart() async {
    if (isCheckoutMode.value) return;
    isLoading.value = true;
    errorMessage.value = null;
    try {
      cartItems.assignAll(await _repository.getCart());
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> fetchWelcomeCoupon() async {
    isCouponLoading.value = true;
    try {
      final WelcomeCoupon? coupon = await _repository.getWelcomeCoupon();
      welcomeCoupon.value = coupon;
      if (coupon != null && couponController.text.trim().isEmpty) {
        couponController.text = coupon.code;
      }
    } catch (_) {
      welcomeCoupon.value = null;
    } finally {
      isCouponLoading.value = false;
    }
  }

  Future<void> addProduct(CustomerCartItem item) async {
    if (!_hasValidVariant(item)) return;
    isCheckoutMode.value = false;
    isAdding.value = true;
    try {
      await _repository.addToCart(item);
      await fetchCart();
      _openCartTab();
      Get.snackbar(
        'Added To Cart',
        'Product has been added to your cart.',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (error) {
      Get.snackbar(
        'Add To Cart Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isAdding.value = false;
    }
  }

  void buyNow(CustomerCartItem item) {
    if (!_hasValidVariant(item)) return;
    checkoutItems.assignAll(<CustomerCartItem>[item]);
    couponValidation.value = null;
    isCheckoutMode.value = true;
    _openCartTab();
  }

  Future<void> removeItem(CustomerCartItem item) async {
    if (isCheckoutMode.value) {
      checkoutItems.removeWhere(
        (CustomerCartItem value) => value.productId == item.productId,
      );
      if (checkoutItems.isEmpty) {
        showCart();
      }
      return;
    }
    if (item.cartItemId.isEmpty) return;

    isRemoving.value = true;
    try {
      await _repository.removeFromCart(item.cartItemId);
      cartItems.removeWhere(
        (CustomerCartItem value) => value.cartItemId == item.cartItemId,
      );
      couponValidation.value = null;
    } catch (error) {
      Get.snackbar(
        'Remove Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isRemoving.value = false;
    }
  }

  Future<void> applyCoupon() async {
    final String code = couponController.text.trim();
    if (code.isEmpty) {
      Get.snackbar(
        'Coupon Required',
        'Please enter a coupon code.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }
    if (rentalTotal <= 0) {
      Get.snackbar(
        'Cart Is Empty',
        'Add a product before applying this coupon.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    isCouponLoading.value = true;
    try {
      couponValidation.value = await _repository.validateCoupon(
        code: code,
        orderValue: rentalTotal,
      );
      Get.snackbar(
        'Coupon Applied',
        'Discount of Rs. $discountTotal applied.',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (error) {
      couponValidation.value = null;
      Get.snackbar(
        'Coupon Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isCouponLoading.value = false;
    }
  }

  Future<void> checkoutAndPay() async {
    if (visibleItems.isEmpty) return;
    if (visibleItems.any((CustomerCartItem item) => item.variantId.isEmpty)) {
      Get.snackbar(
        'Variant Required',
        'Please select a product size before checkout.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    isCheckoutLoading.value = true;
    try {
      final RazorpayInitResult result = await _repository.initRazorpay(
        items: visibleItems,
        couponCode: couponValidation.value?.couponCode,
        deliveryAddress: _deliveryAddress(),
      );
      _pendingPayment = result;
      _openRazorpay(result);
    } catch (error) {
      Get.snackbar(
        'Checkout Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
      isCheckoutLoading.value = false;
    }
  }

  void _openRazorpay(RazorpayInitResult result) {
    if (result.keyId.isEmpty || result.razorpayOrderId.isEmpty) {
      _pendingPayment = null;
      isCheckoutLoading.value = false;
      Get.snackbar(
        'Payment Failed',
        'Razorpay order details are missing. Please try again.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    final CustomerProfile? profile =
        Get.isRegistered<CustomerProfileController>()
        ? Get.find<CustomerProfileController>().profile.value
        : null;

    final Map<String, Object?> options = <String, Object?>{
      'key': result.keyId,
      'amount': result.amount.round(),
      'currency': result.currency,
      'name': 'OnesOff',
      'description': 'Fashion rental checkout',
      'order_id': result.razorpayOrderId,
      'prefill': <String, String>{
        'contact': profile?.phone ?? '',
        'email': profile?.email ?? '',
        'name': profile?.displayName ?? '',
      },
      'theme': <String, String>{'color': '#671A31'},
    };

    try {
      _razorpay?.open(options);
    } catch (error) {
      isCheckoutLoading.value = false;
      Get.snackbar(
        'Payment Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    _verifyPayment(response);
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    _cancelPendingPayment(
      response.message?.trim().isNotEmpty == true
          ? response.message!
          : 'Payment was cancelled or failed.',
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    final String wallet = response.walletName?.trim() ?? '';
    Get.snackbar(
      'External Wallet',
      wallet.isEmpty ? 'External wallet selected.' : '$wallet selected.',
      snackPosition: SnackPosition.BOTTOM,
    );
  }

  Future<void> _verifyPayment(PaymentSuccessResponse response) async {
    final RazorpayInitResult? pendingPayment = _pendingPayment;
    if (pendingPayment == null) {
      isCheckoutLoading.value = false;
      Get.snackbar(
        'Payment Verification Failed',
        'Payment session expired. Please contact support with your payment ID.',
        snackPosition: SnackPosition.BOTTOM,
      );
      return;
    }

    final String paymentId = response.paymentId ?? '';
    final String signature = response.signature ?? '';
    if (paymentId.isEmpty || signature.isEmpty) {
      await _cancelPendingPayment('Payment response is incomplete.');
      return;
    }

    try {
      await _repository.verifyRazorpay(
        internalOrderId: pendingPayment.internalOrderId,
        razorpayOrderId: response.orderId ?? pendingPayment.razorpayOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      );
      if (isCheckoutMode.value) {
        checkoutItems.clear();
        isCheckoutMode.value = false;
        await fetchCart();
      } else {
        cartItems.clear();
        await _repository.clearCart();
      }
      welcomeCoupon.value = null;
      couponValidation.value = null;
      couponController.clear();
      Get.snackbar(
        'Payment Successful',
        'Your booking has been confirmed.',
        snackPosition: SnackPosition.BOTTOM,
      );
      Get.toNamed(AppRoutes.customerOrderHistory);
    } catch (error) {
      Get.snackbar(
        'Payment Verification Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      _pendingPayment = null;
      isCheckoutLoading.value = false;
    }
  }

  Future<void> _cancelPendingPayment(String message) async {
    final RazorpayInitResult? pendingPayment = _pendingPayment;
    _pendingPayment = null;
    if (pendingPayment != null && pendingPayment.internalOrderId.isNotEmpty) {
      try {
        await _repository.cancelRazorpay(pendingPayment.internalOrderId);
      } catch (_) {
        await _repository
            .reportPaymentFailure(pendingPayment.internalOrderId)
            .catchError((_) {});
      }
    }
    isCheckoutLoading.value = false;
    Get.snackbar(
      'Payment Failed',
      message,
      snackPosition: SnackPosition.BOTTOM,
    );
  }

  void exploreCollection() {
    final CustomerBottomNavController navController =
        Get.isRegistered<CustomerBottomNavController>()
        ? Get.find<CustomerBottomNavController>()
        : Get.put(CustomerBottomNavController());
    isCheckoutMode.value = false;
    navController.changeTab(1);
  }

  void showCart() {
    isCheckoutMode.value = false;
    couponValidation.value = null;
    fetchCart();
  }

  CustomerCartItem itemFromProductDetail({
    required ProductDetail product,
    required ProductVariant? variant,
    required int rentalDays,
    required DateTime startDate,
    required DateTime endDate,
  }) {
    final ProductVendor? vendor = product.vendor;
    return CustomerCartItem(
      cartItemId: '',
      productId: product.id,
      variantId: variant?.id ?? '',
      name: product.name,
      description: product.description,
      imageUrl: product.primaryImage,
      rentalPrice: product.rentalPrice,
      securityDepositPerDay: product.securityDepositPerDay,
      rentalDays: rentalDays,
      startDate: startDate,
      endDate: endDate,
      size: variant?.size ?? 'Free Size',
      gender: product.gender ?? 'N/A',
      color: variant?.color ?? 'N/A',
      sku: variant?.sku ?? product.sku ?? '-',
      shopName: vendor?.name ?? 'Vendor',
      shopLocation: vendor?.location ?? 'N/A',
    );
  }

  bool _hasValidVariant(CustomerCartItem item) {
    if (item.variantId.isNotEmpty) return true;
    Get.snackbar(
      'Variant Required',
      'Please select an available size before continuing.',
      snackPosition: SnackPosition.BOTTOM,
    );
    return false;
  }

  Map<String, dynamic> _deliveryAddress() {
    final CustomerProfile? profile =
        Get.isRegistered<CustomerProfileController>()
        ? Get.find<CustomerProfileController>().profile.value
        : null;
    return <String, dynamic>{
      'addressLine1': profile?.addressLine1 ?? '',
      'landmark': profile?.landmark ?? '',
      'city': profile?.city ?? '',
      'state': profile?.state ?? '',
      'pincode': profile?.pincode ?? '',
    };
  }

  void _openCartTab() {
    final CustomerBottomNavController navController =
        Get.isRegistered<CustomerBottomNavController>()
        ? Get.find<CustomerBottomNavController>()
        : Get.put(CustomerBottomNavController());
    navController.changeTab(2);
    if (Get.currentRoute != AppRoutes.customerBottomNavBar) {
      Get.until(
        (route) =>
            route.settings.name == AppRoutes.customerBottomNavBar ||
            route.isFirst,
      );
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

  @override
  void onClose() {
    _razorpay?.clear();
    couponController.dispose();
    super.onClose();
  }
}
