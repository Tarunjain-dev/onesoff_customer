import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_refund_detail.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_order_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';

class CustomerRefundDetailsScreen extends StatelessWidget {
  const CustomerRefundDetailsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final CustomerOrderController controller =
        Get.find<CustomerOrderController>();
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        title: const Text(
          'Refund Details',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: controller.fetchRefundDetails,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Obx(
        () => controller.refundDetails.isEmpty
            ? const Center(
                child: Text(
                  'No processed refund details yet.',
                  style: TextStyle(color: AppColors.descriptionTextColor),
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: controller.refundDetails.length,
                itemBuilder: (_, index) =>
                    _RefundCard(detail: controller.refundDetails[index]),
              ),
      ),
    );
  }
}

class _RefundCard extends StatelessWidget {
  const _RefundCard({required this.detail});
  final CustomerRefundDetail detail;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 14),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.secondary.withValues(alpha: .35)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          detail.productName,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          'Order ${detail.orderNo}',
          style: const TextStyle(
            color: AppColors.descriptionTextColor,
            fontSize: 12,
          ),
        ),
        const Divider(height: 24),
        Text(
          detail.status,
          style: const TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Final refund: ₹${detail.finalRefundAmount.toStringAsFixed(2)}',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
        ),
        if (detail.deductionAmount > 0)
          Text(
            'Total deductions: ₹${detail.deductionAmount.toStringAsFixed(2)}',
            style: const TextStyle(color: AppColors.descriptionTextColor),
          ),
        if (detail.transferReference?.isNotEmpty == true)
          Text(
            'Reference: ${detail.transferReference}',
            style: const TextStyle(
              color: AppColors.descriptionTextColor,
              fontSize: 12,
            ),
          ),
      ],
    ),
  );
}
