import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/data/models/customer_product.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';

class ProductDetail {
  const ProductDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.images,
    required this.rentalPrice,
    required this.securityDeposit,
    required this.rentingPeriods,
    required this.variants,
    required this.specifications,
    this.sku,
    this.vendor,
    this.gender,
    this.category,
  });

  final String id;
  final String name;
  final String description;
  final List<String> images;
  final num rentalPrice;
  final num securityDeposit;
  final List<int> rentingPeriods;
  final List<ProductVariant> variants;
  final List<ProductSpecification> specifications;
  final String? sku;
  final ProductVendor? vendor;
  final String? gender;
  final String? category;

  factory ProductDetail.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> details =
        _asMap(json['productDetailsFull']) ?? <String, dynamic>{};
    final List<ProductVariant> variants = _list(
      json['variants'],
    ).map(ProductVariant.fromJson).toList();
    final List<ProductSpecification> specs = _list(
      details['specifications'],
    ).map(ProductSpecification.fromJson).toList();

    return ProductDetail(
      id: _string(json['id'] ?? json['productId']) ?? '',
      name: _string(json['name']) ?? 'OnesOff outfit',
      description:
          _string(json['shortDescription'] ?? json['description']) ??
          'Premium rental outfit with quality checked finishing.',
      images: _images(json),
      rentalPrice:
          _num(json['rentalPrice'] ?? json['rentPrice'] ?? json['price']) ?? 0,
      securityDeposit: _num(json['securityDeposit']) ?? 0,
      rentingPeriods: _rentingPeriods(details['rentingPeriods']),
      variants: variants,
      specifications: specs,
      sku: variants.isNotEmpty ? variants.first.sku : _string(json['sku']),
      vendor: ProductVendor.fromJson(_asMap(json['vendor'])),
      gender: _string(json['gender']),
      category: _string(
        json['categoryName'] ?? _asMap(json['category'])?['name'],
      ),
    );
  }

  String get primaryImage =>
      images.isEmpty ? AppImages.womensWear_1 : images.first;

  ProductVariant? variantAt(int index) {
    if (variants.isEmpty) return null;
    final int safeIndex = index.clamp(0, variants.length - 1);
    return variants[safeIndex];
  }

  int periodAt(int index) {
    if (rentingPeriods.isEmpty) return 3;
    return rentingPeriods[index.clamp(0, rentingPeriods.length - 1)];
  }

  String rentLabel(int periodDays) =>
      'Rent Price : Rs. ${(rentalPrice * periodDays).round()}';

  num get securityDepositPerDay =>
      securityDeposit > 0 ? securityDeposit : rentalPrice * 0.8;

  String securityDepositLabel(int periodDays) {
    final num total = securityDepositPerDay * periodDays;
    return 'Security Deposit: Rs. ${total.round()} for $periodDays days';
  }

  CustomerProduct toCustomerProduct() {
    return CustomerProduct(
      id: id,
      name: name,
      description: description,
      imageUrl: primaryImage,
      rentPrice: rentalPrice,
      gender: gender,
      category: category,
    );
  }

  static List<String> _images(Map<String, dynamic> json) {
    final List<String> values = <String>[];
    for (final dynamic item in _rawList(json['images'])) {
      final String? url = item is String
          ? _string(item)
          : _string(_asMap(item)?['imageUrl'] ?? _asMap(item)?['url']);
      if (url != null) values.add(_resolveUrl(url));
    }
    final String? direct = _string(json['imageUrl'] ?? json['image']);
    if (direct != null) values.insert(0, _resolveUrl(direct));
    return values.isEmpty
        ? <String>[AppImages.womensWear_1]
        : values.take(4).toList();
  }

  static List<int> _rentingPeriods(dynamic value) {
    final List<int> periods = _rawList(value)
        .map((dynamic item) => int.tryParse(item.toString()))
        .whereType<int>()
        .where((int item) => item > 0)
        .toSet()
        .toList();
    return periods.isEmpty ? <int>[3, 5, 7, 10] : periods;
  }

  static String _resolveUrl(String value) {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) return '${ApiEndpoints.baseUrl}$value';
    return value;
  }

  static List<Map<String, dynamic>> _list(dynamic value) => _rawList(value)
      .whereType<Map<dynamic, dynamic>>()
      .map((Map<dynamic, dynamic> item) => Map<String, dynamic>.from(item))
      .toList();

  static List<dynamic> _rawList(dynamic value) =>
      value is List ? value : <dynamic>[];
  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  static String? _string(dynamic value) {
    if (value == null) return null;
    final String text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static num? _num(dynamic value) {
    if (value is num) return value;
    if (value == null) return null;
    return num.tryParse(value.toString());
  }
}

