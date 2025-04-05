CREATE TABLE "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"message" text NOT NULL,
	"reply" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"userId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
