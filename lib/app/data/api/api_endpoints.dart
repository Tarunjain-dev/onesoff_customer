class ApiEndpoints {
  ApiEndpoints._();

  static const String baseUrl = 'https://api.onesoff.com';
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String authCustomerProfile = '/auth/customer/profile';
  static const String customerProfile = '/customers/profile';
  static const String products = '/products';
  static String product(String id) => '/products/$id';
  static String vendorReviews(String id) => '/reviews/vendors/$id';
  static String productAvailabilityCalendar(String id) =>
      '/products/$id/rental-availability/calendar';
  static String productReviews(String id) => '/reviews/products/$id';
  static const String trialRequest = '/trials/request';
  static const String wishlist = '/customers/wishlist';
  static String wishlistProduct(String id) => '/customers/wishlist/$id';
  static const String cart = '/cart';
  static const String cartAdd = '/cart/add';
  static String cartRemove(String id) => '/cart/remove/$id';
  static const String cartClear = '/cart/clear';
  static const String firstOrderOffer = '/coupons/first-order-offer';
  static const String validateCoupon = '/coupons/validate';
  static const String razorpayInit = '/payments/razorpay/init';
  static const String razorpayVerify = '/payments/razorpay/verify';
  static const String razorpayCancel = '/payments/razorpay/cancel';
  static const String paymentFailure = '/payments/payment-failure';
}
