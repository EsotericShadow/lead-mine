import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Normalize and deduplicate helpers
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

function calcIntelligenceScore(v: ReturnType<typeof toViewerBusinessBase>) {
  const phones = Math.min(3, v.phones_found || 0);
  const social = Math.min(3, v.social_accounts || 0);
  const websites = Math.min(1, v.websites_found || 0);
  const reviews = v.total_reviews > 0 ? 1 : 0;
  const rating = Math.round(Math.max(0, Math.min(5, v.average_rating || 0)) / 1); // 0..5
  return phones + social + websites + reviews + rating; // 0..13
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

function toViewerBusinessBase(b: BusinessWithRelations) {
  // Raw phones
  const rawPhones: { number: string; confidence?: number | null; type?: string | null; location?: string | null }[] = [];
  const pushPhone = (num?: string | null, conf?: number | null, type?: string | null) => {
    if (num && num.trim() !== '') rawPhones.push({ number: num.trim(), confidence: conf ?? null, type: type ?? null });
  };
  pushPhone(b.googlePhone, null, 'google');
  pushPhone(b.phone1, b.phone1Confidence, b.phone1Source);
  pushPhone(b.phone2, b.phone2Confidence, b.phone2Source);
  pushPhone(b.phone3, b.phone3Confidence, b.phone3Source);
  pushPhone(b.phone4, b.phone4Confidence, b.phone4Source);
  pushPhone(b.phone5, b.phone5Confidence, b.phone5Source);
  const phones = dedupePhones(rawPhones);

  // Social
  const social_media: { platform: string; url: string; handle?: string | null; followers?: string | null }[] = [];
  const addSocial = (platform: string, url?: string | null) => {
    if (url && url.trim() !== '') social_media.push({ platform, url });
  };
  addSocial('facebook', b.socialFacebook);
  addSocial('instagram', b.socialInstagram);
  addSocial('linkedin', b.socialLinkedin);
  addSocial('twitter', b.socialTwitter);
  addSocial('youtube', b.socialYoutube);
  addSocial('tiktok', b.socialTiktok);
  const social_dedup = dedupeByUrl(social_media);

  // Websites
  const websites: { url: string; type?: string }[] = [];
  if (b.googleOfficialWebsite) websites.push({ url: b.googleOfficialWebsite, type: 'official' });
  const websites_dedup = dedupeByUrl(websites);

  // category stored in editableData.customFields?.category
  let category = '';
  const cf = b.editableData?.customFields as Prisma.JsonValue | null;
  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    const obj = cf as Prisma.JsonObject;
    const v = obj['category'];
    if (typeof v === 'string') category = v;
  }
  if (!category) category = inferCategory(b);
  const notes = b.editableData?.notes ?? '';
  const primaryEmail = b.editableData?.primaryEmail ?? '';

  // derive outreach/stage from leadInfo.status
  const status: string | undefined = b.leadInfo?.status;
  const outreachMap: Record<string, string> = {
    NEW: 'not_contacted',
    CONTACTED: 'contacted',
    QUALIFIED: 'qualified',
    NEGOTIATING: 'negotiation',
    CLOSED_WON: 'won',
    CLOSED_LOST: 'lost',
    ON_HOLD: 'not_contacted',
  };
  const stageMap: Record<string, string> = {
    NEW: 'lead',
    CONTACTED: 'prospect',
    QUALIFIED: 'prospect',
    NEGOTIATING: 'negotiation',
    CLOSED_WON: 'won',
    CLOSED_LOST: 'lost',
    ON_HOLD: 'lead',
  };

  return {
    id: b.id,
    name: b.businessName,
    category,
    address: b.googleAddress || '',
    email: primaryEmail || '',
    phones,
    social_media: social_dedup,
    websites: websites_dedup,
    services: b.websiteAboutCopy || b.description || '',
    total_reviews: Number(b.googleReviewsCount || 0),
    average_rating: Number(b.googleRating || 0),
    scraped_at: b.scrapedAt || null,
    phones_found: phones.length,
    social_accounts: social_dedup.length,
    reviews_found: b.googleReviewsCount && b.googleReviewsCount > 0 ? 1 : 0,
    websites_found: websites_dedup.length,
    verified: (() => { const cv = b.editableData?.customFields as Prisma.JsonValue | null; if (cv && typeof cv === 'object' && !Array.isArray(cv)) { const obj = cv as Prisma.JsonObject; return Boolean(obj['verified']); } return false; })(),
    outreach_status: status ? (outreachMap[status] ?? '') : '',
    stage: status ? (stageMap[status] ?? '') : '',
    notes,
  };
}

