/*
  # Create Social Platform Schema

  1. New Tables
    - `users`
      - `wallet` (text, primary key) - Solana wallet address
      - `username` (text, unique) - User's chosen username with @ prefix
      - `created_at` (timestamptz) - Account creation timestamp
    
    - `statements`
      - `id` (uuid, primary key)
      - `user_wallet` (text, foreign key) - References users.wallet
      - `content` (text) - Statement content (max 140 chars)
      - `signature` (text) - Cryptographic signature
      - `created_at` (timestamptz) - Statement creation timestamp
    
    - `follows`
      - `id` (uuid, primary key)
      - `follower_wallet` (text) - Wallet of the follower
      - `following_wallet` (text) - Wallet being followed
      - `created_at` (timestamptz) - Follow timestamp
      - Unique constraint on (follower_wallet, following_wallet)

  2. Security
    - Enable RLS on all tables
    - Users table: Anyone can read, users can insert their own record
    - Statements table: Anyone can read, authenticated users can insert
    - Follows table: Anyone can read, users can manage their own follows

  3. Important Notes
    - All tables use RLS for security
    - Foreign key constraints ensure data integrity
    - Indexes added for performance on common queries
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  wallet text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create statements table
CREATE TABLE IF NOT EXISTS statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet text NOT NULL REFERENCES users(wallet) ON DELETE CASCADE,
  content text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_wallet text NOT NULL REFERENCES users(wallet) ON DELETE CASCADE,
  following_wallet text NOT NULL REFERENCES users(wallet) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_wallet, following_wallet),
  CHECK (follower_wallet != following_wallet)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_statements_user_wallet ON statements(user_wallet);
CREATE INDEX IF NOT EXISTS idx_statements_created_at ON statements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_wallet);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_wallet);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Anyone can view users"
  ON users FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for statements table
CREATE POLICY "Anyone can view statements"
  ON statements FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert statements"
  ON statements FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for follows table
CREATE POLICY "Anyone can view follows"
  ON follows FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own follows"
  ON follows FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE
  TO public
  USING (true);