-- PostgreSQL schema based on Docs/Database.md

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

-- Phase 14: profile fields (nullable — existing users simply show "Not set"
-- until they fill these in via the new Edit Profile flow)
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS year VARCHAR(50);

-- Gesture login: a user records an ordered sequence of hand gestures
-- (e.g. ["fist", "open_palm", "peace"]) captured via the browser webcam.
-- Stored as a JSON array string. gesture_enabled lets the login page know
-- whether it can offer gesture sign-in for a given email before a sequence
-- has even been typed in (avoids leaking existence of the account though —
-- see auth.routes.ts, the status check always responds the same shape).
ALTER TABLE users ADD COLUMN IF NOT EXISTS gesture_sequence TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gesture_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);


CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);

-- Phase 13: Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, is_read);

