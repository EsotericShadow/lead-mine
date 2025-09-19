import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { Prisma } from '@prisma/client';

import { db } from '../src/lib/db';

const DEFAULT_REGISTRY_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'Active-Business-Licences-with-email  - June 18, 2025.xlsx',
);

const EXTRACT_SCRIPT_PATH = path.resolve(__dirname, 'extract_registry_emails.py');

type RegistryRecord = {
  name: string;
  email: string;
};

type BusinessRecord = {
  id: string;
  businessName: string;
  editableData: {
    id: string;
    primaryEmail: string | null;
    alternateEmail: string | null;
    tags: string[];
  } | null;
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

async function loadRegistry(pathToWorkbook: string): Promise<RegistryRecord[]> {
  const resolvedPath = path.resolve(pathToWorkbook);
  const result = spawnSync('python3', [EXTRACT_SCRIPT_PATH, resolvedPath], {
    encoding: 'utf-8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'unknown error';
    throw new Error(`Failed to extract registry emails (exit ${result.status}): ${stderr}`);
  }

  try {
    const data = JSON.parse(result.stdout) as RegistryRecord[];
    return data;
  } catch (error) {
    throw new Error(`Failed to parse registry extractor output: ${(error as Error).message}`);
  }
}

async function main() {
  const registryPath = process.argv[2] ? process.argv[2] : DEFAULT_REGISTRY_PATH;
  console.log(`> Using registry workbook: ${path.resolve(registryPath)}`);

  const registryRecords = await loadRegistry(registryPath);
  console.log(`> Loaded ${registryRecords.length} registry records with verified emails.`);

  console.log('> Fetching businesses from Lead Mine database...');
  const businesses = await db.business.findMany({
    select: {
      id: true,
      businessName: true,
      editableData: {
        select: {
          id: true,
          primaryEmail: true,
          alternateEmail: true,
          tags: true,
        },
      },
    },
  });

  const byName = new Map<string, BusinessRecord[]>();
  for (const biz of businesses) {
    if (!biz.businessName) continue;
    const key = normalizeKey(biz.businessName);
    if (!key) continue;
    const list = byName.get(key);
    if (list) {
      list.push(biz);
    } else {
      byName.set(key, [biz]);
    }
  }

  let matched = 0;
  let updated = 0;
  let created = 0;
  const skipped: RegistryRecord[] = [];
  const duplicates: Array<{ registry: RegistryRecord; matches: BusinessRecord[] }> = [];

  for (const record of registryRecords) {
    const key = normalizeKey(record.name);
    if (!key) continue;
    const matches = byName.get(key);
    if (!matches || matches.length === 0) {
      skipped.push(record);
      continue;
    }
    if (matches.length > 1) {
      duplicates.push({ registry: record, matches });
      continue;
    }

    matched += 1;
    const biz = matches[0];
    const email = record.email.trim();
    const existing = biz.editableData;

    if (!email) continue;

    if (!existing) {
      await db.editableBusinessData.create({
        data: {
          businessId: biz.id,
          primaryEmail: email,
          tags: ['verified-license-email'],
        },
      });
      created += 1;
      continue;
    }

    const currentPrimary = existing.primaryEmail?.trim() || null;
    const currentAlternate = existing.alternateEmail?.trim() || null;
    const lowerPrimary = currentPrimary?.toLowerCase() || null;
    const lowerAlternate = currentAlternate?.toLowerCase() || null;
    const lowerEmail = email.toLowerCase();
    const currentTags = Array.isArray(existing.tags) ? existing.tags : [];

    const updateData: Prisma.EditableBusinessDataUpdateInput = {};
    let needsUpdate = false;

    if (lowerPrimary !== lowerEmail) {
      updateData.primaryEmail = email;
      needsUpdate = true;

      if (currentPrimary) {
        const shouldStoreOldPrimary =
          !currentAlternate || lowerAlternate === lowerEmail || lowerAlternate === lowerPrimary;
        if (shouldStoreOldPrimary) {
          updateData.alternateEmail = currentPrimary;
        }
      }
    }

    // Ensure tag is present
    if (!currentTags.includes('verified-license-email')) {
      updateData.tags = { set: [...new Set([...currentTags, 'verified-license-email'])] };
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.editableBusinessData.update({
        where: { id: existing.id },
        data: updateData,
      });
      updated += 1;
    }
  }

  console.log(`> Matched records: ${matched}`);
  console.log(`> Created editable entries: ${created}`);
  console.log(`> Updated existing entries: ${updated}`);

  if (duplicates.length) {
    console.warn(`> ${duplicates.length} registry rows matched multiple businesses. Review required:`);
    for (const dup of duplicates.slice(0, 10)) {
      console.warn(`  - ${dup.registry.name} (${dup.registry.email}) -> ${dup.matches.map((m) => m.businessName).join(', ')}`);
    }
  }

  if (skipped.length) {
    console.warn(`> ${skipped.length} registry rows had no matching business in Lead Mine.`);
  }

  await db.$disconnect();
}

main()
  .then(() => {
    console.log('> Registry email sync completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Registry email sync failed:', error);
    db.$disconnect()
      .catch(() => undefined)
      .finally(() => process.exit(1));
  });
