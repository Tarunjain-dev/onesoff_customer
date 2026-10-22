"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const errors_1 = require("../utils/errors");
const NotificationService_1 = require("./NotificationService");
const VendorEarningService_1 = require("./VendorEarningService");
const db_1 = __importDefault(require("../config/db"));
exports.SettlementService = {
    async settlementVendor(vendorId, _settlementDetails) {
        try {
            const vendorIdBig = BigInt(vendorId);
            const vendor = await db_1.default.vendorProfile.findFirst({ where: { id: vendorIdBig } });
            if (!vendor) {
                throw new errors_1.ValidationError('Vendor not found');
            }
            const balance = await VendorEarningService_1.VendorEarningService.getVendorBalance(vendorIdBig.toString());
            const availableAmount = Number(balance.availableBalance || 0);
            if (availableAmount <= 0) {
                throw new errors_1.ValidationError('No pending earnings for settlement');
            }
            const settlement = await db_1.default.vendorSettlement.create({
                data: {
                    vendorId: vendorIdBig,
                    amount: availableAmount,
                    status: 'COMPLETED'
                }
            });
            await NotificationService_1.NotificationService.notifyVendorSettlement(vendorId, availableAmount);
            return settlement;
        }
        catch (error) {
            throw new errors_1.BusinessLogicError(`Settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    async batchSettlement(vendorIds, adminNotes) {
        try {
            const results = [];
            let totalPayout = 0;
            for (const vendorId of vendorIds) {
                try {
                    const result = await exports.SettlementService.settlementVendor(vendorId, { notes: adminNotes });
                    results.push({ vendorId, status: 'SUCCESS', amount: Number(result.amount) });
                    totalPayout += Number(result.amount);
                }
                catch (error) {
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
        }
        catch (error) {
            throw new errors_1.BusinessLogicError(`Batch settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    async getSettlementHistory(vendorId) {
        const settlements = await db_1.default.vendorSettlement.findMany({
            where: { vendorId: BigInt(vendorId) },
            orderBy: { createdAt: 'desc' }
        });
        return {
            vendorId,
            settlements
        };
    },
    async getPendingSettlement(vendorId) {
        const vendorIdBig = BigInt(vendorId);
        const [balance, lastSettlement] = await Promise.all([
            VendorEarningService_1.VendorEarningService.getVendorBalance(vendorIdBig.toString()),
            db_1.default.vendorSettlement.findFirst({
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
