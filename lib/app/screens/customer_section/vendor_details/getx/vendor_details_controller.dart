import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/vendor_details.dart';
import 'package:onesoff_customer/app/data/repositories/vendor_details_repository.dart';

class VendorDetailsController extends GetxController {
  final VendorDetailsRepository _repository =
      Get.find<VendorDetailsRepository>();

  final RxInt selectedTabIndex = 0.obs;
  final RxBool isLoading = false.obs;
  final RxnString errorMessage = RxnString();
  final Rxn<VendorDetailsBundle> details = Rxn<VendorDetailsBundle>();

  String vendorId = '';
  Map<String, dynamic> seedVendor = <String, dynamic>{};

  @override
  void onInit() {
    super.onInit();
    vendorId = _readVendorId();
    seedVendor = _readVendorSeed();
    fetchVendorDetails();
  }

  void changeTab(int index) {
    selectedTabIndex.value = index;
  }

  Future<void> fetchVendorDetails() async {
    if (vendorId.isEmpty) {
      errorMessage.value = 'Vendor details are not available.';
      return;
    }

    isLoading.value = true;
    errorMessage.value = null;
    try {
      details.value = await _repository.getVendorDetails(
        vendorId,
        seedVendor: seedVendor,
      );
    } catch (error) {
      errorMessage.value = _readableError(error);
    } finally {
      isLoading.value = false;
    }
  }

  VendorDetails get vendor => details.value?.vendor ?? VendorDetails.empty;
  VendorReviewSummary get summary =>
      details.value?.summary ?? VendorReviewSummary.empty;
  int get productCount => details.value?.totalProducts ?? 0;

  String _readVendorId() {
    final dynamic args = Get.arguments;
    if (args == null) return '';
    if (args is String) return args.trim();
    if (args is num) return args.toString();
    if (args is Map) {
      final String value = (args['vendorId'] ?? args['id'] ?? '')
          .toString()
          .trim();
      if (value == 'null') return '';
      return value;
    }
    return '';
  }

  Map<String, dynamic> _readVendorSeed() {
    final dynamic args = Get.arguments;
    if (args is! Map) return <String, dynamic>{};
    final dynamic vendor = args['vendor'];
    if (vendor is Map<String, dynamic>) return vendor;
    if (vendor is Map) return Map<String, dynamic>.from(vendor);
    return <String, dynamic>{};
  }

  String _readableError(Object error) {
    final String message = error.toString();
    if (message.contains('SocketException') || message.contains('timeout')) {
      return 'Unable to connect to server. Please try again.';
    }
    return 'Unable to load vendor details. Please try again.';
  }
}
