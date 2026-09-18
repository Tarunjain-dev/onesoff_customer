import {
  AgreementHistoryAction,
  AgreementPanel,
  AgreementScope,
  Prisma,
  UserRole
} from '@prisma/client';
import prisma from '../config/db';
import { NotFoundError, ValidationError } from '../utils/errors';

type AgreementPointPayload = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  order?: unknown;
  sortOrder?: unknown;
  isActive?: unknown;
};

type AgreementSectionPayload = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  order?: unknown;
  sortOrder?: unknown;
  points?: unknown;
};

type AgreementPayload = {
  title?: unknown;
  description?: unknown;
  scope?: unknown;
  applicablePanels?: unknown;
  sections?: unknown;
  changeSummary?: unknown;
};

type AgreementListFilters = {
  includeDeleted?: unknown;
  scope?: unknown;
  panel?: unknown;
  search?: unknown;
};

type AgreementAcceptancePayload = {
  metadata?: unknown;
};

type NormalizedAgreementPoint = {
  id?: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

type NormalizedAgreementSection = {
  id?: string;
  title: string;
  description: string | null;
  sortOrder: number;
  points: NormalizedAgreementPoint[];
};

type NormalizedAgreementPayload = {
  title: string;
  description: string | null;
  scope: AgreementScope;
  applicablePanels: AgreementPanel[];
  sections: NormalizedAgreementSection[];
  changeSummary: string | null;
};

const ALL_AGREEMENT_PANELS: AgreementPanel[] = [
  AgreementPanel.ADMIN,
  AgreementPanel.ADMIN_AS_VENDOR,
  AgreementPanel.VENDOR,
  AgreementPanel.INDIVIDUAL_VENDOR,
  AgreementPanel.CUSTOMER
];

const ROLE_TO_PANEL: Record<UserRole, AgreementPanel> = {
  [UserRole.ADMIN]: AgreementPanel.ADMIN,
  [UserRole.ADMIN_AS_VENDOR]: AgreementPanel.ADMIN_AS_VENDOR,
  [UserRole.VENDOR]: AgreementPanel.VENDOR,
  [UserRole.INDIVIDUAL_VENDOR]: AgreementPanel.INDIVIDUAL_VENDOR,
  [UserRole.CUSTOMER]: AgreementPanel.CUSTOMER
};

const AGREEMENT_PANEL_VALUES = new Set<string>(Object.values(AgreementPanel));
const AGREEMENT_SCOPE_VALUES = new Set<string>(Object.values(AgreementScope));

const parseAgreementId = (value: string, fieldName = 'agreement id') => {
  try {
    return BigInt(value);
  } catch {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
};

const normalizeRequiredString = (value: unknown, fieldName: string) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return normalized;
};

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeNonNegativeInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const normalizeBoolean = (value: unknown, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

const normalizePanel = (value: unknown) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!AGREEMENT_PANEL_VALUES.has(normalized)) {
    throw new ValidationError('Invalid applicable panel');
  }
  return normalized as AgreementPanel;
};

const normalizePanels = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const input = Array.isArray(value) ? value : [value];
  const panels = input.map(normalizePanel);
  return Array.from(new Set(panels));
};

const normalizeScope = (value: unknown, panels: AgreementPanel[]) => {
  const rawScope = String(value ?? '').trim().toUpperCase();
  const inferredScope =
    panels.length === ALL_AGREEMENT_PANELS.length
      ? AgreementScope.GLOBAL
      : AgreementScope.PANEL_SPECIFIC;

  if (!rawScope) {
    return inferredScope;
  }

  if (!AGREEMENT_SCOPE_VALUES.has(rawScope)) {
    throw new ValidationError('Invalid agreement scope');
  }

  return rawScope as AgreementScope;
};

