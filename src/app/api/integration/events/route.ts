import { NextRequest, NextResponse } from 'next/server';

import { NoteType } from '@prisma/client';

import { db } from '@/lib/db';
import { requireIntegrationKey } from '@/lib/integrationAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_EVENT_TYPES = ['email_sent', 'visit', 'rsvp'] as const;
type EventType = (typeof VALID_EVENT_TYPES)[number];

type EventPayload = {
  token?: string;
  businessId?: string;
  type?: EventType;
  meta?: Record<string, unknown>;
};

function validatePayload(payload: EventPayload): { type: EventType; token?: string; businessId?: string } | { error: string } {
  if (!payload) return { error: 'Missing payload' };

  if (payload.token && typeof payload.token !== 'string') return { error: 'token must be a string' };
  if (payload.businessId && typeof payload.businessId !== 'string') return { error: 'businessId must be a string' };
  if (!payload.token && !payload.businessId) {
    return { error: 'token or businessId is required' };
  }

  if (!payload.type || !VALID_EVENT_TYPES.includes(payload.type)) {
    return { error: `type must be one of ${VALID_EVENT_TYPES.join(', ')}` };
  }

  return { type: payload.type, token: payload.token, businessId: payload.businessId };
}

export async function POST(request: NextRequest) {
  const authError = requireIntegrationKey(request);
  if (authError) return authError;

  let body: EventPayload;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validatePayload(body);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { token, type, businessId } = validation;

  const invite = token
    ? await db.campaignInvite.findUnique({
        where: { token },
        select: { id: true, businessId: true, token: true },
      })
    : await db.campaignInvite.findUnique({
        where: { businessId: businessId! },
        select: { id: true, businessId: true, token: true },
      });

  if (!invite) {
    return NextResponse.json({ error: 'Unknown invite token' }, { status: 404 });
  }

  const now = new Date();

  if (type === 'email_sent') {
    await db.campaignInvite.update({
      where: { token: invite.token },
      data: {
        emailsSent: { increment: 1 },
        lastEmailSent: now,
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (type === 'visit') {
    await db.campaignInvite.update({
      where: { token: invite.token },
      data: {
        visitsCount: { increment: 1 },
        lastVisitedAt: now,
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (type === 'rsvp') {
    await db.$transaction(async (tx) => {
      await tx.campaignInvite.update({
        where: { token: invite.token },
        data: {
          rsvpsCount: { increment: 1 },
          lastRsvpAt: now,
        },
      });

      const explicitNote = (body.meta?.note as string | undefined)?.trim();
      const rsvpId = body.meta?.rsvpId as string | undefined;
      const noteContent = explicitNote || `RSVP recorded via integration${rsvpId ? ` (rsvp: ${rsvpId})` : ''}`;
      if (noteContent) {
        await tx.note.create({
          data: {
            businessId: invite.businessId,
            content: noteContent.trim(),
            type: NoteType.EMAIL,
            createdBy: 'integration',
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
