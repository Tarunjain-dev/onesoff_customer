import { OrderItemStatus, TrialRequestStatus } from '@prisma/client';
import prisma from '../config/db';
import { ValidationError } from '../utils/errors';

type DashboardTodayUpcoming = {
  appointmentsToday: number;
  prepareForDispatch: number;
  returnsTomorrow: number;
  overdueReturn: number;
  outfitsCurrentlyRented: number;
};

type VendorDashboardSummary = {
  activeRentalsOutNow: number;
  returnsDueToday: number;
  overdueReturns: number;
  pendingDepositRefunds: number;
  trialConversionPercent: number;
  todayUpcoming: DashboardTodayUpcoming;
};

type DueDateCandidate = {
  rentPrice: unknown;
  quantity: number;
  returnDueDate?: Date | null;
  order: {
    createdAt: Date;
  };
  product: {
    rentalPrice: unknown;
  };
};

const ACTIVE_RENTAL_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.PICKED_UP,
  OrderItemStatus.OUT_FOR_DELIVERY,
  OrderItemStatus.DELIVERED,
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.RETURN_REQUESTED
];

const DEPOSIT_PENDING_STATUSES: OrderItemStatus[] = [
  OrderItemStatus.RETURN_SCHEDULED,
  OrderItemStatus.RETURNED,
  OrderItemStatus.DAMAGE_REVIEW,
  OrderItemStatus.RETURN_REQUESTED,
  OrderItemStatus.RETURN_RECEIVED,
  OrderItemStatus.INSPECTED_GOOD,
  OrderItemStatus.INSPECTED_DAMAGED,
  OrderItemStatus.INSPECTED_LOST
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TRIAL_CONVERSION_SOURCE_STATUSES = [
  TrialRequestStatus.ACCEPTED,
  TrialRequestStatus.COMPLETED,
  'STARTED' as any
];
const TRIAL_APPOINTMENT_ACTIVE_STATUSES = [
  TrialRequestStatus.ACCEPTED,
  'STARTED' as any
];

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isMissingColumnError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 'P2022' ||
    message.includes('does not exist in the current database') ||
    message.includes('unknown argument `rentalstartdate`') ||
    message.includes('unknown field `rentalstartdate`') ||
    message.includes('unknown argument `returnduedate`') ||
    message.includes('unknown field `returnduedate`')
  );
};

const resolveVendorProfileId = async (vendorIdentifier: string): Promise<bigint> => {
  let vendorIdBig: bigint;
  try {
    vendorIdBig = BigInt(vendorIdentifier);
  } catch {
    throw new ValidationError('Invalid vendor identifier');
  }

  let vendorProfile: { id: bigint } | null = null;
  try {
    vendorProfile = await prisma.vendorProfile.findFirst({
      where: {
        OR: [{ id: vendorIdBig }, { userId: vendorIdBig }]
      },
      select: { id: true }
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: string | number | bigint }>>(
      `SELECT "id"
       FROM "VendorProfile"
       WHERE "id" = $1 OR "userId" = $1
       LIMIT 1`,
      vendorIdBig.toString()
    );

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id !== undefined && rows[0]?.id !== null) {
      vendorProfile = { id: BigInt(rows[0].id) };
    }
  }

  if (!vendorProfile) {
    throw new ValidationError('Vendor not found');
  }

  return vendorProfile.id;
};

