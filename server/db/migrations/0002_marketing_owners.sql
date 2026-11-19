ALTER TYPE "public"."role" ADD VALUE 'marketing';--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "contact_wa" text;--> statement-breakpoint
ALTER TABLE "posters" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posters" ADD CONSTRAINT "posters_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_owner_idx" ON "cards" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "posters_owner_idx" ON "posters" USING btree ("owner_id");