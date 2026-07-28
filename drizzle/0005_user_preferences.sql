CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locale" text,
	"time_zone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
