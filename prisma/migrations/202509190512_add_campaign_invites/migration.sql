-- CreateTable
CREATE TABLE "public"."campaign_invites" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "last_email_sent" TIMESTAMP(3),
    "emails_sent" INTEGER NOT NULL DEFAULT 0,
    "visits_count" INTEGER NOT NULL DEFAULT 0,
    "last_visited_at" TIMESTAMP(3),
    "rsvps_count" INTEGER NOT NULL DEFAULT 0,
    "last_rsvp_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_invites_business_id_key" ON "public"."campaign_invites"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_invites_token_key" ON "public"."campaign_invites"("token");

-- AddForeignKey
ALTER TABLE "public"."campaign_invites" ADD CONSTRAINT "campaign_invites_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

