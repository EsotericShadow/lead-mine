-- AlterTable
ALTER TABLE "campaign_invites"
  ADD COLUMN "last_email_meta" JSONB,
  ADD COLUMN "last_visit_meta" JSONB,
  ADD COLUMN "last_rsvp_meta" JSONB;
