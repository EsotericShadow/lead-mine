import fs from 'fs';
import csv from 'csv-parser';
import { db } from './db';
import { LeadStatus, Priority } from '@prisma/client';

interface CSVRow {
  Business_Name: string;
  Website_Found: string;
  Website_Found_Source: string;
  Description: string;
  Website_About_Copy: string;
  Google_Maps_Search_URL: string;
  Google_Place_URL: string;
  Google_Official_Website: string;
  Google_Rating: string;
  Google_Reviews_Count: string;
  Google_Address: string;
  Google_Phone: string;
  Google_Hours_Summary: string;
  Google_From_Business: string;
  Google_Reviews_JSON: string;
  Total_Phones_Found: string;
  Avg_Confidence: string;
  Scraped_At: string;
  Social_Facebook: string;
  Social_Instagram: string;
  Social_Linkedin: string;
  Social_Twitter: string;
  Social_Youtube: string;
  Social_Tiktok: string;
  Phone_1: string;
  Phone_1_Confidence: string;
  Phone_1_Source: string;
  Phone_1_Final_Assignment: string;
  Phone_1_Conflicts: string;
  Phone_2: string;
  Phone_2_Confidence: string;
  Phone_2_Source: string;
  Phone_2_Final_Assignment: string;
  Phone_2_Conflicts: string;
  Phone_3: string;
  Phone_3_Confidence: string;
  Phone_3_Source: string;
  Phone_3_Final_Assignment: string;
  Phone_3_Conflicts: string;
  Phone_4: string;
  Phone_4_Confidence: string;
  Phone_4_Source: string;
  Phone_4_Final_Assignment: string;
  Phone_4_Conflicts: string;
  Phone_5: string;
  Phone_5_Confidence: string;
  Phone_5_Source: string;
  Phone_5_Final_Assignment: string;
  Phone_5_Conflicts: string;
}

