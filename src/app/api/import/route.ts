import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { runImport } from '@/lib/import-csv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    // In development, allow import without auth for convenience
    if (process.env.NODE_ENV === 'production') {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('Starting CSV import...');
    
    // Run the import
    await runImport();
    
    return NextResponse.json(
      { message: 'CSV import completed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
