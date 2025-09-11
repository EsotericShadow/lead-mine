import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LeadStatus } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { verified, outreach_status, stage, notes, category } = body || {};

    // Map stage to LeadStatus if provided
    const stageMap: Record<string, LeadStatus> = {
      lead: LeadStatus.NEW,
      prospect: LeadStatus.QUALIFIED,
      negotiation: LeadStatus.NEGOTIATING,
      won: LeadStatus.CLOSED_WON,
      lost: LeadStatus.CLOSED_LOST,
    };

    const outreachMap: Record<string, LeadStatus> = {
      not_contacted: LeadStatus.NEW,
      attempted: LeadStatus.CONTACTED,
      contacted: LeadStatus.CONTACTED,
      qualified: LeadStatus.QUALIFIED,
      won: LeadStatus.CLOSED_WON,
      lost: LeadStatus.CLOSED_LOST,
    };

    const statusFromStage = stage ? stageMap[String(stage).toLowerCase()] : undefined;
    const statusFromOutreach = outreach_status ? outreachMap[String(outreach_status).toLowerCase()] : undefined;

    await db.$transaction(async (tx) => {
      // Update editable data (notes and customFields)
      const existing = await tx.editableBusinessData.findUnique({ where: { businessId: params.id } });
      const current = existing?.customFields as import('@prisma/client').Prisma.JsonValue | null;
      let newCustom: Record<string, unknown> = {};
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        newCustom = { ...(current as import('@prisma/client').Prisma.JsonObject) } as Record<string, unknown>;
      }
      if (typeof verified !== 'undefined') newCustom['verified'] = Boolean(verified);
      if (typeof category === 'string') newCustom['category'] = category;

      await tx.editableBusinessData.upsert({
        where: { businessId: params.id },
        update: {
          notes: typeof notes === 'string' ? notes : existing?.notes || '',
          customFields: newCustom as import('@prisma/client').Prisma.InputJsonObject,
        },
        create: {
          businessId: params.id,
          primaryPhone: '',
          primaryEmail: '',
          contactPerson: '',
          notes: typeof notes === 'string' ? notes : '',
          tags: [],
          customFields: newCustom as import('@prisma/client').Prisma.InputJsonObject,
        },
      });

      // Update lead status
      const targetStatus = statusFromStage ?? statusFromOutreach;
      if (targetStatus) {
        await tx.leadInfo.upsert({
          where: { businessId: params.id },
          update: { status: targetStatus },
          create: {
            businessId: params.id,
            status: targetStatus,
            priority: 'MEDIUM',
            assignedTo: 'system',
            estimatedValue: 0,
            source: 'Legacy Viewer',
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('legacy update error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

