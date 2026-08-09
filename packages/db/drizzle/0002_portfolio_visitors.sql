CREATE TABLE "portfolio_visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visit_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "portfolio_visitors_visitor_id_unique" UNIQUE("visitor_id")
);
