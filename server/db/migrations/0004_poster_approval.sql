ALTER TYPE "public"."role" ADD VALUE 'approver';--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "pending" jsonb;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "pending_by" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "pending_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "reject_note" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "rejected_by" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posters" ADD CONSTRAINT "posters_pending_by_users_id_fk" FOREIGN KEY ("pending_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posters" ADD CONSTRAINT "posters_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posters_pending_idx" ON "posters" USING btree ("pending_at") WHERE "posters"."pending" is not null;