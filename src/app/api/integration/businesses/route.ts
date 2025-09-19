import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { requireIntegrationKey } from '@/lib/integrationAuth';
import { generateInviteToken } from '@/lib/campaignTokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseBooleanParam(value: string | null, defaultValue = false) {
  if (value == null) return defaultValue;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseLimitParam(value: string | null, fallback = 200) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 500);
}

export async function GET(request: NextRequest) {
  const authError = requireIntegrationKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const limit = parseLimitParam(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor') || undefined;
  const onlyEmailable = parseBooleanParam(url.searchParams.get('hasEmail'));
  const createMissing = parseBooleanParam(url.searchParams.get('createMissing'));
  const idsParam = url.searchParams.get('ids');
  const searchTerm = url.searchParams.get('search')?.trim();

  const ids = idsParam
    ? idsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  if (createMissing) {
    const missingIds = await db.business.findMany({
      where: {
        campaignInvite: { is: null },
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      select: { id: true },
    });

    if (missingIds.length) {
      const tokens = new Set<string>();
      const inviteData = missingIds.map(({ id }) => {
        let token = generateInviteToken();
        while (tokens.has(token)) {
          token = generateInviteToken();
        }
        tokens.add(token);
        return { businessId: id, token };
      });

      await db.campaignInvite.createMany({ data: inviteData, skipDuplicates: true });
    }
  }

  const where: Prisma.BusinessWhereInput = {};
  if (ids?.length) {
    where.id = { in: ids };
  }
  if (onlyEmailable) {
    where.editableData = {
      is: {
        OR: [
          { primaryEmail: { not: null } },
          { alternateEmail: { not: null } },
        ],
      },
    };
  }

  if (searchTerm) {
    where.OR = [
      { businessName: { contains: searchTerm, mode: 'insensitive' } },
      { googleAddress: { contains: searchTerm, mode: 'insensitive' } },
      {
        editableData: {
          is: {
            OR: [
              { contactPerson: { contains: searchTerm, mode: 'insensitive' } },
              { tags: { has: searchTerm } },
            ],
          },
        },
      },
    ];
  }

  const businesses = await db.business.findMany({
    where,
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: 'asc' },
    include: {
      editableData: {
        select: {
          primaryEmail: true,
          alternateEmail: true,
          contactPerson: true,
          tags: true,
        },
      },
      leadInfo: {
        select: {
          status: true,
          priority: true,
          assignedTo: true,
          nextFollowUpDate: true,
        },
      },
      campaignInvite: {
        select: {
          token: true,
          emailsSent: true,
          lastEmailSent: true,
          visitsCount: true,
          lastVisitedAt: true,
          rsvpsCount: true,
          lastRsvpAt: true,
          lastEmailMeta: true,
          lastVisitMeta: true,
          lastRsvpMeta: true,
        },
      },
    },
  });

  const lastRecord = businesses.length === limit ? businesses[businesses.length - 1] : null;

  const payload = businesses.map((biz) => ({
    id: biz.id,
    name: biz.businessName,
    address: biz.googleAddress,
    website: biz.googleOfficialWebsite || biz.websiteFound,
    createdAt: biz.createdAt,
    contact: {
      primaryEmail: biz.editableData?.primaryEmail || null,
      alternateEmail: biz.editableData?.alternateEmail || null,
      contactPerson: biz.editableData?.contactPerson || null,
      tags: biz.editableData?.tags ?? [],
    },
    lead: {
      status: biz.leadInfo?.status ?? null,
      priority: biz.leadInfo?.priority ?? null,
      assignedTo: biz.leadInfo?.assignedTo ?? null,
      nextFollowUpDate: biz.leadInfo?.nextFollowUpDate ?? null,
    },
    invite: biz.campaignInvite
      ? {
          token: biz.campaignInvite.token,
          emailsSent: biz.campaignInvite.emailsSent,
          lastEmailSent: biz.campaignInvite.lastEmailSent,
          visitsCount: biz.campaignInvite.visitsCount,
          lastVisitedAt: biz.campaignInvite.lastVisitedAt,
          rsvpsCount: biz.campaignInvite.rsvpsCount,
          lastRsvpAt: biz.campaignInvite.lastRsvpAt,
          lastEmailMeta: biz.campaignInvite.lastEmailMeta,
          lastVisitMeta: biz.campaignInvite.lastVisitMeta,
          lastRsvpMeta: biz.campaignInvite.lastRsvpMeta,
        }
      : null,
  }));

  return NextResponse.json({
    data: payload,
    pagination: {
      limit,
      nextCursor: lastRecord ? lastRecord.id : null,
    },
  });
}