function parseFloatSafe(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function parseIntSafe(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function cleanString(value: string): string | null {
  if (!value || value.trim() === '' || value.toLowerCase() === 'null') {
    return null;
  }
  return value.trim();
}

export async function importBusinessDataFromCSV(filePath: string): Promise<void> {
  console.log('Starting CSV import from:', filePath);
  
  const results: CSVRow[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: CSVRow) => results.push(data))
      .on('end', async () => {
        try {
          console.log(`Processing ${results.length} business records...`);
          
          let imported = 0;
          let skipped = 0;

          for (const row of results) {
            try {
              // Check if business already exists
              const existingBusiness = await db.business.findFirst({
                where: {
                  businessName: row.Business_Name
                }
              });

              if (existingBusiness) {
                console.log(`Skipping existing business: ${row.Business_Name}`);
                skipped++;
                continue;
              }

              // Extract primary phone (use best confidence phone)
              const phones = [
                { phone: row.Phone_1, confidence: parseFloatSafe(row.Phone_1_Confidence) },
                { phone: row.Phone_2, confidence: parseFloatSafe(row.Phone_2_Confidence) },
                { phone: row.Phone_3, confidence: parseFloatSafe(row.Phone_3_Confidence) },
                { phone: row.Phone_4, confidence: parseFloatSafe(row.Phone_4_Confidence) },
                { phone: row.Phone_5, confidence: parseFloatSafe(row.Phone_5_Confidence) }
              ].filter(p => p.phone && p.phone.trim() !== '');

              const primaryPhone = phones.length > 0 
                ? phones.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0].phone
                : row.Google_Phone || null;

              // Create the business record
              const business = await db.business.create({
                data: {
                  businessName: row.Business_Name,
                  websiteFound: cleanString(row.Website_Found),
                  websiteFoundSource: cleanString(row.Website_Found_Source),
                  description: cleanString(row.Description),
                  websiteAboutCopy: cleanString(row.Website_About_Copy),
                  googleMapsSearchUrl: cleanString(row.Google_Maps_Search_URL),
                  googlePlaceUrl: cleanString(row.Google_Place_URL),
                  googleOfficialWebsite: cleanString(row.Google_Official_Website),
                  googleRating: parseFloatSafe(row.Google_Rating),
                  googleReviewsCount: parseFloatSafe(row.Google_Reviews_Count),
                  googleAddress: cleanString(row.Google_Address),
                  googlePhone: cleanString(row.Google_Phone),
                  googleHoursSummary: cleanString(row.Google_Hours_Summary),
                  googleFromBusiness: cleanString(row.Google_From_Business),
                  googleReviewsJson: cleanString(row.Google_Reviews_JSON),
                  totalPhonesFound: parseIntSafe(row.Total_Phones_Found),
                  avgConfidence: parseFloatSafe(row.Avg_Confidence),
                  scrapedAt: cleanString(row.Scraped_At),
                  socialFacebook: cleanString(row.Social_Facebook),
                  socialInstagram: cleanString(row.Social_Instagram),
                  socialLinkedin: cleanString(row.Social_Linkedin),
                  socialTwitter: cleanString(row.Social_Twitter),
                  socialYoutube: cleanString(row.Social_Youtube),
                  socialTiktok: cleanString(row.Social_Tiktok),
                  phone1: cleanString(row.Phone_1),
                  phone1Confidence: parseFloatSafe(row.Phone_1_Confidence),
                  phone1Source: cleanString(row.Phone_1_Source),
                  phone1FinalAssignment: cleanString(row.Phone_1_Final_Assignment),
                  phone1Conflicts: cleanString(row.Phone_1_Conflicts),
                  phone2: cleanString(row.Phone_2),
                  phone2Confidence: parseFloatSafe(row.Phone_2_Confidence),
                  phone2Source: cleanString(row.Phone_2_Source),
                  phone2FinalAssignment: cleanString(row.Phone_2_Final_Assignment),
                  phone2Conflicts: cleanString(row.Phone_2_Conflicts),
                  phone3: cleanString(row.Phone_3),
                  phone3Confidence: parseFloatSafe(row.Phone_3_Confidence),
                  phone3Source: cleanString(row.Phone_3_Source),
                  phone3FinalAssignment: cleanString(row.Phone_3_Final_Assignment),
                  phone3Conflicts: cleanString(row.Phone_3_Conflicts),
                  phone4: cleanString(row.Phone_4),
                  phone4Confidence: parseFloatSafe(row.Phone_4_Confidence),
                  phone4Source: cleanString(row.Phone_4_Source),
                  phone4FinalAssignment: cleanString(row.Phone_4_Final_Assignment),
                  phone4Conflicts: cleanString(row.Phone_4_Conflicts),
                  phone5: cleanString(row.Phone_5),
                  phone5Confidence: parseFloatSafe(row.Phone_5_Confidence),
                  phone5Source: cleanString(row.Phone_5_Source),
                  phone5FinalAssignment: cleanString(row.Phone_5_Final_Assignment),
                  phone5Conflicts: cleanString(row.Phone_5_Conflicts),
                }
              });

              // Create default lead info
              await db.leadInfo.create({
                data: {
                  businessId: business.id,
                  status: LeadStatus.NEW,
                  priority: Priority.MEDIUM,
                  assignedTo: 'system', // Default assignment
                  estimatedValue: 0,
                  source: 'CSV Import'
                }
              });

              // Create editable business data with primary phone
              await db.editableBusinessData.create({
                data: {
                  businessId: business.id,
                  primaryPhone: primaryPhone,
                  primaryEmail: '', // Will be filled in later
                  contactPerson: '',
                  notes: '',
                  tags: [],
                  customFields: {}
                }
              });

              imported++;
              
              if (imported % 10 === 0) {
                console.log(`Imported ${imported} businesses...`);
              }

            } catch (error) {
              console.error(`Error importing business ${row.Business_Name}:`, error);
              skipped++;
            }
          }

          console.log(`Import complete! Imported: ${imported}, Skipped: ${skipped}`);
          resolve();
        } catch (error) {
          console.error('Error during import:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('CSV reading error:', error);
        reject(error);
      });
  });
}

// Function to run import (can be called from API or script)
export async function runImport() {
  const csvPath = '/Users/main/Desktop/lead-mine/archive/2025-09-08/robust_business_data_20250908_124227.csv';
  
  try {
    await importBusinessDataFromCSV(csvPath);
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
}
