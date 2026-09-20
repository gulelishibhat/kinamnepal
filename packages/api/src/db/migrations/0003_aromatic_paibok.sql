ALTER TABLE "customers" ADD COLUMN "reset_token" varchar(128);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "reset_token_expires" timestamp;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "reset_token" varchar(128);--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "reset_token_expires" timestamp;