import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:onesoff_customer/app/data/models/customer_order.dart';
import 'package:onesoff_customer/app/routes/app_routes.dart';
import 'package:onesoff_customer/app/screens/customer_section/orders/getx/customer_order_controller.dart';
import 'package:onesoff_customer/app/utils/device_constants/app_colors.dart';

class CustomerOrderHistoryScreen extends StatelessWidget {
  const CustomerOrderHistoryScreen({super.key});
  @override
  Widget build(BuildContext context) {
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
        title: const Text(
          'My Orders',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            tooltip: 'Refund details',
            onPressed: () => Get.toNamed(AppRoutes.customerRefundDetails),
            icon: const Icon(Icons.account_balance_wallet_outlined),
          ),
          IconButton(
            onPressed: controller.fetchOrders,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Obx(() {
        if (controller.isLoading.value && controller.orders.isEmpty)
          return const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          );
        if (controller.errorMessage.value != null && controller.orders.isEmpty)
          return _StateView(
            title: 'Could not load your orders',
            message: controller.errorMessage.value!,
            icon: Icons.cloud_off_rounded,
            onTap: controller.fetchOrders,
          );
        if (controller.orders.isEmpty)
          return _StateView(
            title: 'No bookings yet',
            message: 'Your paid rentals will appear here after checkout.',
            icon: Icons.shopping_bag_outlined,
            onTap: controller.fetchOrders,
          );
        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: controller.fetchOrders,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
            children: [
              _Banner(count: controller.orders.length),
              const SizedBox(height: 18),
              ...controller.orders.map((order) => _OrderCard(order: order)),
            ],
          ),
        );
      }),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.count});
  final int count;
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
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.white.withValues(alpha: .16),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.receipt_long_rounded,
            color: AppColors.white,
            size: 26,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your rental journey',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$count booking${count == 1 ? '' : 's'} • Track dates and refunds in one place',
                style: TextStyle(
                  color: AppColors.white.withValues(alpha: .78),
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final CustomerOrder order;
  @override
  Widget build(BuildContext context) {
    final CustomerOrderItem? item = order.items.isEmpty
        ? null
        : order.items.first;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.secondary.withValues(alpha: .38)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () =>
            Get.toNamed(AppRoutes.customerOrderDetail, arguments: order),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _OrderImage(url: item?.imageUrl ?? ''),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ORDER ${order.orderNo}',
                      style: const TextStyle(
                        color: AppColors.descriptionTextColor,
                        fontSize: 11,
                        letterSpacing: .8,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      item?.name ?? '${order.items.length} rental item(s)',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 5,
                      children: [
                        _StatusChip(status: order.paymentStatus),
                        if (item?.returnDueDate != null)
                          _DatePill(date: item!.returnDueDate!),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.arrow_forward_ios_rounded,
                color: AppColors.secondary,
                size: 16,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderImage extends StatelessWidget {
  const _OrderImage({required this.url});
  final String url;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(14),
    child: SizedBox(
      width: 78,
      height: 94,
      child: url.isEmpty
          ? const ColoredBox(
              color: AppColors.secondarySurface,
              child: Icon(
                Icons.shopping_bag_outlined,
                color: AppColors.primary,
                size: 28,
              ),
            )
          : Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const ColoredBox(
                color: AppColors.secondarySurface,
                child: Icon(
                  Icons.shopping_bag_outlined,
                  color: AppColors.primary,
                  size: 28,
                ),
              ),
            ),
    ),
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final bool refunded = status == 'REFUNDED';
    final bool pending = status == 'REFUND_PENDING';
    final Color color = refunded
        ? const Color(0xFF2E7D5B)
        : pending
        ? const Color(0xFFB26A00)
        : AppColors.primary;
    final Color background = refunded
        ? const Color(0xFFE7F4ED)
        : pending
        ? const Color(0xFFFFF1D9)
        : AppColors.secondarySurface;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _statusLabel(status),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _DatePill extends StatelessWidget {
  const _DatePill({required this.date});
  final DateTime date;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Icon(
        Icons.event_available_rounded,
        size: 14,
        color: AppColors.secondary,
      ),
      const SizedBox(width: 4),
      Text(
        'Return ${_date(date)}',
        style: const TextStyle(
          color: AppColors.descriptionTextColor,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

class _StateView extends StatelessWidget {
  const _StateView({
    required this.title,
    required this.message,
    required this.icon,
    required this.onTap,
  });
  final String title;
  final String message;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: AppColors.secondarySurface,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: AppColors.primary, size: 42),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.descriptionTextColor,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: onTap,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Refresh'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

String _statusLabel(String status) => switch (status) {
  'PAID' => 'Paid / Booked',
  'REFUND_PENDING' => 'Refund pending',
  'REFUNDED' => 'Refunded',
  _ => status,
};
String _date(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
