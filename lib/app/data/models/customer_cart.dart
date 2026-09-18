import 'package:onesoff_customer/app/data/api/api_endpoints.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_images.dart';

class CustomerCartItem {
  const CustomerCartItem({
    required this.cartItemId,
    required this.productId,
    required this.variantId,
    required this.name,
    required this.description,
    required this.imageUrl,
    required this.rentalPrice,
    required this.securityDepositPerDay,
    required this.rentalDays,
    required this.startDate,
    required this.endDate,
    required this.size,
    required this.gender,
    required this.color,
    required this.sku,
    required this.shopName,
    required this.shopLocation,
    this.alteration = 'No',
  });

  final String cartItemId;
  final String productId;
  final String variantId;
  final String name;
  final String description;
  final String imageUrl;
  final num rentalPrice;
  final num securityDepositPerDay;
  final int rentalDays;
  final DateTime startDate;
  final DateTime endDate;
  final String size;
  final String gender;
  final String color;
  final String sku;
  final String shopName;
  final String shopLocation;
  final String alteration;

  factory CustomerCartItem.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> product = _asMap(json['product']);
    final Map<String, dynamic> variant = _asMap(json['variant']);
    final Map<String, dynamic> vendor = _asMap(product['vendor']);
    final DateTime startDate =
        _date(json['issueDate'] ?? json['startDate']) ?? DateTime.now();
    final DateTime endDate =
        _date(json['returnDate'] ?? json['endDate']) ??
        startDate.add(Duration(days: _periodDays(json['rentalPeriod']) - 1));

    return CustomerCartItem(
      cartItemId: _string(json['id'] ?? json['cartItemId']) ?? '',
      productId: _string(json['productId'] ?? product['id']) ?? '',
      variantId: _string(json['variantId'] ?? variant['id']) ?? '',
      name: _string(product['name'] ?? json['name']) ?? 'OnesOff outfit',
      description:
          _string(
            product['shortDescription'] ??
                product['description'] ??
                json['description'],
          ) ??
          'Premium rental outfit with quality checked finishing.',
      imageUrl: _image(json, product),
      rentalPrice: _num(product['rentalPrice'] ?? product['rentPrice']) ?? 0,
      securityDepositPerDay: _num(product['securityDeposit']) ?? 0,
      rentalDays: _daysBetween(startDate, endDate).clamp(1, 365).toInt(),
      startDate: startDate,
      endDate: endDate,
      size: _string(json['size'] ?? variant['size']) ?? 'Free Size',
      gender: _string(product['gender'] ?? json['gender']) ?? 'N/A',
      color: _string(json['color'] ?? variant['color']) ?? 'N/A',
      sku: _string(variant['sku'] ?? product['sku'] ?? json['sku']) ?? '-',
      shopName:
          _string(
            vendor['shopName'] ?? vendor['ownerName'] ?? json['shopName'],
          ) ??
          'Vendor',
      shopLocation: _location(vendor),
      alteration: json['alterationRequired'] == true ? 'Yes' : 'No',
    );
  }

  int get rentalTotal => (rentalPrice * rentalDays).round();
  int get depositTotal => (securityDepositPerDay * rentalDays).round();

  String get issueDate => _displayDate(startDate);
  String get returnDate => _displayDate(endDate);
  String get issueDateIso => _isoDate(startDate);
  String get returnDateIso => _isoDate(endDate);
  String get rentalPeriodLabel => '$rentalDays Days';

  Map<String, dynamic> toCartPayload() => <String, dynamic>{
    'productId': productId,
    if (variantId.isNotEmpty) 'variantId': variantId,
    'quantity': 1,
    'rentalPeriod': rentalPeriodLabel,
    'issueDate': issueDateIso,
    'returnDate': returnDateIso,
    'size': size,
    'color': color,
    'imageUrl': imageUrl,
    'alterationRequired': alteration.toLowerCase() == 'yes',
  };

  Map<String, dynamic> toCheckoutPayload() => <String, dynamic>{
    'productId': productId,
    'variantId': variantId,
    'quantity': 1,
    'rentalPeriod': rentalPeriodLabel,
    'issueDate': issueDateIso,
    'returnDate': returnDateIso,
    'startDate': issueDateIso,
    'endDate': returnDateIso,
    'size': size,
    'color': color,
    'imageUrl': imageUrl,
    'alterationRequired': alteration.toLowerCase() == 'yes',
  };

  CustomerCartItem copyWith({String? cartItemId}) {
    return CustomerCartItem(
      cartItemId: cartItemId ?? this.cartItemId,
      productId: productId,
      variantId: variantId,
      name: name,
      description: description,
      imageUrl: imageUrl,
      rentalPrice: rentalPrice,
      securityDepositPerDay: securityDepositPerDay,
      rentalDays: rentalDays,
      startDate: startDate,
      endDate: endDate,
      size: size,
      gender: gender,
      color: color,
      sku: sku,
      shopName: shopName,
      shopLocation: shopLocation,
      alteration: alteration,
    );
  }

  static String _location(Map<String, dynamic> vendor) {
    final List<String> parts = <String>[
      if (_string(vendor['address']) != null) _string(vendor['address'])!,
      if (_string(vendor['city']) != null) _string(vendor['city'])!,
      if (_string(vendor['state']) != null) _string(vendor['state'])!,
    ];
    return parts.isEmpty ? 'N/A' : parts.join(', ');
  }

  static String _image(
    Map<String, dynamic> json,
    Map<String, dynamic> product,
  ) {
    final String? metaImage = _string(json['imageUrl']);
    if (metaImage != null) return _resolveUrl(metaImage);

    final dynamic images = product['images'];
    if (images is List && images.isNotEmpty) {
      final dynamic first = images.first;
      if (first is String) return _resolveUrl(first);
      final Map<String, dynamic> imageMap = _asMap(first);
      final String? url = _string(imageMap['imageUrl'] ?? imageMap['url']);
      if (url != null) return _resolveUrl(url);
    }
    return AppImages.womensWear_1;
  }

  static DateTime? _date(dynamic value) {
    final String? text = _string(value);
    if (text == null) return null;
    final List<String> parts = text.split('-');
    if (parts.length == 3) {
      final bool isIso = parts.first.length == 4;
      final int? year = int.tryParse(isIso ? parts[0] : parts[2]);
      final int? month = int.tryParse(parts[1]);
      final int? day = int.tryParse(isIso ? parts[2] : parts[0]);
      if (year != null && month != null && day != null) {
        return DateTime(year, month, day);
      }
    }
    return DateTime.tryParse(text);
  }

  static int _periodDays(dynamic value) {
    final String text = value?.toString() ?? '';
    return int.tryParse(RegExp(r'\d+').firstMatch(text)?.group(0) ?? '') ?? 1;
  }

  static int _daysBetween(DateTime startDate, DateTime endDate) =>
      endDate.difference(startDate).inDays + 1;

  static String _displayDate(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}-${value.month.toString().padLeft(2, '0')}-${value.year}';

  static String _isoDate(DateTime value) =>
      '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';

  static String _resolveUrl(String value) {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) return '${ApiEndpoints.baseUrl}$value';
    return value;
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

  static num? _num(dynamic value) {
    if (value is num) return value;
    if (value == null) return null;
    return num.tryParse(value.toString());
  }
}

