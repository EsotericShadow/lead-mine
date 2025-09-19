import { db } from '../src/lib/db';
import { Prisma } from '@prisma/client';

function normalizePhone(num: string) {
  const digits = (num || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

type BusinessWithRels = import('@prisma/client').Prisma.BusinessGetPayload<{ include: { editableData: true; leadInfo: true } }>;

function bestPrimaryPhone(b: BusinessWithRels): string | null {
  const candidates: { num: string; conf: number }[] = [];
  const push = (num?: string | null, conf?: number | null) => {
    if (!num) return;
    const n = num.trim();
    if (!n) return;
    const key = normalizePhone(n);
    if (!key) return;
    candidates.push({ num: n, conf: typeof conf === 'number' && Number.isFinite(conf) ? conf : 0 });
  };
  push(b.googlePhone, 0);
  push(b.phone1, b.phone1Confidence);
  push(b.phone2, b.phone2Confidence);
  push(b.phone3, b.phone3Confidence);
  push(b.phone4, b.phone4Confidence);
  push(b.phone5, b.phone5Confidence);
  // Dedupe by normalized digits, keep max confidence
  const byDigits = new Map<string, { num: string; conf: number }>();
  for (const c of candidates) {
    const key = normalizePhone(c.num);
    const prev = byDigits.get(key);
    if (!prev || c.conf > prev.conf) byDigits.set(key, c);
  }
  const list = Array.from(byDigits.values());
  if (list.length === 0) return null;
  list.sort((a, b) => b.conf - a.conf);
  return list[0].num;
}

function inferCategoryFromText(text: string): string | null {
  const entries: Array<{ cat: string; patterns: RegExp[] }> = [
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

function inferCategory(b: BusinessWithRels): string | null {
  const parts: string[] = [];
  if (b.businessName) parts.push(b.businessName);
  if (b.description) parts.push(b.description);
  if (b.websiteAboutCopy) parts.push(b.websiteAboutCopy);
  const text = parts.join(' \n ');
  return inferCategoryFromText(text);
}

function getPrismaErrorCode(e: unknown): string | undefined {
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const code = obj['code'];
    if (typeof code === 'string') return code;
  }
  return undefined;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const code = getPrismaErrorCode(e);
      if (attempt < retries && (code === 'P1017' || code === 'P1001' || code === 'P1008')) {
        console.warn(`Retrying after Prisma error ${code} (attempt ${attempt}/${retries})`);
        try { await db.$disconnect(); } catch {}
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw e;
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new Error(lastErr ? String(lastErr) : 'Unknown error');
}

async function backfillBatch(skip: number, take: number) {
  const rows = await db.business.findMany({
    skip,
    take,
    orderBy: { createdAt: 'asc' },
    include: { editableData: true, leadInfo: true },
  });
  let updated = 0;
  for (const b of rows) {
    await withRetry(() => db.$transaction(async (tx) => {
      // Ensure leadInfo exists
      if (!b.leadInfo) {
        await tx.leadInfo.create({
          data: {
            businessId: b.id,
            status: 'NEW',
            priority: 'MEDIUM',
            assignedTo: 'system',
            estimatedValue: 0,
            source: 'Backfill',
          },
        });
        updated++;
      }

      // Build updates for editableData
      const existing = await tx.editableBusinessData.findUnique({ where: { businessId: b.id } });
      let cf: Prisma.InputJsonObject = {};
      if (existing?.customFields && typeof existing.customFields === 'object' && !Array.isArray(existing.customFields)) {
        cf = { ...(existing.customFields as Prisma.JsonObject) } as unknown as Prisma.InputJsonObject;
      }

      // Set category if missing
      const currentCat = (cf['category'] as string | undefined) || '';
      if (!currentCat) {
        const inferred = inferCategory(b) || '';
        if (inferred) cf['category'] = inferred;
      }

      // Primary phone if missing
      const primaryPhoneExisting = existing?.primaryPhone?.trim();
      const primaryPhoneNew = !primaryPhoneExisting ? bestPrimaryPhone(b) : null;

      if (existing) {
        const updateData: import('@prisma/client').Prisma.EditableBusinessDataUpdateInput = {};
        if (primaryPhoneNew) updateData.primaryPhone = primaryPhoneNew;
        if (Object.keys(cf).length > 0) updateData.customFields = cf;
        if (existing.tags == null) updateData.tags = [];
        if (Object.keys(updateData).length > 0) {
          await tx.editableBusinessData.update({ where: { businessId: b.id }, data: updateData });
          updated++;
        }
      } else {
        await tx.editableBusinessData.create({
          data: {
            businessId: b.id,
            primaryPhone: primaryPhoneNew || bestPrimaryPhone(b) || '',
            primaryEmail: '',
            contactPerson: '',
            notes: '',
            tags: [],
            customFields: cf,
          },
        });
        updated++;
      }
    }), 3, 750);
    // Small delay to be gentle with serverless DBs
    await new Promise((r) => setTimeout(r, 10));
  }
  return { count: rows.length, updated };
}

async function main() {
  console.log('Starting backfill...');
  const total = await db.business.count();
  const take = Number(process.env.BACKFILL_TAKE || '100');
  let skip = 0;
  let totalUpdated = 0;
  while (skip < total) {
    console.log(`[backfill] Processing batch skip=${skip} take=${take}`);
    const { count, updated } = await backfillBatch(skip, take);
    totalUpdated += updated;
    console.log(`Processed ${skip + count}/${total} (updated ${updated} in this batch)`);
    if (count < take) break;
    skip += take;
  }
  console.log(`Backfill complete. Updated records: ${totalUpdated}`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
