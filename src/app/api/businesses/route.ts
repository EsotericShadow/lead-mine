import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { LeadStatus, Priority, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    // Normalize status and priority: treat 'all' or missing as undefined
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');

    const status: LeadStatus | undefined = statusParam && statusParam !== 'all' &&
      (Object.values(LeadStatus) as string[]).includes(statusParam)
      ? (statusParam as LeadStatus)
      : undefined;

    const priority: Priority | undefined = priorityParam && priorityParam !== 'all' &&
      (Object.values(Priority) as string[]).includes(priorityParam)
      ? (priorityParam as Priority)
      : undefined;

    const assignedTo = searchParams.get('assignedTo') || '';
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];

    // Optional filters
    const hasNotesParam = searchParams.get('hasNotes');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const offset = (page - 1) * limit;

    // Build where clause
    const where: Prisma.BusinessWhereInput = {};

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { googleAddress: { contains: search, mode: 'insensitive' } },
        { googlePhone: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leadInfoFilters: Prisma.LeadInfoWhereInput = {};
    if (status) {
      leadInfoFilters.status = status;
    }
    if (priority) {
      leadInfoFilters.priority = priority;
    }
    if (assignedTo) {
      leadInfoFilters.assignedTo = assignedTo;
    }
    if (dateFrom || dateTo) {
      leadInfoFilters.lastContactDate = {};
      if (dateFrom) {
        (leadInfoFilters.lastContactDate as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (leadInfoFilters.lastContactDate as Prisma.DateTimeFilter).lte = new Date(dateTo);
      }
    }
    if (Object.keys(leadInfoFilters).length > 0) {
      where.leadInfo = { is: leadInfoFilters };
    }

    if (tags.length > 0) {
      where.editableData = {
        is: {
          tags: {
            hasEvery: tags,
          },
        },
      };
    }

    if (hasNotesParam === 'true') {
      where.notes = { some: {} };
    } else if (hasNotesParam === 'false') {
      where.notes = { none: {} };
    }

    // Get businesses with all related data
    const [businesses, totalCount] = await Promise.all([
      db.business.findMany({
        where,
        include: {
          leadInfo: true,
          editableData: true,
          notes: {
            orderBy: { createdAt: 'desc' },
            take: 3 // Latest 3 notes
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      db.business.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      businesses,
      pagination: {
        page,
        limit,
        totalCount,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });

  } catch (error) {
    console.error('Businesses API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch businesses' },
      { status: 500 }
    );
  }
}
