ALTER TABLE "customers" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "verification_token" varchar(128);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "verification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "verification_token" varchar(128);--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "verification_sent_at" timestamp;