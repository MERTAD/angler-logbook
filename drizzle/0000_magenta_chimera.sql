CREATE TABLE `catch_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`catch_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catch_photos_catch_idx` ON `catch_photos` (`catch_id`);--> statement-breakpoint
CREATE TABLE `catches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`spot_id` text,
	`species` text NOT NULL,
	`caught_at` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`length_cm` real,
	`weight_kg` real,
	`gear` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`conditions` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catches_user_idx` ON `catches` (`user_id`,`caught_at`);--> statement-breakpoint
CREATE TABLE `paths` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`color` text NOT NULL,
	`points` text NOT NULL,
	`length_m` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `paths_user_idx` ON `paths` (`user_id`);--> statement-breakpoint
CREATE TABLE `spots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spots_user_idx` ON `spots` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
