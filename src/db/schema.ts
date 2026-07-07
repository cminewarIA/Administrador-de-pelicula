import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Define the 'users' table.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define the 'reports' table with a foreign key to 'users'.
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  reportId: text("report_id").notNull().unique(),
  timestamp: timestamp("timestamp").defaultNow(),
  totalFiles: integer("total_files"),
  organizedCount: integer("organized_count"),
  failures: integer("failures"),
  details: text("details"), // JSON serialized string
});

// Define relationships for the 'users' table.
export const usersRelations = relations(users, ({ many }) => ({
  reports: many(reports),
}));

// Define relationships for the 'reports' table.
export const reportsRelations = relations(reports, ({ one }) => ({
  user: one(users, {
    fields: [reports.userId],
    references: [users.id],
  }),
}));