class WelcomeCoupon {
  const WelcomeCoupon({
    required this.id,
    required this.code,
    required this.discountType,
    required this.discountValue,
  });

  final String id;
  final String code;
  final String discountType;
  final num discountValue;

  factory WelcomeCoupon.fromJson(Map<String, dynamic> json) {
    return WelcomeCoupon(
      id: _string(json['id']) ?? '',
      code: _string(json['code']) ?? '',
      discountType: _string(json['discountType'] ?? json['type']) ?? 'FLAT',
      discountValue: _num(json['discountValue'] ?? json['value']) ?? 0,
    );
  }

  String get title {
    if (discountType.toUpperCase() == 'PERCENT') {
      return '$code - ${discountValue.round()}% off';
    }
    return '$code - Rs. ${discountValue.round()} off';
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

class CouponValidation {
  const CouponValidation({
    required this.couponCode,
    required this.discount,
    required this.finalOrderValue,
  });

  final String couponCode;
  final num discount;
  final num finalOrderValue;

  factory CouponValidation.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> coupon = CustomerCartItem._asMap(json['coupon']);
    return CouponValidation(
      couponCode:
          WelcomeCoupon._string(coupon['code'] ?? json['couponCode']) ?? '',
      discount: WelcomeCoupon._num(json['discount']) ?? 0,
      finalOrderValue: WelcomeCoupon._num(json['finalOrderValue']) ?? 0,
    );
  }
}

class RazorpayInitResult {
  const RazorpayInitResult({
    required this.internalOrderId,
    required this.razorpayOrderId,
    required this.amount,
    required this.currency,
    required this.keyId,
  });

  final String internalOrderId;
  final String razorpayOrderId;
  final num amount;
  final String currency;
  final String keyId;

  factory RazorpayInitResult.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> order = CustomerCartItem._asMap(json['order']);
    final Map<String, dynamic> razorpay = CustomerCartItem._asMap(
      json['razorpay'],
    );
    return RazorpayInitResult(
      internalOrderId:
          WelcomeCoupon._string(order['id'] ?? json['internalOrderId']) ?? '',
      razorpayOrderId:
          WelcomeCoupon._string(
            razorpay['orderId'] ?? json['razorpayOrderId'],
          ) ??
          '',
      amount: WelcomeCoupon._num(razorpay['amount'] ?? json['amount']) ?? 0,
      currency:
          WelcomeCoupon._string(razorpay['currency'] ?? json['currency']) ??
          'INR',
      keyId: WelcomeCoupon._string(razorpay['keyId'] ?? json['keyId']) ?? '',
    );
  }
}
