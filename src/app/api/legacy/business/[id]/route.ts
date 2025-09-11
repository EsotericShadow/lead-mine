import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GoogleReview = { author?: string; rating?: number; date?: string; text?: string };
function parseGoogleReviewsJson(jsonStr?: string | null): GoogleReview[] {
  if (!jsonStr) return [];
  try {
    const data = JSON.parse(jsonStr);
    if (Array.isArray(data)) return data as GoogleReview[];
    return [];
  } catch {
    return [];
  }
}

import { Prisma } from '@prisma/client';

function normalizePhone(num: string) {
  const digits = num.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function dedupePhones(list: { number: string; confidence?: number | null; type?: string | null; location?: string | null }[]) {
  const seen = new Set<string>();
  const out: typeof list = [];
  for (const item of list) {
    const key = normalizePhone(item.number || '');
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeByUrl<T extends { url: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const norm = (u: string) => (u || '').replace(/\/$/, '').toLowerCase();
  return arr.filter(({ url }) => {
    const key = norm(url);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type BusinessWithRelations = Prisma.BusinessGetPayload<{ include: { editableData: true; leadInfo: true } }>;

function inferCategoryFromText(text: string): string | null {
  const entries: Array<{cat: string; patterns: RegExp[]}> = [
    { cat: 'Restaurant', patterns: [/\brestaurant\b/i, /\bdiner\b/i] },
    { cat: 'Cafe', patterns: [/\bcafe\b/i, /\bcoffee\b/i, /\bespresso\b/i] },
    { cat: 'Bakery', patterns: [/\bbakery\b/i, /\bbaker\b/i] },
    { cat: 'Bar', patterns: [/\bbar\b/i, /\bpub\b/i, /\btavern\b/i, /\bbrewery\b/i] },
    { cat: 'Pizza', patterns: [/\bpizza\b/i, /\bpizzeria\b/i] },
    { cat: 'Sushi', patterns: [/\bsushi\b/i] },
    { cat: 'Chinese Restaurant', patterns: [/\bchinese\b/i] },
    { cat: 'Indian Restaurant', patterns: [/\bindian\b/i, /\bcurry\b/i] },
    { cat: 'Thai Restaurant', patterns: [/\bthai\b/i] },
    { cat: 'Mexican Restaurant', patterns: [/\bmexican\b/i, /\btaqueria\b/i] },
    { cat: 'Seafood', patterns: [/\bseafood\b/i, /\bfish\b/i, /\boyster\b/i] },
    { cat: 'Steakhouse', patterns: [/\bsteak\b/i] },
    { cat: 'BBQ', patterns: [/\bbbq\b/i, /barbecue/i] },

    { cat: 'Salon', patterns: [/\bsalon\b/i, /\bhair\b/i, /\bbarber\b/i] },
    { cat: 'Spa', patterns: [/\bspa\b/i, /\bmassage\b/i] },
    { cat: 'Nail Salon', patterns: [/\bnail\b/i] },

    { cat: 'Gym', patterns: [/\bgym\b/i, /\bfitness\b/i] },
    { cat: 'Yoga Studio', patterns: [/\byoga\b/i, /\bpilates\b/i] },

    { cat: 'Hotel', patterns: [/\bhotel\b/i, /\binn\b/i, /\blodge\b/i, /\bmotel\b/i] },

    { cat: 'Auto Repair', patterns: [/\bauto\b/i, /\bmechanic\b/i, /\brepair\b/i, /\btire\b/i, /\bgarage\b/i] },
    { cat: 'Car Wash', patterns: [/\bcar\s*wash\b/i] },
    { cat: 'Car Dealership', patterns: [/\bdealership\b/i] },

    { cat: 'Plumber', patterns: [/\bplumb\w*/i] },
    { cat: 'Electrician', patterns: [/\belectric\w*/i] },
    { cat: 'HVAC', patterns: [/\bhvac\b/i, /\bheating\b/i, /\bcooling\b/i, /\bfurnace\b/i] },
    { cat: 'Roofer', patterns: [/\broof\w*/i] },
    { cat: 'Painter', patterns: [/\bpaint\w*/i] },
    { cat: 'Landscaping', patterns: [/\blandscap\w*/i, /\blawn\b/i, /\bsnow removal\b/i] },
    { cat: 'Construction', patterns: [/\bconstruct\w*/i, /\bcontractor\b/i] },

    { cat: 'Real Estate', patterns: [/\breal\s*estate\b/i, /\brealtor\b/i] },
    { cat: 'Law Firm', patterns: [/\blaw\b/i, /\blawyer\b/i, /\blegal\b/i] },
    { cat: 'Accounting', patterns: [/\baccount\w*/i, /\btax\b/i, /\bbookkeep\w*/i] },

    { cat: 'Medical Clinic', patterns: [/\bclinic\b/i, /\bmedical\b/i] },
    { cat: 'Dentist', patterns: [/\bdent\w*/i] },
    { cat: 'Pharmacy', patterns: [/\bpharmac\w*/i] },
    { cat: 'Veterinary', patterns: [/\bvet\w*/i, /\bveterinary\b/i] },

    { cat: 'Grocery', patterns: [/\bgrocery\b/i, /\bsupermarket\b/i] },
    { cat: 'Convenience Store', patterns: [/\bconvenience\b/i] },
    { cat: 'Hardware Store', patterns: [/\bhardware\b/i] },
    { cat: 'Retail', patterns: [/\bboutique\b/i, /\bclothing\b/i, /\bapparel\b/i, /\bstore\b/i, /\bshop\b/i] },

    { cat: 'School', patterns: [/\bschool\b/i, /\bdaycare\b/i, /\bchildcare\b/i, /\btutoring\b/i] },

    { cat: 'Cleaning Service', patterns: [/\bclean\w*/i, /\bjanitorial\b/i] },
    { cat: 'Photography', patterns: [/\bphotograph\w*/i] },
    { cat: 'Marketing Agency', patterns: [/\bmarketing\b/i, /\badvertis\w*/i, /\bsocial\s*media\b/i] },
    { cat: 'Design/Print', patterns: [/\bgraphic\b/i, /\bdesign\b/i, /\bprint\w*/i, /\bweb\s*design\b/i] },
    { cat: 'Locksmith', patterns: [/\blocksmith\b/i] },
  ];
  for (const e of entries) {
    for (const r of e.patterns) {
      if (r.test(text)) return e.cat;
    }
  }
  return null;
}

function inferCategory(b: BusinessWithRelations): string {
  const parts: string[] = [];
  if (b.businessName) parts.push(b.businessName);
  if (b.description) parts.push(b.description);
  if (b.websiteAboutCopy) parts.push(b.websiteAboutCopy);
  const text = parts.join(' \n ');
  return inferCategoryFromText(text) || '';
}

function mapDetail(b: BusinessWithRelations) {
  let phones: { number: string; confidence?: number | null; type?: string | null; location?: string | null }[] = [];
  const pushPhone = (num?: string | null, conf?: number | null, type?: string | null) => {
    if (num && num.trim() !== '') phones.push({ number: num.trim(), confidence: conf ?? null, type: type ?? null });
  };
  pushPhone(b.googlePhone, null, 'google');
  pushPhone(b.phone1, b.phone1Confidence, b.phone1Source);
  pushPhone(b.phone2, b.phone2Confidence, b.phone2Source);
  pushPhone(b.phone3, b.phone3Confidence, b.phone3Source);
  pushPhone(b.phone4, b.phone4Confidence, b.phone4Source);
  pushPhone(b.phone5, b.phone5Confidence, b.phone5Source);
  phones = dedupePhones(phones);

  let social_media: { platform: string; url: string }[] = [];
  const addSocial = (platform: string, url?: string | null) => {
    if (url && url.trim() !== '') social_media.push({ platform, url });
  };
  addSocial('facebook', b.socialFacebook);
  addSocial('instagram', b.socialInstagram);
  addSocial('linkedin', b.socialLinkedin);
  addSocial('twitter', b.socialTwitter);
  addSocial('youtube', b.socialYoutube);
  addSocial('tiktok', b.socialTiktok);
  social_media = dedupeByUrl(social_media);

  let websites: { url: string; type?: string }[] = [];
  if (b.googleOfficialWebsite) websites.push({ url: b.googleOfficialWebsite, type: 'official' });
  websites = dedupeByUrl(websites);

  const google = {
    rating: Number(b.googleRating || 0),
    reviews_count: Number(b.googleReviewsCount || 0),
    address: b.googleAddress || '',
    phone: b.googlePhone || '',
    hours_summary: b.googleHoursSummary || '',
    from_business: b.googleFromBusiness || '',
    place_url: b.googlePlaceUrl || '',
    maps_search_url: b.googleMapsSearchUrl || '',
    official_website: b.googleOfficialWebsite || '',
    reviews: parseGoogleReviewsJson(b.googleReviewsJson),
  };

  let category = '';
  {
    const cf = b.editableData?.customFields as Prisma.JsonValue | null;
    if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
      const obj = cf as Prisma.JsonObject;
      const v = obj['category'];
      if (typeof v === 'string') category = v;
    }
  }
  if (!category) category = inferCategory(b);
  const primaryEmail = b.editableData?.primaryEmail ?? '';

  return {
    id: b.id,
    name: b.businessName,
    category,
    address: b.googleAddress || '',
    email: primaryEmail || '',
    phones,
    social_media,
    websites,
    services: b.websiteAboutCopy || b.description || '',
    total_reviews: Number(b.googleReviewsCount || 0),
    average_rating: Number(b.googleRating || 0),
    scraped_at: b.scrapedAt || null,
    intelligence_score: 0,
    google,
  };
}

import { getCurrentUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const b = await db.business.findUnique({
      where: { id: params.id },
      include: { editableData: true, leadInfo: true },
    });
    if (!b) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(mapDetail(b));
  } catch (e) {
    console.error('legacy/business detail error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

