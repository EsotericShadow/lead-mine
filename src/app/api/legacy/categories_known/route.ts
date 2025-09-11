import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Known categories: same as present categories for now, sorted
    const rows = await db.editableBusinessData.findMany({
      select: { customFields: true },
    });

    const set = new Set<string>();
    for (const row of rows) {
      const cf = row.customFields as Prisma.JsonValue | null;
      if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
        const obj = cf as Prisma.JsonObject;
        const v = obj['category'];
        if (typeof v === 'string') {
          const name = v.trim();
          if (name) set.add(name);
        }
      }
    }

    // Fallback: infer categories from business text if none present
    if (set.size === 0) {
      const businesses = await db.business.findMany({ select: { businessName: true, description: true, websiteAboutCopy: true } });
      for (const b of businesses) {
        const parts: string[] = [];
        if (b.businessName) parts.push(b.businessName);
        if (b.description) parts.push(b.description);
        if (b.websiteAboutCopy) parts.push(b.websiteAboutCopy);
        const cat = inferCategoryFromText(parts.join(' \n '));
        if (cat) set.add(cat);
      }
    }

    const categories = Array.from(set).sort((a, b) => a.localeCompare(b));
    return NextResponse.json(categories);
  } catch (e) {
    console.error('legacy/categories_known error', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

