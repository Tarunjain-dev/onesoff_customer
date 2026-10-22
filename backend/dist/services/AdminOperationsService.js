"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOperationsService = void 0;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const socketServer_1 = require("../realtime/socketServer");
const errors_1 = require("../utils/errors");
const vendorScope_1 = require("../utils/vendorScope");
const ReturnService_1 = require("./ReturnService");
const QC_ELIGIBLE_STATUSES = [
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.RETURN_RECEIVED
];
const TASK_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const LOCKED_REPAIR_TASK_STATUSES = new Set(['COMPLETED']);
const CLAIM_REVIEW_ACTIONS = new Set(['APPROVE_FULL_DEDUCTION', 'APPROVE_PARTIAL_DEDUCTION', 'REJECT_CLAIM', 'APPROVE_FULL', 'APPROVE_PARTIAL', 'REJECT']);
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};
const toSafeDate = (value) => {
    if (!value)
        return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const requireBigInt = (value, fieldName) => {
    try {
        return BigInt(value);
    }
    catch {
        throw new errors_1.ValidationError(`Invalid ${fieldName}`);
    }
};
const mapQualityCheckStatus = (value) => {
    const normalized = String(value || 'PENDING').trim().toUpperCase();
    if (normalized === 'IN_PROGRESS')
        return 'in_progress';
    if (normalized === 'COMPLETED')
        return 'completed';
    return 'pending';
};
const mapTaskStatus = (value) => {
    const normalized = String(value || 'PENDING').trim().toUpperCase();
    if (normalized === 'IN_PROGRESS')
        return 'in_progress';
    if (normalized === 'COMPLETED')
        return 'completed';
    if (normalized === 'CANCELLED')
        return 'cancelled';
    return 'pending';
};
const mapQualityCheckItem = (orderItem, qualityCheck) => {
    const returnedAt = toSafeDate(orderItem?.returnedAt);
    const deadline = returnedAt || toSafeDate(orderItem?.returnDueDate) || new Date();
    return {
        id: qualityCheck?.id ? String(qualityCheck.id) : `QC-${String(orderItem.id)}`,
        orderItemId: String(orderItem.id),
        orderId: String(orderItem.orderId),
        orderNo: String(orderItem?.order?.orderNo || `ORD-${String(orderItem.orderId)}`),
        productCode: String(orderItem?.variant?.sku || ''),
        productName: String(orderItem?.product?.name || 'Product'),
        customer: String(orderItem?.order?.customer?.name || 'Customer'),
        inspectionType: 'return',
        deadline: deadline.toISOString().split('T')[0],
        status: mapQualityCheckStatus(qualityCheck?.status),
        outcome: qualityCheck?.outcome ? String(qualityCheck.outcome).toLowerCase() : undefined,
        damageType: qualityCheck?.damageType || '',
        estimatedCost: toNumber(qualityCheck?.estimatedCost),
        notes: qualityCheck?.notes || '',
        returnedAt: returnedAt?.toISOString() || null,
        dueReturnDate: toSafeDate(orderItem?.returnDueDate)?.toISOString() || null,
        customerPhone: String(orderItem?.order?.customer?.phone || '')
    };
};
const mapMaintenanceTask = (task) => ({
    taskId: String(task.id),
    orderItemId: String(task.orderItemId),
    orderNo: String(task?.orderItem?.order?.orderNo || `ORD-${String(task?.orderItem?.orderId || task.orderItemId)}`),
    productCode: String(task?.orderItem?.variant?.sku || ''),
    productName: String(task?.orderItem?.product?.name || 'Product'),
    type: 'cleaning',
    assignedTo: '',
    scheduledDate: toSafeDate(task?.scheduledDate)?.toISOString().split('T')[0] || '',
    status: mapTaskStatus(task?.status),
    notes: String(task?.notes || '')
});
const mapRepairTask = (task) => ({
    repairId: String(task.id),
    orderItemId: String(task.orderItemId),
    orderNo: String(task?.orderItem?.order?.orderNo || `ORD-${String(task?.orderItem?.orderId || task.orderItemId)}`),
    productCode: String(task?.orderItem?.variant?.sku || ''),
    productName: String(task?.orderItem?.product?.name || 'Product'),
    issueType: String(task?.issueType || 'Repair required'),
    assignedTo: '',
    estimatedCost: toNumber(task?.estimatedCost),
    actualCost: toNumber(task?.actualCost),
    startDate: toSafeDate(task?.startDate)?.toISOString().split('T')[0] || '',
    expectedCompletion: toSafeDate(task?.expectedCompletion)?.toISOString().split('T')[0] || '',
    status: mapTaskStatus(task?.status),
    notes: String(task?.notes || '')
});
const ensureScopedOrderItem = async (orderItemId, roleFilter) => {
    const orderItem = await db_1.default.orderItem.findFirst({
        where: {
            id: requireBigInt(orderItemId, 'orderItemId'),
            vendorProfile: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
        },
        include: {
            product: true,
            variant: true,
            order: {
                include: {
                    customer: true
                }
            },
            vendorProfile: {
                include: {
                    user: true
                }
            }
        }
    });
    if (!orderItem) {
        throw new errors_1.ValidationError('Order item not found');
    }
    return orderItem;
};
const getVendorRealtimeRole = (role) => String(role || '').trim().toUpperCase() === 'INDIVIDUAL_VENDOR'
    ? 'ADMIN_AS_VENDOR'
    : 'ADMIN';
const emitOperationsRealtimeForOrderItem = (orderItem, reason, refs = {}, domains = ['orders', 'operations', 'refunds', 'dashboard']) => {
    const vendorUserId = orderItem?.vendorProfile?.user?.id
        ? String(orderItem.vendorProfile.user.id).trim()
        : '';
    const vendorRole = String(orderItem?.vendorProfile?.user?.role || '').trim().toUpperCase();
    const payloadRefs = Object.fromEntries(Object.entries({
        orderItemId: String(orderItem?.id || '').trim(),
        orderNo: String(orderItem?.order?.orderNo || '').trim(),
        vendorId: String(orderItem?.vendorId || '').trim(),
        ...refs
    }).filter(([, value]) => value));
    const payload = {
        domains,
        refs: payloadRefs,
        reason
    };
    if (vendorUserId) {
        (0, socketServer_1.emitDataUpdatedToUser)(vendorUserId, payload);
    }
    (0, socketServer_1.emitDataUpdatedToRole)(getVendorRealtimeRole(vendorRole), payload);
};
exports.AdminOperationsService = {
    async getQualityCheckQueue(roleFilter) {
        const orderItems = await db_1.default.orderItem.findMany({
            where: {
                status: {
                    in: QC_ELIGIBLE_STATUSES
                },
                vendorProfile: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            },
            include: {
                product: true,
                variant: true,
                order: {
                    include: {
                        customer: true
                    }
                },
                vendorProfile: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: [{ returnedAt: 'desc' }, { id: 'desc' }]
        });
        if (orderItems.length === 0) {
            return [];
        }
        const qualityChecksRaw = await db_1.default.orderItemQualityCheck.findMany({
            where: {
                orderItemId: {
                    in: orderItems.map((item) => item.id)
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        const qualityCheckByOrderItemId = new Map();
        for (const row of qualityChecksRaw || []) {
            qualityCheckByOrderItemId.set(String(row.orderItemId), row);
        }
        return orderItems
            .filter((item) => {
            const qc = qualityCheckByOrderItemId.get(String(item.id));
            return !qc || String(qc.status || '').toUpperCase() !== 'COMPLETED';
        })
            .map((item) => mapQualityCheckItem(item, qualityCheckByOrderItemId.get(String(item.id))));
    },
    async inspectReturnedOrder(adminId, orderItemId, payload, roleFilter) {
        const outcome = String(payload.outcome || '').trim().toUpperCase();
        const persistedOutcome = outcome === 'ISSUE' ? null : outcome;
        if (!['PASSED', 'REPAIR', 'DAMAGE', 'ISSUE'].includes(outcome)) {
            throw new errors_1.ValidationError('Invalid inspection outcome');
        }
        const orderItem = await ensureScopedOrderItem(orderItemId, roleFilter);
        if (!QC_ELIGIBLE_STATUSES.includes(orderItem.status)) {
            throw new errors_1.ValidationError('Order item is not pending quality check');
        }
        const damageType = String(payload.damageType || '').trim();
        const notes = String(payload.notes || '').trim() || null;
        const estimatedCost = Math.max(0, toNumber(payload.estimatedCost));
        if (outcome !== 'PASSED' && !damageType) {
            throw new errors_1.ValidationError('damageType is required for repair or damage outcomes');
        }
        const inspectedAt = new Date();
        const scheduledMaintenanceDate = addDays(inspectedAt, 1);
        const result = await db_1.default.$transaction(async (tx) => {
            const qualityCheck = await tx.orderItemQualityCheck.upsert({
                where: { orderItemId: orderItem.id },
                update: {
                    status: 'COMPLETED',
                    outcome: persistedOutcome,
                    damageType: damageType || null,
                    estimatedCost,
                    notes,
                    inspectedByAdminId: BigInt(adminId),
                    inspectedAt
                },
                create: {
                    orderItemId: orderItem.id,
                    vendorId: orderItem.vendorId,
                    status: 'COMPLETED',
                    outcome: persistedOutcome,
                    damageType: damageType || null,
                    estimatedCost,
                    notes,
                    inspectedByAdminId: BigInt(adminId),
                    inspectedAt
                }
            });
            if (outcome === 'PASSED') {
                await tx.damageClaim.deleteMany({
                    where: { orderItemId: orderItem.id }
                });
                await tx.orderItemRepairTask.deleteMany({
                    where: { orderItemId: orderItem.id }
                });
                const maintenanceTask = await tx.orderItemMaintenanceTask.upsert({
                    where: { orderItemId: orderItem.id },
                    update: {
                        taskType: 'CLEANING',
                        scheduledDate: scheduledMaintenanceDate,
                        status: 'PENDING',
                        notes,
                        createdByAdminId: BigInt(adminId)
                    },
                    create: {
                        orderItemId: orderItem.id,
                        vendorId: orderItem.vendorId,
                        taskType: 'CLEANING',
                        scheduledDate: scheduledMaintenanceDate,
                        status: 'PENDING',
                        notes,
                        createdByAdminId: BigInt(adminId)
                    }
                });
                return {
                    qualityCheck,
                    nextQueue: 'maintenance',
                    maintenanceTask
                };
            }
            if (outcome !== 'PASSED') {
                await tx.orderItemMaintenanceTask.deleteMany({
                    where: { orderItemId: orderItem.id }
                });
                const repairTask = await tx.orderItemRepairTask.upsert({
                    where: { orderItemId: orderItem.id },
                    update: {
                        issueType: damageType,
                        estimatedCost,
                        status: 'PENDING',
                        notes,
                        startDate: inspectedAt,
                        expectedCompletion: scheduledMaintenanceDate,
                        createdByAdminId: BigInt(adminId)
                    },
                    create: {
                        orderItemId: orderItem.id,
                        vendorId: orderItem.vendorId,
                        issueType: damageType,
                        estimatedCost,
                        actualCost: 0,
                        startDate: inspectedAt,
                        expectedCompletion: scheduledMaintenanceDate,
                        status: 'PENDING',
                        notes,
                        createdByAdminId: BigInt(adminId)
                    }
                });
                const damageClaim = await tx.damageClaim.upsert({
                    where: { orderItemId: orderItem.id },
                    update: {
                        vendorId: orderItem.vendorId,
                        damageType,
                        repairCost: estimatedCost,
                        photoProof: [],
                        vendorNotes: notes,
                        status: 'PENDING',
                        approvedAmount: 0,
                        adminNotes: null,
                        rejectionReason: null,
                        reviewedAt: null,
                        adminId: null
                    },
                    create: {
                        orderItemId: orderItem.id,
                        vendorId: orderItem.vendorId,
                        damageType,
                        repairCost: estimatedCost,
                        photoProof: [],
                        vendorNotes: notes,
                        status: 'PENDING',
                        approvedAmount: 0
                    }
                });
                await tx.orderItem.update({
                    where: { id: orderItem.id },
                    data: {
                        status: client_1.OrderItemStatus.DAMAGE_REVIEW
                    }
                });
                return {
                    qualityCheck,
                    nextQueue: 'damage_repair',
                    repairTask,
                    damageClaim
                };
            }
        });
        emitOperationsRealtimeForOrderItem(orderItem, 'QUALITY_CHECK_UPDATED', {
            nextQueue: String(result?.nextQueue || '').trim()
        });
        return {
            success: true,
            orderItemId: String(orderItem.id),
            orderNo: String(orderItem.order.orderNo),
            outcome: outcome.toLowerCase(),
            ...result
        };
    },
    async getDamageClaims(roleFilter) {
        const response = await ReturnService_1.ReturnService.getAdminDamageClaims({ page: 1, limit: 500 }, roleFilter);
        return Array.isArray(response?.claims) ? response.claims : [];
    },
    async reviewDamageClaim(adminId, claimId, payload, roleFilter) {
        const action = String(payload.action || '').trim().toUpperCase();
        if (!CLAIM_REVIEW_ACTIONS.has(action)) {
            throw new errors_1.ValidationError('Invalid claim review action');
        }
        return ReturnService_1.ReturnService.reviewDamageClaim(adminId, claimId, {
            action: action,
            approvedAmount: payload.approvedAmount,
            adminNotes: payload.adminNotes,
            rejectionReason: payload.rejectionReason
        }, roleFilter);
    },
    async getMaintenanceTasks(roleFilter) {
        const tasksRaw = await db_1.default.orderItemMaintenanceTask.findMany({
            where: {
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            },
            orderBy: [{ scheduledDate: 'asc' }, { id: 'desc' }]
        });
        return (tasksRaw || []).map(mapMaintenanceTask);
    },
    async updateMaintenanceTaskStatus(taskId, statusInput, roleFilter) {
        const status = String(statusInput || '').trim().toUpperCase();
        if (!TASK_STATUSES.has(status)) {
            throw new errors_1.ValidationError('Invalid maintenance status');
        }
        const task = await db_1.default.orderItemMaintenanceTask.findFirst({
            where: {
                id: requireBigInt(taskId, 'taskId'),
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            }
        });
        if (!task) {
            throw new errors_1.ValidationError('Maintenance task not found');
        }
        const updated = await db_1.default.orderItemMaintenanceTask.update({
            where: { id: task.id },
            data: {
                status
            },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            }
        });
        emitOperationsRealtimeForOrderItem(task.orderItem, 'MAINTENANCE_TASK_UPDATED', {
            taskId: String(updated?.id || task.id || '').trim()
        });
        return mapMaintenanceTask(updated);
    },
    async getRepairTasks(roleFilter) {
        const tasksRaw = await db_1.default.orderItemRepairTask.findMany({
            where: {
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            },
            orderBy: [{ expectedCompletion: 'asc' }, { id: 'desc' }]
        });
        return (tasksRaw || []).map(mapRepairTask);
    },
    async updateRepairTask(repairId, payload, roleFilter) {
        const status = String(payload.status || '').trim().toUpperCase();
        if (!TASK_STATUSES.has(status)) {
            throw new errors_1.ValidationError('Invalid repair status');
        }
        const actualCost = Math.max(0, toNumber(payload.actualCost));
        const notes = String(payload.notes || '').trim() || null;
        const task = await db_1.default.orderItemRepairTask.findFirst({
            where: {
                id: requireBigInt(repairId, 'repairId'),
                vendor: (0, vendorScope_1.getVendorProfileUserWhere)(roleFilter)
            },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            }
        });
        if (!task) {
            throw new errors_1.ValidationError('Repair task not found');
        }
        if (LOCKED_REPAIR_TASK_STATUSES.has(String(task.status || '').trim().toUpperCase())) {
            throw new errors_1.ValidationError('Completed repair tasks cannot be edited');
        }
        const updated = await db_1.default.orderItemRepairTask.update({
            where: { id: task.id },
            data: {
                status,
                actualCost,
                notes
            },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            }
        });
        emitOperationsRealtimeForOrderItem(task.orderItem, 'REPAIR_TASK_UPDATED', {
            repairId: String(updated?.id || task.id || '').trim()
        });
        return mapRepairTask(updated);
    },
    async updateIssueTask(adminId, orderItemId, payload, roleFilter) {
        const status = String(payload.status || '').trim().toUpperCase();
        if (!TASK_STATUSES.has(status)) {
            throw new errors_1.ValidationError('Invalid issue status');
        }
        const actualCost = Math.max(0, toNumber(payload.actualCost));
        const notes = String(payload.notes || '').trim() || null;
        const orderItem = await ensureScopedOrderItem(orderItemId, roleFilter);
        const existingRepairTask = await db_1.default.orderItemRepairTask.findUnique({
            where: { orderItemId: orderItem.id }
        });
        const existingDamageClaim = await db_1.default.damageClaim.findUnique({
            where: { orderItemId: orderItem.id }
        });
        if (!existingRepairTask && !existingDamageClaim) {
            throw new errors_1.ValidationError('Issue record not found');
        }
        if (existingRepairTask && LOCKED_REPAIR_TASK_STATUSES.has(String(existingRepairTask.status || '').trim().toUpperCase())) {
            throw new errors_1.ValidationError('Completed repair issues cannot be edited');
        }
        const baseIssueType = String(existingRepairTask?.issueType || existingDamageClaim?.damageType || 'Damage & Repair');
        const baseEstimatedCost = Math.max(toNumber(existingRepairTask?.estimatedCost), toNumber(existingDamageClaim?.repairCost));
        const normalizedEstimatedCost = baseEstimatedCost > 0 ? baseEstimatedCost : actualCost;
        const updatedRepairTask = await db_1.default.$transaction(async (tx) => {
            const repairTask = await tx.orderItemRepairTask.upsert({
                where: { orderItemId: orderItem.id },
                update: {
                    issueType: baseIssueType,
                    estimatedCost: normalizedEstimatedCost,
                    actualCost,
                    status,
                    notes
                },
                create: {
                    orderItemId: orderItem.id,
                    vendorId: orderItem.vendorId,
                    issueType: baseIssueType,
                    estimatedCost: normalizedEstimatedCost,
                    actualCost,
                    startDate: new Date(),
                    expectedCompletion: addDays(new Date(), 1),
                    status,
                    notes,
                    createdByAdminId: BigInt(adminId)
                }
            });
            await tx.damageClaim.upsert({
                where: { orderItemId: orderItem.id },
                update: {
                    vendorId: orderItem.vendorId,
                    damageType: baseIssueType,
                    repairCost: normalizedEstimatedCost,
                    adminNotes: null,
                    vendorNotes: notes,
                    photoProof: Array.isArray(existingDamageClaim?.photoProof) ? existingDamageClaim.photoProof : [],
                    status: 'PENDING',
                    approvedAmount: 0,
                    rejectionReason: null,
                    reviewedAt: null,
                    adminId: null
                },
                create: {
                    orderItemId: orderItem.id,
                    vendorId: orderItem.vendorId,
                    damageType: baseIssueType,
                    repairCost: normalizedEstimatedCost,
                    photoProof: [],
                    vendorNotes: notes,
                    status: 'PENDING',
                    approvedAmount: 0
                }
            });
            return repairTask;
        });
        const refreshedRepairTask = await db_1.default.orderItemRepairTask.findUnique({
            where: { orderItemId: orderItem.id },
            include: {
                vendor: {
                    include: {
                        user: true
                    }
                },
                orderItem: {
                    include: {
                        product: true,
                        variant: true,
                        order: {
                            include: {
                                customer: true
                            }
                        }
                    }
                }
            }
        });
        emitOperationsRealtimeForOrderItem(orderItem, 'ISSUE_TASK_UPDATED', {
            repairId: String(refreshedRepairTask?.id || updatedRepairTask?.id || '').trim()
        });
        return mapRepairTask(refreshedRepairTask || updatedRepairTask);
    }
};