const getEstimatedRentalDays = (
  rentPrice: unknown,
  rentalPricePerDay: unknown,
  quantity: number
) => {
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

const getEstimatedReturnDueDate = (item: DueDateCandidate): Date => {
  const estimatedDays = getEstimatedRentalDays(item.rentPrice, item.product.rentalPrice, item.quantity);
  const dueDate = new Date(item.order.createdAt);
  dueDate.setDate(dueDate.getDate() + estimatedDays);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
};

const buildOrderKey = (customerId: bigint, productId: bigint) =>
  `${customerId.toString()}::${productId.toString()}`;

const getTrialConversionStats = async (vendorProfileId: bigint) => {
  const candidateTrials = await prisma.trialRequest.findMany({
    where: {
      vendorId: vendorProfileId,
      status: {
        in: TRIAL_CONVERSION_SOURCE_STATUSES as any
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

  const uniqueProductIds = Array.from(
    new Set(candidateTrials.map((trial) => trial.productId.toString()))
  ).map((id) => BigInt(id));

  const uniqueCustomerIds = Array.from(
    new Set(candidateTrials.map((trial) => trial.customerId.toString()))
  ).map((id) => BigInt(id));

  const earliestTrialDate = candidateTrials.reduce((earliest, current) =>
    current.createdAt < earliest ? current.createdAt : earliest,
  candidateTrials[0].createdAt);

  const matchedOrders = await prisma.orderItem.findMany({
    where: {
      vendorId: vendorProfileId,
      productId: { in: uniqueProductIds },
      status: { notIn: [OrderItemStatus.CANCELLED, OrderItemStatus.REJECTED] },
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

  const orderDateMap = new Map<string, number[]>();
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

export const VendorDashboardService = {
  async getDashboardSummary(vendorId: string): Promise<VendorDashboardSummary> {
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
    let dueDateCandidates: DueDateCandidate[] = [];
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
        prisma.orderItem.count({
          where: {
            vendorId: vendorProfileId,
            status: { in: ACTIVE_RENTAL_STATUSES },
            order: { paymentStatus: 'PAID' }
          }
        }),
        prisma.orderItem.count({
          where: {
            vendorId: vendorProfileId,
            status: { in: DEPOSIT_PENDING_STATUSES },
            order: { paymentStatus: 'PAID' }
          }
        }),
        prisma.trialRequest.count({
          where: {
            vendorId: vendorProfileId,
            status: { in: TRIAL_APPOINTMENT_ACTIVE_STATUSES as any },
            preferredDate: {
              gte: todayStart,
              lte: todayEnd
            }
          }
        }),
        prisma.orderItem.count({
          where: {
            vendorId: vendorProfileId,
            status: {
              in: [
                OrderItemStatus.RENTAL_CONFIRMED,
                OrderItemStatus.ACCEPTED,
                OrderItemStatus.READY_FOR_PICKUP
              ]
            },
            order: { paymentStatus: 'PAID' },
            rentalStartDate: {
              gte: todayStart,
              lte: todayEnd
            }
          }
        }),
        prisma.orderItem.findMany({
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
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;

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
        prisma.orderItem.count({
          where: {
            vendorId: vendorProfileId,
            status: { in: ACTIVE_RENTAL_STATUSES },
            order: { paymentStatus: 'PAID' }
          }
        }),
        prisma.orderItem.count({
          where: {
            vendorId: vendorProfileId,
            status: { in: DEPOSIT_PENDING_STATUSES },
            order: { paymentStatus: 'PAID' }
          }
        }),
        prisma.trialRequest.count({
          where: {
            vendorId: vendorProfileId,
            status: { in: TRIAL_APPOINTMENT_ACTIVE_STATUSES as any },
            preferredDate: {
              gte: todayStart,
              lte: todayEnd
            }
          }
        }),
        prisma.orderItem.count({
          where: {
            vendorId: vendorProfileId,
            status: {
              in: [
                OrderItemStatus.RENTAL_CONFIRMED,
                OrderItemStatus.ACCEPTED,
                OrderItemStatus.READY_FOR_PICKUP
              ]
            },
            order: { paymentStatus: 'PAID' }
          }
        }),
        prisma.orderItem.findMany({
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
      } else if (dueTime >= tomorrowStart.getTime() && dueTime <= tomorrowEnd.getTime()) {
        returnsTomorrow += 1;
      } else if (dueTime < todayStart.getTime()) {
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
