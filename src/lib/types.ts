// Business data types from CSV
export interface BusinessData {
  Business_Name: string;
  Website_Found: string;
  Website_Found_Source: string;
  Description: string;
  Website_About_Copy: string;
  Google_Maps_Search_URL: string;
  Google_Place_URL: string;
  Google_Official_Website: string;
  Google_Rating: number;
  Google_Reviews_Count: number;
  Google_Address: string;
  Google_Phone: string;
  Google_Hours_Summary: string;
  Google_From_Business: string;
  Google_Reviews_JSON: string;
  Total_Phones_Found: number;
  Avg_Confidence: number;
  Scraped_At: string;
  Social_Facebook: string;
  Social_Instagram: string;
  Social_Linkedin: string;
  Social_Twitter: string;
  Social_Youtube: string;
  Social_Tiktok: string;
  Phone_1: string;
  Phone_1_Confidence: number;
  Phone_1_Source: string;
  Phone_1_Final_Assignment: string;
  Phone_1_Conflicts: string;
  Phone_2: string;
  Phone_2_Confidence: number;
  Phone_2_Source: string;
  Phone_2_Final_Assignment: string;
  Phone_2_Conflicts: string;
  Phone_3: string;
  Phone_3_Confidence: number;
  Phone_3_Source: string;
  Phone_3_Final_Assignment: string;
  Phone_3_Conflicts: string;
  Phone_4: string;
  Phone_4_Confidence: number;
  Phone_4_Source: string;
  Phone_4_Final_Assignment: string;
  Phone_4_Conflicts: string;
  Phone_5: string;
  Phone_5_Confidence: number;
  Phone_5_Source: string;
  Phone_5_Final_Assignment: string;
  Phone_5_Conflicts: string;
}

// Lead tracking statuses
export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  NEGOTIATING = 'NEGOTIATING',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
  ON_HOLD = 'ON_HOLD'
}

// Lead priority levels
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// Note type for tracking interactions
export interface Note {
  id: string;
  businessId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // user ID
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'GENERAL' | 'FOLLOW_UP';
}

// Lead tracking information
export interface LeadInfo {
  id: string;
  businessId: string;
  status: LeadStatus;
  priority: Priority;
  assignedTo: string; // user ID
  estimatedValue: number;
  expectedCloseDate?: Date;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  source: string; // where the lead came from
  createdAt: Date;
  updatedAt: Date;
  notes: Note[];
}

// Complete business lead with all data
export interface BusinessLead {
  id: string;
  businessData: BusinessData;
  leadInfo: LeadInfo;
  editableData: EditableBusinessData;
}

// Editable business information
export interface EditableBusinessData {
  primaryPhone: string;
  primaryEmail: string;
  contactPerson: string;
  alternatePhone?: string;
  alternateEmail?: string;
  notes: string;
  tags: string[];
  customFields: Record<string, unknown>;
}

// Filter and search options
export interface LeadFilters {
  status?: LeadStatus[];
  priority?: Priority[];
  assignedTo?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  businessType?: string[];
  rating?: {
    min: number;
    max: number;
  };
}

// Dashboard statistics
export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  closedWon: number;
  closedLost: number;
  totalValue: number;
  conversionRate: number;
  avgDealSize: number;
  leadsThisMonth: number;
  revenueThisMonth: number;
}
