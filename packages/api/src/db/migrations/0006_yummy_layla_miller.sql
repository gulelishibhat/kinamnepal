ALTER TABLE "products" ADD COLUMN "mrp" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_percent" integer DEFAULT 0 NOT NULL;