const normalizeAgreementPoints = (value: unknown) => {
  if (value === undefined || value === null) return [] as NormalizedAgreementPoint[];
  if (!Array.isArray(value)) {
    throw new ValidationError('Agreement section points must be an array');
  }

  return value.map((point, index) => {
    const source = point && typeof point === 'object' ? (point as AgreementPointPayload) : {};
    const rawOrder = source.sortOrder ?? source.order;

    return {
      id: source.id === undefined || source.id === null || source.id === '' ? undefined : String(source.id),
      title: normalizeRequiredString(source.title, `Point title at index ${index + 1}`),
      description: normalizeRequiredString(
        source.description,
        `Point description at index ${index + 1}`
      ),
      sortOrder: normalizeNonNegativeInt(rawOrder, index + 1),
      isActive: normalizeBoolean(source.isActive, true)
    };
  });
};

const normalizeAgreementSections = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('At least one agreement section is required');
  }

  return value.map((section, index) => {
    const source = section && typeof section === 'object' ? (section as AgreementSectionPayload) : {};
    const rawOrder = source.sortOrder ?? source.order;

    return {
      id: source.id === undefined || source.id === null || source.id === '' ? undefined : String(source.id),
      title: normalizeRequiredString(source.title, `Section title at index ${index + 1}`),
      description: normalizeOptionalString(source.description),
      sortOrder: normalizeNonNegativeInt(rawOrder, index + 1),
      points: normalizeAgreementPoints(source.points)
    };
  });
};

const normalizeAgreementPayload = (payload: AgreementPayload): NormalizedAgreementPayload => {
  const applicablePanels = normalizePanels(payload.applicablePanels);
  const scope = normalizeScope(payload.scope, applicablePanels);

  if (scope === AgreementScope.GLOBAL) {
    return {
      title: normalizeRequiredString(payload.title, 'Agreement title'),
      description: normalizeOptionalString(payload.description),
      scope,
      applicablePanels: [...ALL_AGREEMENT_PANELS],
      sections: normalizeAgreementSections(payload.sections),
      changeSummary: normalizeOptionalString(payload.changeSummary)
    };
  }

  if (applicablePanels.length === 0) {
    throw new ValidationError(
      'Panel-specific agreements must have at least one applicable panel'
    );
  }

  return {
    title: normalizeRequiredString(payload.title, 'Agreement title'),
    description: normalizeOptionalString(payload.description),
    scope,
    applicablePanels,
    sections: normalizeAgreementSections(payload.sections),
    changeSummary: normalizeOptionalString(payload.changeSummary)
  };
};

const normalizeMetadata = (
  value: unknown
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
};

const buildAgreementInclude = (
  includeDeleted = false,
  includeHistory = false,
  acceptanceUserId?: bigint
) => {
  const include: any = {
    sections: {
      ...(includeDeleted ? {} : { where: { isDeleted: false } }),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        points: {
          ...(includeDeleted ? {} : { where: { isDeleted: false } }),
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
        }
      }
    }
  };

  if (includeHistory) {
    include.history = {
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    };
  }

  if (acceptanceUserId !== undefined) {
    include.acceptances = {
      where: { userId: acceptanceUserId },
      orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
      take: 1
    };
  }

  return include;
};

