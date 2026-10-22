class CustomerOrder {
  const CustomerOrder({
    required this.id,
    required this.orderNo,
    required this.finalPayable,
    required this.refundAmount,
    required this.paymentStatus,
    required this.createdAt,
    required this.items,
  });

  final String id;
  final String orderNo;
  final num finalPayable;
  final num refundAmount;
  final String paymentStatus;
  final DateTime? createdAt;
  final List<CustomerOrderItem> items;

  bool get isRefundPending => paymentStatus == 'REFUND_PENDING';
  bool get isRefunded => paymentStatus == 'REFUNDED';
  bool get canCancel =>
      paymentStatus == 'PAID' &&
      items.isNotEmpty &&
      items
          .where(
            (item) => !const {
              'CANCELLED',
              'REJECTED',
              'COMPLETED',
            }.contains(item.status),
          )
          .isNotEmpty &&
      items
          .where(
            (item) => !const {
              'CANCELLED',
              'REJECTED',
              'COMPLETED',
            }.contains(item.status),
          )
          .every((item) => item.canCancel);

  factory CustomerOrder.fromJson(Map<String, dynamic> json) {
    final dynamic rawItems = json['items'];
    return CustomerOrder(
      id: _text(json['id']) ?? '',
      orderNo: _text(json['orderNo']) ?? _text(json['id']) ?? '-',
      finalPayable: _number(json['finalPayable'] ?? json['amount']),
      refundAmount: _number(json['refundAmount']),
      paymentStatus: (_text(json['paymentStatus']) ?? 'UNPAID').toUpperCase(),
      createdAt: _date(json['createdAt']),
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) => CustomerOrderItem.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
          : const <CustomerOrderItem>[],
    );
  }
}

class CustomerOrderItem {
  const CustomerOrderItem({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.status,
    required this.rentPrice,
    required this.deposit,
    required this.startDate,
    required this.returnDueDate,
    required this.securityDepositRefunded,
  });

  final String id;
  final String name;
  final String imageUrl;
  final String status;
  final num rentPrice;
  final num deposit;
  final DateTime? startDate;
  final DateTime? returnDueDate;
  final num securityDepositRefunded;

  bool get canCancel => const <String>{
    'PLACED',
    'BOOKED',
    'RENTAL_CONFIRMED',
    'ACCEPTED',
    'READY_FOR_PICKUP',
  }.contains(status);

  num get refundAmount => securityDepositRefunded;

  factory CustomerOrderItem.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> product = _map(json['product']);
    final dynamic images = product['images'];
    final String imageUrl = images is List && images.isNotEmpty
        ? (_text(_map(images.first)['imageUrl']) ?? '')
        : (_text(json['imageUrl']) ?? '');
    return CustomerOrderItem(
      id: _text(json['id']) ?? '',
      name: _text(product['name'] ?? json['name']) ?? 'Rental item',
      imageUrl: imageUrl,
      status: (_text(json['status']) ?? 'PLACED').toUpperCase(),
      rentPrice: _number(json['rentPrice']),
      deposit: _number(json['deposit']),
      startDate: _date(json['rentalStartDate'] ?? json['startDate']),
      returnDueDate: _date(json['returnDueDate'] ?? json['endDate']),
      securityDepositRefunded: _number(json['securityDepositRefunded']),
    );
  }
}

Map<String, dynamic> _map(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

String? _text(dynamic value) {
  if (value == null) return null;
  final String result = value.toString().trim();
  return result.isEmpty ? null : result;
}

num _number(dynamic value) => num.tryParse(value?.toString() ?? '') ?? 0;

DateTime? _date(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}
