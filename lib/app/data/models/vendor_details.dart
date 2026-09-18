import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';

class VendorDetails {
  const VendorDetails({
    required this.id,
    required this.shopName,
    required this.ownerName,
    required this.imageUrl,
    required this.badgeName,
    required this.badgeImageUrl,
    required this.location,
    required this.address,
  });

  final String id;
  final String shopName;
  final String ownerName;
  final String imageUrl;
  final String badgeName;
  final String badgeImageUrl;
  final String location;
  final String address;

  factory VendorDetails.fromJson(Map<String, dynamic> json) {
    final String city = _string(json['city']) ?? '';
    final String state = _string(json['state']) ?? '';
    final String address = _string(json['address']) ?? '';
    final List<String> locationParts = <String>[
      if (city.isNotEmpty) city,
      if (state.isNotEmpty) state,
    ];

    return VendorDetails(
      id: _string(json['id'] ?? json['vendorId'] ?? json['userId']) ?? '',
      shopName:
          _string(json['shopName'] ?? json['businessName'] ?? json['name']) ??
          'OnesOff Vendor',
      ownerName: _string(json['ownerName']) ?? '',
      imageUrl: _resolveImage(
        _string(
          json['profileImageUrl'] ??
              json['imageUrl'] ??
              json['logoUrl'] ??
              json['businessLogo'] ??
              json['shopImageUrl'],
        ),
      ),
      badgeName: _string(json['badgeName']) ?? 'Verified Vendor',
      badgeImageUrl: _resolveImage(_string(json['badgeImageUrl'])),
      location: locationParts.isEmpty
          ? 'Location not available'
          : locationParts.join(', '),
      address: address.isEmpty ? 'Address not available' : address,
    );
  }

  static const VendorDetails empty = VendorDetails(
    id: '',
    shopName: 'OnesOff Vendor',
    ownerName: '',
    imageUrl: AppImages.delhi,
    badgeName: 'Verified Vendor',
    badgeImageUrl: '',
    location: 'Location not available',
    address: 'Address not available',
  );

  static String _resolveImage(String? value) {
    if (value == null || value.isEmpty) return AppImages.delhi;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) return '${ApiEndpoints.baseUrl}$value';
    return value;
  }

  static String? _string(dynamic value) {
    if (value == null) return null;
    final String text = value.toString().trim();
    return text.isEmpty ? null : text;
  }
}

class VendorReviewSummary {
  const VendorReviewSummary({
    required this.totalReviews,
    required this.averageRating,
    required this.totalProductsReviewed,
    required this.ratingBreakdown,
  });

  final int totalReviews;
  final double averageRating;
  final int totalProductsReviewed;
  final Map<int, int> ratingBreakdown;

  factory VendorReviewSummary.fromJson(Map<String, dynamic> json) {
    return VendorReviewSummary(
      totalReviews: _int(json['totalReviews']),
      averageRating: _double(json['averageRating']),
      totalProductsReviewed: _int(json['totalProductsReviewed']),
      ratingBreakdown: _breakdown(json['ratingBreakdown']),
    );
  }

  static const VendorReviewSummary empty = VendorReviewSummary(
    totalReviews: 0,
    averageRating: 0,
    totalProductsReviewed: 0,
    ratingBreakdown: <int, int>{1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
  );

  static Map<int, int> _breakdown(dynamic value) {
    final Map<int, int> result = <int, int>{1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    if (value is Map) {
      for (final MapEntry<dynamic, dynamic> entry in value.entries) {
        final int? key = int.tryParse(entry.key.toString());
        if (key != null && key >= 1 && key <= 5) {
          result[key] = _int(entry.value);
        }
      }
    }
    return result;
  }

  static int _int(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static double _double(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class VendorReview {
  const VendorReview({
    required this.customerName,
    required this.comment,
    required this.rating,
    this.createdAt,
  });

  final String customerName;
  final String comment;
  final double rating;
  final DateTime? createdAt;

  factory VendorReview.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> customer = _asMap(json['customer']);
    return VendorReview(
      customerName:
          _string(customer['name'] ?? json['customerName']) ?? 'Customer',
      comment: _string(json['comment']) ?? 'No comment provided.',
      rating: _double(json['rating']),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  String get displayMonth {
    final DateTime? value = createdAt;
    if (value == null) return '';
    const List<String> months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[value.month - 1]} ${value.year}';
  }

  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  static String? _string(dynamic value) {
    if (value == null) return null;
    final String text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static double _double(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class VendorDetailsBundle {
  const VendorDetailsBundle({
    required this.vendor,
    required this.summary,
    required this.products,
    required this.reviews,
    required this.totalProducts,
  });

  final VendorDetails vendor;
  final VendorReviewSummary summary;
  final List<CustomerProduct> products;
  final List<VendorReview> reviews;
  final int totalProducts;
}