const mapAgreementForApi = (
  agreement: any,
  options?: {
    includeDeleted?: boolean;
    includeHistory?: boolean;
    onlyActivePoints?: boolean;
  }
) => {
  const includeDeleted = Boolean(options?.includeDeleted);
  const onlyActivePoints = Boolean(options?.onlyActivePoints);

  const sections = Array.isArray(agreement?.sections)
    ? agreement.sections
        .filter((section: any) => includeDeleted || !section?.isDeleted)
        .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
        .map((section: any) => ({
          id: String(section.id),
          title: String(section.title || ''),
          description: section?.description ? String(section.description) : null,
          order: Number(section.sortOrder || 0),
          sortOrder: Number(section.sortOrder || 0),
          isDeleted: Boolean(section.isDeleted),
          deletedAt: section.deletedAt || null,
          createdAt: section.createdAt,
          updatedAt: section.updatedAt,
          points: Array.isArray(section?.points)
            ? section.points
                .filter(
                  (point: any) =>
                    (includeDeleted || !point?.isDeleted) &&
                    (!onlyActivePoints || Boolean(point?.isActive))
                )
                .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
                .map((point: any) => ({
                  id: String(point.id),
                  title: String(point.title || ''),
                  description: String(point.description || ''),
                  order: Number(point.sortOrder || 0),
                  sortOrder: Number(point.sortOrder || 0),
                  isActive: Boolean(point.isActive),
                  isDeleted: Boolean(point.isDeleted),
                  deletedAt: point.deletedAt || null,
                  createdAt: point.createdAt,
                  updatedAt: point.updatedAt
                }))
            : []
        }))
    : [];

  const latestAcceptance = Array.isArray(agreement?.acceptances) ? agreement.acceptances[0] : null;

  return {
    id: String(agreement.id),
    title: String(agreement.title || ''),
    description: agreement?.description ? String(agreement.description) : null,
    scope: agreement.scope,
    applicablePanels: Array.isArray(agreement.applicablePanels)
      ? agreement.applicablePanels.map((panel: AgreementPanel) => String(panel))
      : [],
    version: Number(agreement.version || 1),
    isDeleted: Boolean(agreement.isDeleted),
    deletedAt: agreement.deletedAt || null,
    createdByUserId:
      agreement?.createdByUserId === undefined || agreement?.createdByUserId === null
        ? null
        : String(agreement.createdByUserId),
    updatedByUserId:
      agreement?.updatedByUserId === undefined || agreement?.updatedByUserId === null
        ? null
        : String(agreement.updatedByUserId),
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    sections,
    acceptance: latestAcceptance
      ? {
          acceptedVersion: Number(latestAcceptance.acceptedVersion || 0),
          acceptedAt: latestAcceptance.acceptedAt,
          userId: String(latestAcceptance.userId),
          userRole: String(latestAcceptance.userRole),
          hasAcceptedCurrentVersion:
            Number(latestAcceptance.acceptedVersion || 0) === Number(agreement.version || 1)
        }
      : null,
    history:
      options?.includeHistory && Array.isArray(agreement?.history)
        ? agreement.history.map((entry: any) => ({
            id: String(entry.id),
            version: Number(entry.version || 0),
            action: String(entry.action || ''),
            changeSummary: entry?.changeSummary ? String(entry.changeSummary) : null,
            createdByUserId:
              entry?.createdByUserId === undefined || entry?.createdByUserId === null
                ? null
                : String(entry.createdByUserId),
            createdAt: entry.createdAt,
            snapshot: entry.snapshot
          }))
        : undefined
  };
};

const createHistorySnapshot = async (
  tx: Prisma.TransactionClient,
  agreementId: bigint,
  version: number,
  action: AgreementHistoryAction,
  createdByUserId: bigint | null,
  changeSummary: string | null,
  includeDeleted = false
) => {
  const latest = await tx.agreement.findUnique({
    where: { id: agreementId },
    include: buildAgreementInclude(includeDeleted)
  });

  if (!latest) {
    throw new NotFoundError('Agreement not found');
  }

  const snapshot = mapAgreementForApi(latest, { includeDeleted, onlyActivePoints: false });

  await tx.agreementVersionHistory.create({
    data: {
      agreementId,
      version,
      action,
      changeSummary,
      createdByUserId: createdByUserId ?? undefined,
      snapshot: snapshot as Prisma.InputJsonValue
    }
  });
};

const resolveRolePanel = (role?: UserRole | string | null) => {
  const normalizedRole = String(role || '').trim().toUpperCase() as UserRole;
  return ROLE_TO_PANEL[normalizedRole];
};