function toViewerBusiness(b: BusinessWithRelations) {
  const base = toViewerBusinessBase(b);
  const intelligence_score = calcIntelligenceScore(base);
  return { ...base, intelligence_score };
}

import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '50');
    const search = searchParams.get('search') || '';
    const sortBy = (searchParams.get('sort_by') || '').toLowerCase();
    const sortDir = (searchParams.get('sort_dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const filterCategory = (searchParams.get('category') || '').toLowerCase();
    const verifiedParam = searchParams.get('verified') || '';
    const outreach = searchParams.get('outreach') || '';
    const stage = searchParams.get('stage') || '';
    const minScore = parseInt(searchParams.get('min_score') || '0');

    // DB fetch with search only, rest will be filtered/sorted in memory to match legacy behavior
    const where: Prisma.BusinessWhereInput = {};
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { googleAddress: { contains: search, mode: 'insensitive' } },
        { googlePhone: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await db.business.findMany({
      where,
      include: { editableData: true, leadInfo: true },
    });

    let list = rows.map(toViewerBusiness);

    // Filters
    if (filterCategory && filterCategory !== 'all') {
      list = list.filter((b) => (b.category || '').toLowerCase() === filterCategory);
    }
    if (verifiedParam === 'true') {
      list = list.filter((b) => b.verified === true);
    } else if (verifiedParam === 'false') {
      list = list.filter((b) => b.verified === false);
    }
    if (outreach) {
      list = list.filter((b) => (b.outreach_status || '') === outreach);
    }
    if (stage) {
      list = list.filter((b) => (b.stage || '') === stage);
    }
    if (!Number.isNaN(minScore) && minScore > 0) {
      list = list.filter((b) => (b.intelligence_score || 0) >= minScore);
    }

    // Sorting
const compareStr = (a?: string, b?: string) => (a || '').localeCompare(b || '');
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'intelligence') {
      list.sort((a, b) => dir * ((a.intelligence_score || 0) - (b.intelligence_score || 0)) || ((b.average_rating || 0) - (a.average_rating || 0)) || compareStr(a.name, b.name));
    } else if (sortBy === 'phones') {
      list.sort((a, b) => dir * ((a.phones_found || 0) - (b.phones_found || 0)) || compareStr(a.name, b.name));
    } else if (sortBy === 'websites') {
      list.sort((a, b) => dir * ((a.websites_found || 0) - (b.websites_found || 0)) || compareStr(a.name, b.name));
    } else if (sortBy === 'reviews') {
      list.sort((a, b) => dir * ((a.total_reviews || 0) - (b.total_reviews || 0)) || compareStr(a.name, b.name));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => dir * ((a.average_rating || 0) - (b.average_rating || 0)) || compareStr(a.name, b.name));
    } else if (sortBy === 'name') {
      list.sort((a, b) => dir * compareStr(a.name, b.name));
    } else if (sortBy === 'category') {
      list.sort((a, b) => dir * compareStr(a.category || 'zzz', b.category || 'zzz') || compareStr(a.name, b.name));
    } else {
      // Default: intelligence desc, then rating desc, then name asc
      list.sort((a, b) => (b.intelligence_score || 0) - (a.intelligence_score || 0) || (b.average_rating || 0) - (a.average_rating || 0) || compareStr(a.name, b.name));
    }

    const total = list.length;
    const total_pages = Math.max(1, Math.ceil(total / perPage));
    const pageSafe = Math.max(1, Math.min(page, total_pages));
    const start = (pageSafe - 1) * perPage;
    const slice = list.slice(start, start + perPage);

    return NextResponse.json({
      businesses: slice,
      total,
      page: pageSafe,
      per_page: perPage,
      total_pages,
    });
  } catch (e) {
    console.error('legacy/businesses error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

