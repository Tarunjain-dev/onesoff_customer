import 'package:dio/dio.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/data/models/product_detail.dart';
import 'package:onesoff_customer/app/data/repositories/customer_product_repository.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';

class ProductDetailController extends GetxController {
  final CustomerProductRepository _repository =
      Get.find<CustomerProductRepository>();

  final RxInt selectedImageIndex = 0.obs;
  final RxInt selectedPeriodIndex = 0.obs;
  final RxInt selectedSizeIndex = 0.obs;
  final RxBool isDetailsExpanded = true.obs;
  final RxBool isReviewsExpanded = true.obs;
  final RxBool isLoading = false.obs;
  final RxBool isCalendarLoading = false.obs;
  final RxBool isTrialSubmitting = false.obs;
  final RxnString errorMessage = RxnString();
  final Rxn<ProductDetail> product = Rxn<ProductDetail>();
  final Rxn<ProductReviewsResult> reviews = Rxn<ProductReviewsResult>();
  final RxList<String> images = <String>[AppImages.womensWear_1].obs;
  final RxList<CustomerProduct> recommendedProducts = <CustomerProduct>[].obs;
  final RxSet<String> unavailableDates = <String>{}.obs;
  final Rxn<DateTime> bookingStartDate = Rxn<DateTime>();
  final Rxn<DateTime> bookingEndDate = Rxn<DateTime>();
  final Rx<DateTime> visibleMonth = DateTime(
    DateTime.now().year,
    DateTime.now().month,
  ).obs;

  String? productId;
  @override
  void onInit() {
    super.onInit();
    _readArguments();
    fetchProductDetail();
  }