export const AgreementService = {
  async getAdminAgreements(filters: AgreementListFilters) {
    const includeDeleted = normalizeBoolean(filters.includeDeleted, false);
    const rawScope = String(filters.scope || '').trim().toUpperCase();
    const rawPanel = String(filters.panel || '').trim().toUpperCase();
    const search = String(filters.search || '').trim();

    const where: any = {};
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    if (rawScope) {
      if (!AGREEMENT_SCOPE_VALUES.has(rawScope)) {
        throw new ValidationError('Invalid agreement scope filter');
      }
      where.scope = rawScope as AgreementScope;
    }

    if (rawPanel) {
      if (!AGREEMENT_PANEL_VALUES.has(rawPanel)) {
        throw new ValidationError('Invalid agreement panel filter');
      }
      where.applicablePanels = { has: rawPanel as AgreementPanel };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const agreements = await prisma.agreement.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: buildAgreementInclude(includeDeleted)
    });

    return agreements.map((agreement) =>
      mapAgreementForApi(agreement, { includeDeleted, onlyActivePoints: false })
    );
  },

  async getAdminAgreementDetail(agreementId: string, includeDeleted = true) {
    const parsedAgreementId = parseAgreementId(agreementId);
    const agreement = await prisma.agreement.findUnique({
      where: { id: parsedAgreementId },
      include: buildAgreementInclude(includeDeleted, true)
    });

    if (!agreement || (!includeDeleted && agreement.isDeleted)) {
      throw new NotFoundError('Agreement not found');
    }

    return mapAgreementForApi(agreement, {
      includeDeleted,
      includeHistory: true,
      onlyActivePoints: false
    });
  },

  async createAgreement(adminUserId: string, payload: AgreementPayload) {
    const normalized = normalizeAgreementPayload(payload);
    const parsedAdminUserId = parseAgreementId(adminUserId, 'admin user id');

    return prisma.$transaction(async (tx) => {
      const created = await tx.agreement.create({
        data: {
          title: normalized.title,
          description: normalized.description,
          scope: normalized.scope,
          applicablePanels: normalized.applicablePanels,
          version: 1,
          createdByUserId: parsedAdminUserId,
          updatedByUserId: parsedAdminUserId,
          sections: {
            create: normalized.sections.map((section) => ({
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder,
              points: {
                create: section.points.map((point) => ({
                  title: point.title,
                  description: point.description,
                  sortOrder: point.sortOrder,
                  isActive: point.isActive
                }))
              }
            }))
          }
        },
        include: buildAgreementInclude(false)
      });

      await createHistorySnapshot(
        tx,
        created.id,
        1,
        AgreementHistoryAction.CREATED,
        parsedAdminUserId,
        normalized.changeSummary
      );

      return mapAgreementForApi(created, { onlyActivePoints: false });
    });
  },

  async updateAgreement(adminUserId: string, agreementId: string, payload: AgreementPayload) {
    const normalized = normalizeAgreementPayload(payload);
    const parsedAdminUserId = parseAgreementId(adminUserId, 'admin user id');
    const parsedAgreementId = parseAgreementId(agreementId);

    return prisma.$transaction(async (tx) => {
      const current = await tx.agreement.findUnique({
        where: { id: parsedAgreementId },
        include: buildAgreementInclude(true)
      });

      if (!current) {
        throw new NotFoundError('Agreement not found');
      }

      const nextVersion = Number(current.version || 1) + 1;
      const now = new Date();

      await tx.agreement.update({
        where: { id: parsedAgreementId },
        data: {
          title: normalized.title,
          description: normalized.description,
          scope: normalized.scope,
          applicablePanels: normalized.applicablePanels,
          version: nextVersion,
          isDeleted: false,
          deletedAt: null,
          updatedByUserId: parsedAdminUserId
        }
      });

      const existingSections = Array.isArray(current.sections) ? current.sections : [];
      const existingSectionById = new Map(
        existingSections.map((section: any) => [String(section.id), section])
      );
      const retainedSectionIds = new Set<string>();

      for (const section of normalized.sections) {
        let sectionId: bigint;
        let sectionRecord = section.id ? existingSectionById.get(String(section.id)) : null;

        if (section.id) {
          sectionId = parseAgreementId(section.id, 'section id');
          if (!sectionRecord) {
            throw new ValidationError('Agreement section not found');
          }

          await tx.agreementSection.update({
            where: { id: sectionId },
            data: {
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder,
              isDeleted: false,
              deletedAt: null
            }
          });
        } else {
          const createdSection = await tx.agreementSection.create({
            data: {
              agreementId: parsedAgreementId,
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder
            }
          });

          sectionId = createdSection.id;
          sectionRecord = { id: createdSection.id, points: [] };
        }

        retainedSectionIds.add(String(sectionId));

        const existingPoints = Array.isArray(sectionRecord?.points) ? sectionRecord.points : [];
        const existingPointById = new Map(
          existingPoints.map((point: any) => [String(point.id), point])
        );
        const retainedPointIds = new Set<string>();

        for (const point of section.points) {
          if (point.id) {
            const pointId = parseAgreementId(point.id, 'point id');
            const existingPoint = existingPointById.get(String(point.id));
            if (!existingPoint) {
              throw new ValidationError('Agreement point not found');
            }

            await tx.agreementPoint.update({
              where: { id: pointId },
              data: {
                title: point.title,
                description: point.description,
                sortOrder: point.sortOrder,
                isActive: point.isActive,
                isDeleted: false,
                deletedAt: null
              }
            });

            retainedPointIds.add(String(pointId));
            continue;
          }

          const createdPoint = await tx.agreementPoint.create({
            data: {
              sectionId,
              title: point.title,
              description: point.description,
              sortOrder: point.sortOrder,
              isActive: point.isActive
            }
          });

          retainedPointIds.add(String(createdPoint.id));
        }

        const pointIdsToDelete = existingPoints
          .filter((point: any) => !point?.isDeleted && !retainedPointIds.has(String(point.id)))
          .map((point: any) => point.id);

        if (pointIdsToDelete.length > 0) {
          await tx.agreementPoint.updateMany({
            where: { id: { in: pointIdsToDelete } },
            data: {
              isDeleted: true,
              deletedAt: now
            }
          });
        }
      }

      const sectionIdsToDelete = existingSections
        .filter((section: any) => !section?.isDeleted && !retainedSectionIds.has(String(section.id)))
        .map((section: any) => section.id);

      if (sectionIdsToDelete.length > 0) {
        await tx.agreementPoint.updateMany({
          where: {
            sectionId: { in: sectionIdsToDelete },
            isDeleted: false
          },
          data: {
            isDeleted: true,
            deletedAt: now
          }
        });

        await tx.agreementSection.updateMany({
          where: { id: { in: sectionIdsToDelete } },
          data: {
            isDeleted: true,
            deletedAt: now
          }
        });
      }

      await createHistorySnapshot(
        tx,
        parsedAgreementId,
        nextVersion,
        AgreementHistoryAction.UPDATED,
        parsedAdminUserId,
        normalized.changeSummary
      );

      const latest = await tx.agreement.findUnique({
        where: { id: parsedAgreementId },
        include: buildAgreementInclude(false)
      });

      if (!latest) {
        throw new NotFoundError('Agreement not found');
      }

      return mapAgreementForApi(latest, { onlyActivePoints: false });
    });
  },

  async softDeleteAgreement(adminUserId: string, agreementId: string, payload?: AgreementPayload) {
    const parsedAdminUserId = parseAgreementId(adminUserId, 'admin user id');
    const parsedAgreementId = parseAgreementId(agreementId);
    const changeSummary = normalizeOptionalString(payload?.changeSummary);

    return prisma.$transaction(async (tx) => {
      const current = await tx.agreement.findUnique({
        where: { id: parsedAgreementId },
        include: buildAgreementInclude(true)
      });

      if (!current) {
        throw new NotFoundError('Agreement not found');
      }

      const nextVersion = Number(current.version || 1) + 1;
      const now = new Date();

      await tx.agreement.update({
        where: { id: parsedAgreementId },
        data: {
          version: nextVersion,
          isDeleted: true,
          deletedAt: now,
          updatedByUserId: parsedAdminUserId
        }
      });

      await tx.agreementPoint.updateMany({
        where: {
          section: { agreementId: parsedAgreementId },
          isDeleted: false
        },
        data: {
          isDeleted: true,
          deletedAt: now
        }
      });

      await tx.agreementSection.updateMany({
        where: {
          agreementId: parsedAgreementId,
          isDeleted: false
        },
        data: {
          isDeleted: true,
          deletedAt: now
        }
      });

      await createHistorySnapshot(
        tx,
        parsedAgreementId,
        nextVersion,
        AgreementHistoryAction.SOFT_DELETED,
        parsedAdminUserId,
        changeSummary,
        true
      );

      const deleted = await tx.agreement.findUnique({
        where: { id: parsedAgreementId },
        include: buildAgreementInclude(true)
      });

      if (!deleted) {
        throw new NotFoundError('Agreement not found');
      }

      return mapAgreementForApi(deleted, {
        includeDeleted: true,
        onlyActivePoints: false
      });
    });
  },

  async getAgreementHistory(agreementId: string) {
    const parsedAgreementId = parseAgreementId(agreementId);
    const agreement = await prisma.agreement.findUnique({
      where: { id: parsedAgreementId },
      include: buildAgreementInclude(true, true)
    });

    if (!agreement) {
      throw new NotFoundError('Agreement not found');
    }

    const mapped = mapAgreementForApi(agreement, {
      includeDeleted: true,
      includeHistory: true,
      onlyActivePoints: false
    });

    return {
      agreementId: mapped.id,
      title: mapped.title,
      version: mapped.version,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
      history: mapped.history || []
    };
  },

  async getPublicAgreements(role?: UserRole | string | null, userId?: string | null) {
    const panel = resolveRolePanel(role);
    const parsedUserId = userId ? parseAgreementId(userId, 'user id') : undefined;

    const where: any = {
      isDeleted: false
    };

    if (panel) {
      where.OR = [
        { scope: AgreementScope.GLOBAL },
        { applicablePanels: { has: panel } }
      ];
    } else {
      where.scope = AgreementScope.GLOBAL;
    }

    const agreements = await prisma.agreement.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: buildAgreementInclude(false, false, parsedUserId)
    });

    return agreements.map((agreement) =>
      mapAgreementForApi(agreement, {
        onlyActivePoints: true
      })
    );
  },

  async acceptAgreement(
    agreementId: string,
    userId: string,
    userRole: UserRole,
    payload?: AgreementAcceptancePayload
  ) {
    const parsedAgreementId = parseAgreementId(agreementId);
    const parsedUserId = parseAgreementId(userId, 'user id');
    const visiblePanel = resolveRolePanel(userRole);

    const agreement = await prisma.agreement.findFirst({
      where: {
        id: parsedAgreementId,
        isDeleted: false,
        OR: visiblePanel
          ? [{ scope: AgreementScope.GLOBAL }, { applicablePanels: { has: visiblePanel } }]
          : [{ scope: AgreementScope.GLOBAL }]
      }
    });

    if (!agreement) {
      throw new NotFoundError('Agreement not found');
    }

    const existing = await prisma.agreementAcceptance.findFirst({
      where: {
        agreementId: parsedAgreementId,
        userId: parsedUserId,
        acceptedVersion: agreement.version
      },
      orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }]
    });

    if (existing) {
      return {
        agreementId: String(existing.agreementId),
        title: agreement.title,
        acceptedVersion: Number(existing.acceptedVersion || 0),
        acceptedAt: existing.acceptedAt,
        userId: String(existing.userId),
        userRole: String(existing.userRole),
        alreadyAccepted: true
      };
    }

    const created = await prisma.agreementAcceptance.create({
      data: {
        agreementId: parsedAgreementId,
        userId: parsedUserId,
        userRole,
        acceptedVersion: agreement.version,
        metadata: normalizeMetadata(payload?.metadata)
      }
    });

    return {
      agreementId: String(created.agreementId),
      title: agreement.title,
      acceptedVersion: Number(created.acceptedVersion || 0),
      acceptedAt: created.acceptedAt,
      userId: String(created.userId),
      userRole: String(created.userRole),
      alreadyAccepted: false
    };
  }
};
