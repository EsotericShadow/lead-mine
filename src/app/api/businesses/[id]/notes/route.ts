import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { NoteType } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
  type: z.nativeEnum(NoteType).optional().default(NoteType.GENERAL),
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

    const notes = await db.note.findMany({
      where: { businessId: params.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ notes });

  } catch (error) {
    console.error('Get notes API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const result = createNoteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    const { content, type } = result.data;

    // Check if business exists
    const business = await db.business.findUnique({
      where: { id: params.id }
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Create note
    const note = await db.note.create({
      data: {
        businessId: params.id,
        content,
        type,
        createdBy: user.username
      }
    });

    // Update last contact date if this is a call or meeting
    if (type === NoteType.CALL || type === NoteType.MEETING) {
      await db.leadInfo.updateMany({
        where: { businessId: params.id },
        data: { lastContactDate: new Date() }
      });
    }

    return NextResponse.json({ note });

  } catch (error) {
    console.error('Create note API error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
