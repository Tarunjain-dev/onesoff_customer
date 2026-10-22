import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_order.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_order_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';

class CustomerOrderDetailScreen extends StatelessWidget {
  const CustomerOrderDetailScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final CustomerOrder order = Get.arguments as CustomerOrder;
    final CustomerOrderController controller =
        Get.find<CustomerOrderController>();
    final bool dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: dark
          ? AppColors.scaffoldBackgroundColorDark
          : AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        elevation: 0,
        title: Text(
          'Order ${order.orderNo}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
        children: [
          _SummaryCard(order: order),
          const SizedBox(height: 18),
          const _SectionTitle(
            title: 'Rental items',
            icon: Icons.checkroom_rounded,
          ),
          const SizedBox(height: 10),
          ...order.items.map((item) => _ItemCard(item: item)),
          if (order.canCancel) ...[
            const SizedBox(height: 8),
            Obx(
              () => _CancelButton(
                loading: controller.cancellingOrderId.value == order.id,
                onPressed: () => _confirmCancel(context, controller, order),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'You can cancel while the booking is being prepared. Refunds are processed after cancellation approval.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.descriptionTextColor,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmCancel(
    BuildContext context,
    CustomerOrderController controller,
    CustomerOrder order,
  ) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Cancel this booking?',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        content: Text(
          'Your payment of ₹${order.finalPayable.toStringAsFixed(2)} will be sent for refund processing.',
          style: const TextStyle(height: 1.35),
        ),
        actions: [
          TextButton(
            onPressed: () => Get.back(result: false),
            child: const Text('Keep booking'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Get.back(result: true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (confirmed == true && await controller.cancelOrder(order)) Get.back();
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.order});
  final CustomerOrder order;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppColors.primary, Color(0xFF8B4056)],
      ),
      borderRadius: BorderRadius.circular(20),
      boxShadow: const [
        BoxShadow(
          color: AppColors.shadow,
          blurRadius: 12,
          offset: Offset(0, 5),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.verified_rounded, color: AppColors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _statusLabel(order.paymentStatus),
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: _Value(
                label: 'Paid amount',
                value: '₹${order.finalPayable.toStringAsFixed(2)}',
              ),
            ),
            if (order.isRefunded)
              Expanded(
                child: _Value(
                  label: 'Refunded',
                  value: '₹${order.refundAmount.toStringAsFixed(2)}',
                ),
              ),
            if (order.isRefundPending)
              const Expanded(
                child: _Value(label: 'Refund', value: 'Processing'),
              ),
          ],
        ),
        if (order.isRefundPending) ...[
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.white.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Cancellation submitted. This card will update when the refund is processed.',
              style: TextStyle(
                color: AppColors.white,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

class _Value extends StatelessWidget {
  const _Value({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(
          color: AppColors.white.withValues(alpha: .70),
          fontSize: 11,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        value,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 17,
          fontWeight: FontWeight.w800,
        ),
      ),
    ],
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.icon});
  final String title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: AppColors.primary, size: 20),
      const SizedBox(width: 8),
      Text(
        title,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w800,
        ),
      ),
    ],
  );
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item});
  final CustomerOrderItem item;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Theme.of(context).cardColor,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: AppColors.secondary.withValues(alpha: .35)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D000000),
          blurRadius: 8,
          offset: Offset(0, 3),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            _Status(status: item.status),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: _DateBox(
                label: 'Rental starts',
                value: item.startDate == null
                    ? 'Not set'
                    : _date(item.startDate!),
                icon: Icons.calendar_month_rounded,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _DateBox(
                label: 'Return by',
                value: item.returnDueDate == null
                    ? 'Not set'
                    : _date(item.returnDueDate!),
                icon: Icons.event_available_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.secondarySurface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Rental ₹${item.rentPrice.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                'Deposit ₹${item.deposit.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        if (item.securityDepositRefunded > 0) ...[
          const SizedBox(height: 10),
          Text(
            '✓ Deposit refunded: ₹${item.securityDepositRefunded.toStringAsFixed(2)}',
            style: const TextStyle(
              color: Color(0xFF2E7D5B),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    ),
  );
}

class _DateBox extends StatelessWidget {
  const _DateBox({
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label;
  final String value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(11),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.secondary.withValues(alpha: .25)),
    ),
    child: Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.descriptionTextColor,
                  fontSize: 10,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _Status extends StatelessWidget {
  const _Status({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: AppColors.secondarySurface,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      status.replaceAll('_', ' '),
      style: const TextStyle(
        color: AppColors.primary,
        fontSize: 10,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _CancelButton extends StatelessWidget {
  const _CancelButton({required this.loading, required this.onPressed});
  final bool loading;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    height: 52,
    child: FilledButton.icon(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      onPressed: loading ? null : onPressed,
      icon: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.white,
              ),
            )
          : const Icon(Icons.close_rounded),
      label: Text(
        loading ? 'Cancelling booking...' : 'Cancel booking',
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
  );
}

String _statusLabel(String status) => switch (status) {
  'PAID' => 'Paid / Booked',
  'REFUND_PENDING' => 'Cancellation • Refund pending',
  'REFUNDED' => 'Refund completed',
  _ => status,
};
String _date(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
