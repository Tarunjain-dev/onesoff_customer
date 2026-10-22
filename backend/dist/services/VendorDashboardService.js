"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorDashboardService = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const ACTIVE_RENTAL_STATUSES = [
    client_1.OrderItemStatus.PICKED_UP,
    client_1.OrderItemStatus.OUT_FOR_DELIVERY,
    client_1.OrderItemStatus.DELIVERED,
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.RETURN_REQUESTED
];
const DEPOSIT_PENDING_STATUSES = [
    client_1.OrderItemStatus.RETURN_SCHEDULED,
    client_1.OrderItemStatus.RETURNED,
    client_1.OrderItemStatus.DAMAGE_REVIEW,
    client_1.OrderItemStatus.RETURN_REQUESTED,
    client_1.OrderItemStatus.RETURN_RECEIVED,
    client_1.OrderItemStatus.INSPECTED_GOOD,
    client_1.OrderItemStatus.INSPECTED_DAMAGED,
    client_1.OrderItemStatus.INSPECTED_LOST
];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TRIAL_CONVERSION_SOURCE_STATUSES = [
    client_1.TrialRequestStatus.ACCEPTED,
    client_1.TrialRequestStatus.COMPLETED,
    'STARTED'
];
const TRIAL_APPOINTMENT_ACTIVE_STATUSES = [
    client_1.TrialRequestStatus.ACCEPTED,
    'STARTED'
];
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const startOfDay = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};
const endOfDay = (date) => {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
};
const isSameDay = (left, right) => left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
const isMissingColumnError = (error) => {
    const code = error?.code;
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (code === 'P2022' ||
        message.includes('does not exist in the current database') ||
        message.includes('unknown argument `rentalstartdate`') ||
        message.includes('unknown field `rentalstartdate`') ||
        message.includes('unknown argument `returnduedate`') ||
        message.includes('unknown field `returnduedate`'));
};
const resolveVendorProfileId = async (vendorIdentifier) => {
    let vendorIdBig;
    try {
        vendorIdBig = BigInt(vendorIdentifier);
    }
    catch {
        throw new errors_1.ValidationError('Invalid vendor identifier');
    }
    let vendorProfile = null;
    try {
        vendorProfile = await db_1.default.vendorProfile.findFirst({
            where: {
                OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
            },
            select: { id: true }
        });
    }
    catch (error) {
        if (!isMissingColumnError(error))
            throw error;
        const rows = await db_1.default.$queryRawUnsafe(`SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`, vendorIdBig.toString());
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
            vendorProfile = { id: BigInt(rows[0].id) };
        }
    }
    if (!vendorProfile) {
        throw new errors_1.ValidationError('Vendor not found');
    }
    return vendorProfile.id;
};
const getEstimatedRentalDays = (rentPrice, rentalPricePerDay, quantity) => {
    const totalRent = toNumber(rentPrice);
    const dayPrice = toNumber(rentalPricePerDay);
    const safeQuantity = Math.max(1, toNumber(quantity));
    const denominator = dayPrice * safeQuantity;
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 3;
    }
    const estimated = Math.round(totalRent / denominator);
    return Math.max(1, estimated);
};
const getEstimatedReturnDueDate = (item) => {
    const estimatedDays = getEstimatedRentalDays(item.rentPrice, item.product.rentalPrice, item.quantity);
    const dueDate = new Date(item.order.createdAt);
    dueDate.setDate(dueDate.getDate() + estimatedDays);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate;
};
const buildOrderKey = (customerId, productId) => `${customerId.toString()}::${productId.toString()}`;
const getTrialConversionStats = async (vendorProfileId) => {
    const candidateTrials = await db_1.default.trialRequest.findMany({
        where: {
            vendorId: vendorProfileId,
            status: {
                in: TRIAL_CONVERSION_SOURCE_STATUSES
            }
        },
        select: {
            customerId: true,
            productId: true,
            createdAt: true
        }
    });
    if (candidateTrials.length === 0) {
        return { converted: 0, total: 0 };
    }
    const uniqueProductIds = Array.from(new Set(candidateTrials.map((trial) => trial.productId.toString()))).map((id) => BigInt(id));
    const uniqueCustomerIds = Array.from(new Set(candidateTrials.map((trial) => trial.customerId.toString()))).map((id) => BigInt(id));
    const earliestTrialDate = candidateTrials.reduce((earliest, current) => current.createdAt < earliest ? current.createdAt : earliest, candidateTrials[0].createdAt);
    const matchedOrders = await db_1.default.orderItem.findMany({
        where: {
            vendorId: vendorProfileId,
            productId: { in: uniqueProductIds },
            status: { notIn: [client_1.OrderItemStatus.CANCELLED, client_1.OrderItemStatus.REJECTED] },
            order: {
                paymentStatus: 'PAID',
                customerId: { in: uniqueCustomerIds },
                createdAt: { gte: earliestTrialDate }
            }
        },
        select: {
            productId: true,
            order: {
                select: {
                    customerId: true,
                    createdAt: true
                }
            }
        }
    });
    const orderDateMap = new Map();
    for (const row of matchedOrders) {
        const key = buildOrderKey(row.order.customerId, row.productId);
        const list = orderDateMap.get(key) ?? [];
        list.push(new Date(row.order.createdAt).getTime());
        orderDateMap.set(key, list);
    }
    let converted = 0;
    for (const trial of candidateTrials) {
        const key = buildOrderKey(trial.customerId, trial.productId);
        const orderDates = orderDateMap.get(key) ?? [];
        const trialTime = new Date(trial.createdAt).getTime();
        if (orderDates.some((orderTime) => orderTime >= trialTime)) {
            converted += 1;
        }
    }
    return { converted, total: candidateTrials.length };
};
exports.VendorDashboardService = {
    async getDashboardSummary(vendorId) {
        const vendorProfileId = await resolveVendorProfileId(vendorId);
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const tomorrowStart = new Date(todayStart.getTime() + DAY_IN_MS);
        const tomorrowEnd = endOfDay(tomorrowStart);
        let activeRentalsOutNow = 0;
        let pendingDepositRefunds = 0;
        let appointmentsToday = 0;
        let prepareForDispatch = 0;
        let dueDateCandidates = [];
        let conversionStats = { converted: 0, total: 0 };
        try {
            [
                activeRentalsOutNow,
                pendingDepositRefunds,
                appointmentsToday,
                prepareForDispatch,
                dueDateCandidates,
                conversionStats
            ] = await Promise.all([
                db_1.default.orderItem.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: ACTIVE_RENTAL_STATUSES },
                        order: { paymentStatus: 'PAID' }
                    }
                }),
                db_1.default.orderItem.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: DEPOSIT_PENDING_STATUSES },
                        order: { paymentStatus: 'PAID' }
                    }
                }),
                db_1.default.trialRequest.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: TRIAL_APPOINTMENT_ACTIVE_STATUSES },
                        preferredDate: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    }
                }),
                db_1.default.orderItem.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: {
                            in: [
                                client_1.OrderItemStatus.RENTAL_CONFIRMED,
                                client_1.OrderItemStatus.ACCEPTED,
                                client_1.OrderItemStatus.READY_FOR_PICKUP
                            ]
                        },
                        order: { paymentStatus: 'PAID' },
                        rentalStartDate: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    }
                }),
                db_1.default.orderItem.findMany({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: ACTIVE_RENTAL_STATUSES },
                        order: { paymentStatus: 'PAID' }
                    },
                    select: {
                        rentPrice: true,
                        quantity: true,
                        returnDueDate: true,
                        order: {
                            select: {
                                createdAt: true
                            }
                        },
                        product: {
                            select: {
                                rentalPrice: true
                            }
                        }
                    }
                }),
                getTrialConversionStats(vendorProfileId)
            ]);
        }
        catch (error) {
            if (!isMissingColumnError(error))
                throw error;
            // Backward-compatible fallback for deployments where rental date columns
            // are not yet migrated.
            [
                activeRentalsOutNow,
                pendingDepositRefunds,
                appointmentsToday,
                prepareForDispatch,
                dueDateCandidates,
                conversionStats
            ] = await Promise.all([
                db_1.default.orderItem.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: ACTIVE_RENTAL_STATUSES },
                        order: { paymentStatus: 'PAID' }
                    }
                }),
                db_1.default.orderItem.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: DEPOSIT_PENDING_STATUSES },
                        order: { paymentStatus: 'PAID' }
                    }
                }),
                db_1.default.trialRequest.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: TRIAL_APPOINTMENT_ACTIVE_STATUSES },
                        preferredDate: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    }
                }),
                db_1.default.orderItem.count({
                    where: {
                        vendorId: vendorProfileId,
                        status: {
                            in: [
                                client_1.OrderItemStatus.RENTAL_CONFIRMED,
                                client_1.OrderItemStatus.ACCEPTED,
                                client_1.OrderItemStatus.READY_FOR_PICKUP
                            ]
                        },
                        order: { paymentStatus: 'PAID' }
                    }
                }),
                db_1.default.orderItem.findMany({
                    where: {
                        vendorId: vendorProfileId,
                        status: { in: ACTIVE_RENTAL_STATUSES },
                        order: { paymentStatus: 'PAID' }
                    },
                    select: {
                        rentPrice: true,
                        quantity: true,
                        order: {
                            select: {
                                createdAt: true
                            }
                        },
                        product: {
                            select: {
                                rentalPrice: true
                            }
                        }
                    }
                }),
                getTrialConversionStats(vendorProfileId)
            ]);
        }
        let returnsDueToday = 0;
        let returnsTomorrow = 0;
        let overdueReturns = 0;
        for (const row of dueDateCandidates) {
            const dueDate = row.returnDueDate
                ? startOfDay(new Date(row.returnDueDate))
                : getEstimatedReturnDueDate(row);
            const dueTime = dueDate.getTime();
            if (isSameDay(dueDate, todayStart)) {
                returnsDueToday += 1;
            }
            else if (dueTime >= tomorrowStart.getTime() && dueTime <= tomorrowEnd.getTime()) {
                returnsTomorrow += 1;
            }
            else if (dueTime < todayStart.getTime()) {
                overdueReturns += 1;
            }
        }
        const trialConversionPercent = conversionStats.total > 0
            ? Number(((conversionStats.converted / conversionStats.total) * 100).toFixed(2))
            : 0;
        return {
            activeRentalsOutNow,
            returnsDueToday,
            overdueReturns,
            pendingDepositRefunds,
            trialConversionPercent,
            todayUpcoming: {
                appointmentsToday,
                prepareForDispatch,
                returnsTomorrow,
                overdueReturn: overdueReturns,
                outfitsCurrentlyRented: activeRentalsOutNow
            }
        };
    }
};
