CREATE TABLE IF NOT EXISTS "draft_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"eps_url" text,
	"mime_type" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "draft_images" ADD CONSTRAINT "draft_images_draft_id_listing_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."listing_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
