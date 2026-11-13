CREATE TYPE "public"."announcement_level" AS ENUM('info', 'penting', 'darurat');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('aktif', 'nonaktif');--> statement-breakpoint
CREATE TYPE "public"."poster_category" AS ENUM('paket', 'promo', 'acara', 'info');--> statement-breakpoint
CREATE TYPE "public"."poster_kind" AS ENUM('gambar', 'pengumuman');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super', 'staff');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('ungu', 'merah', 'hijau');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'locked', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."write_status" AS ENUM('belum', 'sudah', 'gagal');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"target" text NOT NULL,
	"before" text DEFAULT '' NOT NULL,
	"after" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"group_name" text NOT NULL,
	"page_id" text,
	"status" "card_status" DEFAULT 'aktif' NOT NULL,
	"write_status" "write_status" DEFAULT 'belum' NOT NULL,
	"written_at" timestamp with time zone,
	"written_by" text,
	"locked" boolean DEFAULT false NOT NULL,
	"last_tap" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_code_format" CHECK ("cards"."code" ~ '^[A-Z0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"salt" text NOT NULL,
	"hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"date" date NOT NULL,
	"card_code" text NOT NULL,
	"page_id" text,
	"taps" integer DEFAULT 0 NOT NULL,
	"bots" integer DEFAULT 0 NOT NULL,
	"clicks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "daily_stats_date_card_code_pk" PRIMARY KEY("date","card_code")
);
--> statement-breakpoint
CREATE TABLE "page_posters" (
	"page_id" text NOT NULL,
	"poster_id" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "page_posters_page_id_poster_id_pk" PRIMARY KEY("page_id","poster_id")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"theme" "theme" DEFAULT 'ungu' NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posters" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "poster_kind" NOT NULL,
	"name" text NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"image_url" text,
	"image_file" text,
	"image_size" integer,
	"description" text,
	"buttons" text[],
	"title" text,
	"category" "poster_category",
	"price" text,
	"price_unit" text,
	"list_title" text,
	"points" text[],
	"terms" text,
	"brochure_url" text,
	"brochure_file" text,
	"design" jsonb,
	"text" text,
	"level" "announcement_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posters_dates" CHECK ("posters"."end_date" >= "posters"."start_date")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_lower" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_written_by_users_id_fk" FOREIGN KEY ("written_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_card_code_cards_code_fk" FOREIGN KEY ("card_code") REFERENCES "public"."cards"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_posters" ADD CONSTRAINT "page_posters_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_posters" ADD CONSTRAINT "page_posters_poster_id_posters_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."posters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posters" ADD CONSTRAINT "posters_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "cards_page_idx" ON "cards" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "daily_stats_date_idx" ON "daily_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "page_posters_poster_idx" ON "page_posters" USING btree ("poster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_name_key" ON "pages" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "pages_one_default" ON "pages" USING btree ("is_default") WHERE "pages"."is_default";--> statement-breakpoint
CREATE INDEX "posters_live_idx" ON "posters" USING btree ("status","archived","start_date","end_date");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");