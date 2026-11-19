ALTER TABLE "users" ADD COLUMN "wa" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "posters" DROP COLUMN "contact_name";--> statement-breakpoint
ALTER TABLE "posters" DROP COLUMN "contact_wa";--> statement-breakpoint
ALTER TABLE "posters" DROP COLUMN "contact_phone";