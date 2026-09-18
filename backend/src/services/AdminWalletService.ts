import prisma from '../config/db';
import { OrderItemStatus } from '@prisma/client';
import { CommissionService } from './CommissionService';

export const AdminWalletService = {
  async getWalletOverview() {
    const [heldDeposits, pendingRefunds, totalPaid, totalRefunded, vendorGrossRows, completedSettlementRows] = await Promise.all([
      prisma.orderItem.aggregate({
        where: {
          status: {
            in: [
              'PLACED',
              'BOOKED',
              'RENTAL_CONFIRMED',
              'ACCEPTED',
              'READY_FOR_PICKUP',
              'PICKED_UP',
              'OUT_FOR_DELIVERY',
              'DISPATCHED',
              'DELIVERED'
            ]
          }
        },
        _sum: { deposit: true }
      }),
      prisma.orderItem.aggregate({
        where: {
          status: {
            in: [
              'RETURN_SCHEDULED',
              'RETURNED',
              'DAMAGE_REVIEW',
              'RETURN_REQUESTED',
              'RETURN_RECEIVED'
            ]
          }
        },
        _sum: { deposit: true }
      }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'REFUNDED' }, _sum: { amount: true } }),
      prisma.orderItem.groupBy({
        by: ['vendorId'],
        where: {
          order: { paymentStatus: 'PAID' },
          status: {
            notIn: [OrderItemStatus.CANCELLED, OrderItemStatus.REJECTED]
          }
        },
        _sum: { rentPrice: true }
      }),
      prisma.vendorSettlement.groupBy({
        by: ['vendorId'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    const vendorIds = vendorGrossRows.map((row) => row.vendorId);
    const [vendorProfiles, commissionSettings] = await Promise.all([
      vendorIds.length
        ? prisma.vendorProfile.findMany({
            where: { id: { in: vendorIds } },
            select: {
              id: true,
              commissionRate: true,
              commissionPercentage: true,
              commissionOverridePercentage: true,
              user: {
                select: {
                  role: true
                }
              }
            }
          })
        : Promise.resolve([]),
      CommissionService.getCommissionSettings()
    ]);

    const commissionMap = new Map(
      vendorProfiles.map((vendor) => [
        vendor.id.toString(),
        CommissionService.resolveEffectiveCommissionRate(vendor, commissionSettings)
      ])
    );
    const completedMap = new Map(
      completedSettlementRows.map((row) => [row.vendorId.toString(), Number(row._sum.amount || 0)])
    );

    const vendorPayables = vendorGrossRows.reduce((sum, row) => {
      const gross = Number(row._sum.rentPrice || 0);
      const commissionRate = commissionMap.get(row.vendorId.toString()) || 0;
      const netPayable = Math.max(0, gross - (gross * commissionRate) / 100);
      const alreadyPaid = completedMap.get(row.vendorId.toString()) || 0;
      return sum + Math.max(0, netPayable - alreadyPaid);
    }, 0);

    return {
      totalHeldDeposits: Number(heldDeposits._sum.deposit || 0),
      pendingRefunds: Number(pendingRefunds._sum.deposit || 0),
      vendorPayables,
      platformEarnings: Number(totalPaid._sum.amount || 0) - Number(totalRefunded._sum.amount || 0)
    };
  },

  async getTransactions(limit = 50) {
    return prisma.payment.findMany({
      take: limit,
      include: {
        order: { include: { customer: true } },
        customer: true
      },
      orderBy: { paidAt: 'desc' }
    });
  }
};
