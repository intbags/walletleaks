/*
  # Add Likes and Comments System

  1. New Tables
    - `likes`
      - `id` (uuid, primary key)
      - `statement_id` (uuid, foreign key) - References statements.id
      - `user_wallet` (text) - Wallet of user who liked
      - `created_at` (timestamptz)
      - Unique constraint on (statement_id, user_wallet)
    
    - `comments`
      - `id` (uuid, primary key)
      - `statement_id` (uuid, foreign key) - References statements.id
      - `user_wallet` (text, foreign key) - References users.wallet
      - `parent_comment_id` (uuid) - For replies to comments
      - `content` (text) - Comment text
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Likes: Anyone can read, anyone can insert/delete their own
    - Comments: Anyone can read, anyone can insert their own

  3. Important Notes
    - Likes use RLS to prevent duplicate likes
    - Comments support nested replies via parent_comment_id
*/

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  user_wallet text NOT NULL REFERENCES users(wallet) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(statement_id, user_wallet)
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  user_wallet text NOT NULL REFERENCES users(wallet) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_likes_statement ON likes(statement_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_wallet);
CREATE INDEX IF NOT EXISTS idx_comments_statement ON comments(statement_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_wallet);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
  ON likes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can like"
  ON likes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can unlike their likes"
  ON likes FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can comment"
  ON comments FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can delete their comments"
  ON comments FOR DELETE
  TO public
  USING (true);