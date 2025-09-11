import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Get unique assignees
    const assigneesResult = await db.leadInfo.findMany({
      select: {
        assignedTo: true,
      },
      where: {
        assignedTo: {
          not: '',
        },
      },
      distinct: ['assignedTo'],
    });

    const assignees = assigneesResult.map((result) => result.assignedTo);

    // Get unique tags (non-empty arrays)
    const editableDataResult = await db.editableBusinessData.findMany({
      select: {
        tags: true,
      },
      where: {
        tags: {
          isEmpty: false,
        },
      },
    });

    // Flatten and deduplicate tags
    const allTags = editableDataResult.flatMap((result) => result.tags);
    const tags = Array.from(new Set(allTags));

    return NextResponse.json({
      assignees,
      tags,
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