class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.size,
    this.color,
    this.sku,
    this.quantity,
  });

  final String id;
  final String size;
  final String? color;
  final String? sku;
  final int? quantity;

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    final String sizeText = ProductDetail._string(json['size']) ?? 'Free Size';
    return ProductVariant(
      id: ProductDetail._string(json['id'] ?? json['variantId']) ?? '',
      size: sizeText,
      color: ProductDetail._string(json['color']),
      sku: ProductDetail._string(json['sku']),
      quantity: int.tryParse((json['quantity'] ?? '').toString()),
    );
  }
}

class ProductSpecification {
  const ProductSpecification({required this.label, required this.value});

  final String label;
  final String value;

  factory ProductSpecification.fromJson(Map<String, dynamic> json) {
    return ProductSpecification(
      label: ProductDetail._string(json['label']) ?? 'Specification',
      value: ProductDetail._string(json['value']) ?? '',
    );
  }
}

class ProductVendor {
  const ProductVendor({
    this.id,
    this.name,
    this.location,
    this.badgeName,
    this.imageUrl,
  });

  final String? id;
  final String? name;
  final String? location;
  final String? badgeName;
  final String? imageUrl;

  factory ProductVendor.fromJson(Map<String, dynamic>? json) {
    if (json == null || json.isEmpty) return const ProductVendor();
    final List<String> locationParts = <String>[
      if (ProductDetail._string(json['address']) != null)
        ProductDetail._string(json['address'])!,
      if (ProductDetail._string(json['city']) != null)
        ProductDetail._string(json['city'])!,
      if (ProductDetail._string(json['state']) != null)
        ProductDetail._string(json['state'])!,
    ];
    final Map<String, dynamic>? badge = ProductDetail._asMap(
      json['currentBadgeAssignment'],
    );
    return ProductVendor(
      id: ProductDetail._string(json['id'] ?? json['userId']),
      name:
          ProductDetail._string(json['shopName'] ?? json['businessName']) ??
          ProductDetail._string(ProductDetail._asMap(json['user'])?['name']),
      location: locationParts.isEmpty ? null : locationParts.join(', '),
      badgeName:
          ProductDetail._string(json['badgeName']) ??
          ProductDetail._string(
            ProductDetail._asMap(badge?['badgeRule'])?['name'],
          ),
      imageUrl: ProductDetail._string(json['profileImageUrl']),
    );
  }
}

class ProductAvailabilityCalendar {
  const ProductAvailabilityCalendar({required this.unavailableDates});

  final Set<String> unavailableDates;

  factory ProductAvailabilityCalendar.fromJson(Map<String, dynamic> json) {
    final Set<String> dates = <String>{};
    final Map<String, dynamic>? dateGroups = ProductDetail._asMap(
      json['dates'],
    );
    for (final String key in <String>[
      'booked',
      'blocked',
      'maintenance',
      'fullyBooked',
    ]) {
      for (final dynamic value in ProductDetail._rawList(dateGroups?[key])) {
        final String text = value.toString();
        if (text.length >= 10) dates.add(text.substring(0, 10));
      }
    }
    for (final dynamic item in ProductDetail._rawList(json['calendar'])) {
      final Map<String, dynamic>? map = ProductDetail._asMap(item);
      final String status =
          ProductDetail._string(map?['status'])?.toLowerCase() ?? '';
      final String? date = ProductDetail._string(map?['date']);
      if (date != null &&
          (status.contains('book') ||
              status.contains('block') ||
              status.contains('maintenance') ||
              status.contains('unavailable'))) {
        dates.add(date.substring(0, 10));
      }
    }
    return ProductAvailabilityCalendar(unavailableDates: dates);
  }
}

class ProductReviewsResult {
  const ProductReviewsResult({
    required this.averageRating,
    required this.totalReviews,
    required this.reviews,
  });

  final num averageRating;
  final int totalReviews;
  final List<ProductReview> reviews;

  factory ProductReviewsResult.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? summary = ProductDetail._asMap(json['summary']);
    return ProductReviewsResult(
      averageRating: ProductDetail._num(summary?['averageRating']) ?? 0,
      totalReviews:
          int.tryParse(
            (summary?['totalReviews'] ?? json['totalReviews'] ?? 0).toString(),
          ) ??
          0,
      reviews: ProductDetail._list(
        json['reviews'],
      ).map(ProductReview.fromJson).toList(),
    );
  }
}

class ProductReview {
  const ProductReview({
    required this.customerName,
    required this.comment,
    required this.rating,
    this.createdAt,
  });

  final String customerName;
  final String comment;
  final num rating;
  final DateTime? createdAt;

  factory ProductReview.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? customer = ProductDetail._asMap(
      json['customer'],
    );
    return ProductReview(
      customerName: ProductDetail._string(customer?['name']) ?? 'Customer',
      comment: ProductDetail._string(json['comment']) ?? '',
      rating: ProductDetail._num(json['rating']) ?? 0,
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
    );
  }
}
