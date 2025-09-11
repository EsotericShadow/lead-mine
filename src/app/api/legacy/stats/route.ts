import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const total = await db.business.count();

    // Phone coverage: any of googlePhone or phone1..phone5 present
    const phonesCovered = await db.business.count({
      where: {
        OR: [
          { googlePhone: { not: null } },
          { phone1: { not: null } },
          { phone2: { not: null } },
          { phone3: { not: null } },
          { phone4: { not: null } },
          { phone5: { not: null } },
        ],
      },
    });

    const socialCovered = await db.business.count({
      where: {
        OR: [
          { socialFacebook: { not: null } },
          { socialInstagram: { not: null } },
          { socialLinkedin: { not: null } },
          { socialTwitter: { not: null } },
          { socialYoutube: { not: null } },
          { socialTiktok: { not: null } },
        ],
      },
    });

    const reviewsCovered = await db.business.count({
      where: { googleReviewsCount: { gt: 0 } },
    });

    const websitesCovered = await db.business.count({
      where: { googleOfficialWebsite: { not: null } },
    });

    const ratings = await db.business.aggregate({
      _avg: { googleRating: true },
    });

    const stats = {
      total_businesses: total,
      phone_coverage: total > 0 ? Math.round((phonesCovered / total) * 100) : 0,
      social_coverage: total > 0 ? Math.round((socialCovered / total) * 100) : 0,
      review_coverage: total > 0 ? Math.round((reviewsCovered / total) * 100) : 0,
      website_coverage: total > 0 ? Math.round((websitesCovered / total) * 100) : 0,
      avg_intelligence_score: 0,
      avg_rating: Number(ratings._avg.googleRating ?? 0),
      loaded_file: 'Database (Prisma)',
    };

    return NextResponse.json(stats);
  } catch (e) {
    console.error('legacy/stats error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

