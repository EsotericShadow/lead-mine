import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { LeadStatus, Priority } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateBusinessSchema = z.object({
  leadInfo: z.object({
    status: z.nativeEnum(LeadStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    assignedTo: z.string().optional(),
    estimatedValue: z.number().optional(),
    expectedCloseDate: z.string().optional(),
    lastContactDate: z.string().optional(),
    nextFollowUpDate: z.string().optional(),
  }).optional(),
  editableData: z.object({
    primaryPhone: z.string().optional(),
    primaryEmail: z.string().optional(),
    contactPerson: z.string().optional(),
    alternatePhone: z.string().optional(),
    alternateEmail: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const business = await db.business.findUnique({
      where: { id: params.id },
      include: {
        leadInfo: true,
        editableData: true,
        notes: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ business });

  } catch (error) {
    console.error('Get business API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = updateBusinessSchema.safeParse(body);

    if (!result.success) {
      const formatted = result.error.flatten();
      return NextResponse.json(
        { error: 'Invalid input', details: formatted.fieldErrors },
        { status: 400 }
      );
    }

    const { leadInfo, editableData } = result.data;

    // Start transaction
    const updatedBusiness = await db.$transaction(async (tx) => {
      // Update lead info if provided
      if (leadInfo) {
        type LeadInfoUpdate = Partial<{
          status: LeadStatus;
          priority: Priority;
          assignedTo: string;
          estimatedValue: number;
          expectedCloseDate: Date;
          lastContactDate: Date;
          nextFollowUpDate: Date;
        }>;

        const updateData: LeadInfoUpdate = {};

        if (leadInfo.status !== undefined) updateData.status = leadInfo.status;
        if (leadInfo.priority !== undefined) updateData.priority = leadInfo.priority;
        if (leadInfo.assignedTo !== undefined) updateData.assignedTo = leadInfo.assignedTo;
        if (leadInfo.estimatedValue !== undefined) updateData.estimatedValue = leadInfo.estimatedValue;
        if (leadInfo.expectedCloseDate) updateData.expectedCloseDate = new Date(leadInfo.expectedCloseDate);
        if (leadInfo.lastContactDate) updateData.lastContactDate = new Date(leadInfo.lastContactDate);
        if (leadInfo.nextFollowUpDate) updateData.nextFollowUpDate = new Date(leadInfo.nextFollowUpDate);

        await tx.leadInfo.upsert({
          where: { businessId: params.id },
          update: updateData,
          create: {
            businessId: params.id,
            status: LeadStatus.NEW,
            priority: Priority.MEDIUM,
            assignedTo: user.username,
            estimatedValue: 0,
            source: 'Manual Entry',
            ...updateData
          }
        });
      }

      // Update editable data if provided
      if (editableData) {
        await tx.editableBusinessData.upsert({
          where: { businessId: params.id },
          update: editableData,
          create: {
            businessId: params.id,
            primaryPhone: '',
            primaryEmail: '',
            contactPerson: '',
            notes: '',
            tags: [],
            ...editableData
          }
        });
      }

      // Fetch updated business
      return await tx.business.findUnique({
        where: { id: params.id },
        include: {
          leadInfo: true,
          editableData: true,
          notes: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });
    });

    return NextResponse.json({ business: updatedBusiness });

  } catch (error) {
    console.error('Update business API error:', error);
    return NextResponse.json(
      { error: 'Failed to update business' },
      { status: 500 }
    );
  }
}
