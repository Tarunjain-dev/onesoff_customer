import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';

class CustomerProduct {
  const CustomerProduct({
    required this.id,
    required this.name,
    required this.description,
    required this.imageUrl,
    required this.rentPrice,
    this.gender,
    this.category,
  });

  final String id;
  final String name;
  final String description;
  final String imageUrl;
  final num rentPrice;
  final String? gender;
  final String? category;

  factory CustomerProduct.fromJson(Map<String, dynamic> json) {
    return CustomerProduct(
      id: _string(json['id'] ?? json['productId']) ?? '',
      name: _string(json['name'] ?? json['title']) ?? 'OnesOff outfit',
      description:
          _string(
            json['shortDescription'] ??
                json['description'] ??
                json['productDescription'],
          ) ??
          'Premium rental outfit with quality checked finishing.',
      imageUrl: _extractImage(json),
      rentPrice: _price(json),
      gender: _string(json['gender']),
      category: _string(
        json['categoryName'] ?? _asMap(json['category'])?['name'],
      ),
    );
  }

  String get rentLabel {
    final int price = rentPrice.round();
    if (price <= 0) return 'Rs.3999/day';
    return 'Rs.$price/day';
  }

  bool get hasNetworkImage =>
      imageUrl.startsWith('http://') || imageUrl.startsWith('https://');

  static String? _string(dynamic value) {
    if (value == null) return null;
    final String text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  static String _extractImage(Map<String, dynamic> json) {
    final dynamic direct =
        json['imageUrl'] ??
        json['image'] ??
        json['thumbnail'] ??
        json['coverImage'];
    final String? directImage = _string(direct);
    if (directImage != null) return _resolveImageUrl(directImage);

    final dynamic images = json['images'];
    if (images is List && images.isNotEmpty) {
      final dynamic first = images.first;
      if (first is String && first.trim().isNotEmpty) {
        return _resolveImageUrl(first.trim());
      }
      final Map<String, dynamic>? imageMap = _asMap(first);
      final String? nested = _string(
        imageMap?['url'] ??
            imageMap?['imageUrl'] ??
            imageMap?['path'] ??
            imageMap?['src'],
      );
      if (nested != null) return _resolveImageUrl(nested);
    }

    return AppImages.womensWear_1;
  }

  static String _resolveImageUrl(String value) {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) return '${ApiEndpoints.baseUrl}$value';
    return value;
  }

  static num _price(Map<String, dynamic> json) {
    final dynamic direct =
        json['rentPrice'] ??
        json['rentalPrice'] ??
        json['price'] ??
        json['rentPerDay'] ??
        json['baseRentalPrice'];
    final num? directPrice = _num(direct);
    if (directPrice != null) return directPrice;

    final dynamic variants = json['variants'];
    if (variants is List && variants.isNotEmpty) {
      for (final dynamic variant in variants) {
        final Map<String, dynamic>? map = _asMap(variant);
        final num? value = _num(
          map?['rentPrice'] ??
              map?['rentalPrice'] ??
              map?['price'] ??
              map?['rentPerDay'],
        );
        if (value != null) return value;
      }
    }

    return 3999;
  }

  static num? _num(dynamic value) {
    if (value is num) return value;
    if (value == null) return null;
    return num.tryParse(value.toString());
  }
}
