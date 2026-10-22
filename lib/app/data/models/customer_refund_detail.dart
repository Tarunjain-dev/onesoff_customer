class CustomerRefundDetail {
  const CustomerRefundDetail({
    required this.orderNo,
    required this.productName,
    required this.status,
    required this.finalRefundAmount,
    required this.deductionAmount,
    required this.transferReference,
  });
  final String orderNo;
  final String productName;
  final String status;
  final num finalRefundAmount;
  final num deductionAmount;
  final String? transferReference;

  factory CustomerRefundDetail.fromJson(Map<String, dynamic> json) =>
      CustomerRefundDetail(
        orderNo: json['orderNo']?.toString() ?? '-',
        productName: json['productName']?.toString() ?? 'Rental item',
        status:
            json['refundSummaryStatus']?.toString() ??
            json['status']?.toString() ??
            '-',
        finalRefundAmount:
            num.tryParse(json['finalRefundAmount']?.toString() ?? '') ?? 0,
        deductionAmount:
            num.tryParse(json['totalDeductionAmount']?.toString() ?? '') ?? 0,
        transferReference: json['refundTransferReference']?.toString(),
      );
}
