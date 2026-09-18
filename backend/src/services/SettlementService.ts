import { ValidationError, BusinessLogicError } from '../utils/errors';
import { NotificationService } from './NotificationService';
import { VendorEarningService } from './VendorEarningService';
import prisma from '../config/db';

export const SettlementService = {
  async settlementVendor(vendorId: string, _settlementDetails?: { notes?: string }) {
    try {
      const vendorIdBig = BigInt(vendorId);
      const vendor = await prisma.vendorProfile.findFirst({ where: { id: vendorIdBig } });
      if (!vendor) {
        throw new ValidationError('Vendor not found');
      }

      const balance = await VendorEarningService.getVendorBalance(vendorIdBig.toString());
      const availableAmount = Number(balance.availableBalance || 0);
      if (availableAmount <= 0) {
        throw new ValidationError('No pending earnings for settlement');
      }

      const settlement = await prisma.vendorSettlement.create({
        data: {
          vendorId: vendorIdBig,
          amount: availableAmount,
          status: 'COMPLETED'
        }
      });

      await NotificationService.notifyVendorSettlement(vendorId, availableAmount);

      return settlement;
    } catch (error) {
      throw new BusinessLogicError(
        `Settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async batchSettlement(vendorIds: string[], adminNotes?: string) {
    try {
      const results: Array<{ vendorId: string; status: 'SUCCESS' | 'FAILED'; amount?: number; error?: string }> = [];
      let totalPayout = 0;

      for (const vendorId of vendorIds) {
        try {
          const result = await SettlementService.settlementVendor(vendorId, { notes: adminNotes });
          results.push({ vendorId, status: 'SUCCESS', amount: Number(result.amount) });
          totalPayout += Number(result.amount);
        } catch (error) {
          results.push({
            vendorId,
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        totalVendors: vendorIds.length,
        successCount: results.filter((r) => r.status === 'SUCCESS').length,
        failureCount: results.filter((r) => r.status === 'FAILED').length,
        totalPayout,
        details: results
      };
    } catch (error) {
      throw new BusinessLogicError(`Batch settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async getSettlementHistory(vendorId: string) {
    const settlements = await prisma.vendorSettlement.findMany({
      where: { vendorId: BigInt(vendorId) },
      orderBy: { createdAt: 'desc' }
    });

    return {
      vendorId,
      settlements
    };
  },

  async getPendingSettlement(vendorId: string) {
    const vendorIdBig = BigInt(vendorId);
    const [balance, lastSettlement] = await Promise.all([
      VendorEarningService.getVendorBalance(vendorIdBig.toString()),
      prisma.vendorSettlement.findFirst({
        where: { vendorId: vendorIdBig },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      vendorId,
      pendingAmount: Number(balance.availableBalance || 0),
      lastSettlement
    };
  }
};
