class CustomerProfile {
  const CustomerProfile({
    this.id,
    this.name,
    this.phone,
    this.email,
    this.role,
    this.status,
    this.createdAt,
    this.aadharNumber,
    this.addressLine1,
    this.landmark,
    this.pincode,
    this.city,
    this.state,
    this.additionalInfo,
  });

  final String? id;
  final String? name;
  final String? phone;
  final String? email;
  final String? role;
  final String? status;
  final DateTime? createdAt;
  final String? aadharNumber;
  final String? addressLine1;
  final String? landmark;
  final String? pincode;
  final String? city;
  final String? state;
  final String? additionalInfo;

  factory CustomerProfile.fromJson(Map<String, dynamic> json) {
    return CustomerProfile(
      id: _string(json['id']),
      name: _string(json['name']),
      phone: _string(json['phone']),
      email: _string(json['email']),
      role: _string(json['role']),
      status: _string(json['status']),
      createdAt: _date(json['createdAt']),
      aadharNumber: _string(json['aadharNumber']),
      addressLine1: _string(json['addressLine1']),
      landmark: _string(json['landmark']),
      pincode: _string(json['pincode']),
      city: _string(json['city']),
      state: _string(json['state']),
      additionalInfo: _string(json['additionalInfo']),
    );
  }

  String get displayName =>
      name?.trim().isNotEmpty == true ? name!.trim() : 'Customer';

  String get displayPhone {
    final String digits = phone?.replaceAll(RegExp(r'[^0-9]'), '') ?? '';
    if (digits.isEmpty) return 'Phone number not added';
    final String national = digits.length >= 10
        ? digits.substring(digits.length - 10)
        : digits;
    return '+91$national';
  }

  String get initials {
    final List<String> parts = displayName
        .split(RegExp(r'\s+'))
        .where((String part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'CU';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String get deliveryLocation {
    final List<String> parts = <String>[
      if (addressLine1?.trim().isNotEmpty == true) addressLine1!.trim(),
      if (landmark?.trim().isNotEmpty == true) landmark!.trim(),
      if (city?.trim().isNotEmpty == true) city!.trim(),
      if (state?.trim().isNotEmpty == true) state!.trim(),
      if (pincode?.trim().isNotEmpty == true) pincode!.trim(),
    ];
    return parts.isEmpty ? 'Delivery location not added' : parts.join(', ');
  }

  String get memberSince {
    final DateTime? value = createdAt;
    if (value == null) return 'Active Member';
    const List<String> months = <String>[
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return 'Active Member since ${months[value.month - 1]} ${value.year}';
  }

  static String? _string(dynamic value) {
    if (value == null) return null;
    final String text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static DateTime? _date(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse(value.toString());
  }
}