  Future<void> fetchProductDetail() async {
    if (productId == null || productId!.isEmpty) {
      images.assignAll(<String>[
        (Get.arguments as String?) ?? AppImages.womensWear_1,
      ]);
      errorMessage.value = 'Product id not available for details.';
      return;
    }

    isLoading.value = true;
    errorMessage.value = null;
    try {
      final ProductDetail nextProduct = await _repository.getProductDetail(
        productId!,
      );
      product.value = nextProduct;
      images.assignAll(nextProduct.images);
      selectedImageIndex.value = 0;
      selectedPeriodIndex.value = 0;
      selectedSizeIndex.value = 0;
      _syncBookingWindow(DateTime.now());
      await Future.wait(<Future<void>>[
        fetchAvailability(),
        fetchReviews(),
        fetchRecommendedProducts(),
      ]);
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> fetchAvailability() async {
    final ProductDetail? current = product.value;
    if (current == null) return;

    isCalendarLoading.value = true;
    try {
      final ProductAvailabilityCalendar calendar = await _repository
          .getAvailabilityCalendar(
            productId: current.id,
            month: _monthKey(visibleMonth.value),
            variantId: selectedVariant?.id,
          );
      unavailableDates.assignAll(calendar.unavailableDates);
    } catch (_) {
      unavailableDates.clear();
    } finally {
      isCalendarLoading.value = false;
    }
  }

  Future<void> fetchReviews() async {
    final ProductDetail? current = product.value;
    if (current == null) return;
    try {
      reviews.value = await _repository.getProductReviews(current.id);
    } catch (_) {
      reviews.value = const ProductReviewsResult(
        averageRating: 0,
        totalReviews: 0,
        reviews: <ProductReview>[],
      );
    }
  }

  Future<void> fetchRecommendedProducts() async {
    final ProductDetail? current = product.value;
    if (current == null) return;
    try {
      final List<CustomerProduct> products = await _repository.getProducts(
        gender: current.gender,
        category: current.category,
        limit: 8,
      );
      recommendedProducts.assignAll(
        products.where((CustomerProduct item) => item.id != current.id).take(6),
      );
    } catch (_) {
      recommendedProducts.clear();
    }
  }

  void selectImage(int index) {
    selectedImageIndex.value = index;
  }

  void selectPeriod(int index) {
    selectedPeriodIndex.value = index;
    _syncBookingWindow(bookingStartDate.value ?? DateTime.now());
  }

  void selectSize(int index) {
    selectedSizeIndex.value = index;
    fetchAvailability();
  }

  void selectBookingStart(DateTime start) {
    _syncBookingWindow(start);
  }

  void changeVisibleMonth(int delta) {
    visibleMonth.value = DateTime(
      visibleMonth.value.year,
      visibleMonth.value.month + delta,
    );
    fetchAvailability();
  }

  bool isUnavailable(DateTime date) =>
      unavailableDates.contains(_dateKey(date));

  bool isSelectedWindowDate(DateTime date) {
    final DateTime? start = bookingStartDate.value;
    final DateTime? end = bookingEndDate.value;
    if (start == null || end == null) return false;
    final DateTime day = DateTime(date.year, date.month, date.day);
    final DateTime startDay = DateTime(start.year, start.month, start.day);
    final DateTime endDay = DateTime(end.year, end.month, end.day);
    return !day.isBefore(startDay) && !day.isAfter(endDay);
  }

  bool isWindowAvailableForStart(DateTime start) {
    for (int offset = 0; offset < selectedPeriodDays; offset += 1) {
      if (isUnavailable(start.add(Duration(days: offset)))) return false;
    }
    return true;
  }

  Future<void> submitTrialRequest(DateTime date) async {
    final ProductDetail? current = product.value;
    if (current == null) return;
    isTrialSubmitting.value = true;
    try {
      await _repository.createTrialRequest(
        productId: current.id,
        variantId: selectedVariant?.id,
        preferredDate: date,
      );
      Get.back<void>();
      Get.snackbar(
        'Trial Requested',
        'Your trial request has been sent to the vendor.',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (error) {
      Get.snackbar(
        'Trial Request Failed',
        _readableError(error),
        snackPosition: SnackPosition.BOTTOM,
      );
    } finally {
      isTrialSubmitting.value = false;
    }
  }

  void toggleDetailsExpanded() {
    isDetailsExpanded.toggle();
  }

  void toggleReviewsExpanded() {
    isReviewsExpanded.toggle();
  }

  ProductVariant? get selectedVariant =>
      product.value?.variantAt(selectedSizeIndex.value);

  int get selectedPeriodDays =>
      product.value?.periodAt(selectedPeriodIndex.value) ?? 3;

  String get formattedStartDate => _displayDate(bookingStartDate.value);
  String get formattedEndDate => _displayDate(bookingEndDate.value);

  List<int> get rentingPeriods =>
      product.value?.rentingPeriods ?? <int>[3, 5, 7, 10];

  List<String> get sizeLabels {
    final List<ProductVariant> variants =
        product.value?.variants ?? <ProductVariant>[];
    if (variants.isEmpty) return <String>['Free Size'];
    return variants.map((ProductVariant variant) => variant.size).toList();
  }

  num get averageRating => reviews.value?.averageRating ?? 0;

  void _readArguments() {
    images.assignAll(<String>[AppImages.womensWear_1]);
    final dynamic args = Get.arguments;
    if (args is CustomerProduct) {
      productId = args.id;
      product.value = ProductDetail(
        id: args.id,
        name: args.name,
        description: args.description,
        images: <String>[args.imageUrl],
        rentalPrice: args.rentPrice,
        securityDeposit: 0,
        rentingPeriods: const <int>[3, 5, 7, 10],
        variants: const <ProductVariant>[],
        specifications: const <ProductSpecification>[],
        gender: args.gender,
        category: args.category,
      );
      images.assignAll(<String>[args.imageUrl]);
    } else if (args is Map) {
      productId = args['id']?.toString() ?? args['productId']?.toString();
    } else if (args is String && RegExp(r'^\d+$').hasMatch(args)) {
      productId = args;
    } else if (args is String) {
      images.assignAll(<String>[args]);
    }
  }

  void _syncBookingWindow(DateTime start) {
    final DateTime startDay = DateTime(start.year, start.month, start.day);
    bookingStartDate.value = startDay;
    bookingEndDate.value = startDay.add(Duration(days: selectedPeriodDays - 1));
  }

  String _monthKey(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}';

  String _dateKey(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _displayDate(DateTime? date) {
    if (date == null) return 'Select date';
    return '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
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
    return 'Please try again in a moment.';
  }
}
