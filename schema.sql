-- AkashChat Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  tier_id UUID REFERENCES user_tiers(id) DEFAULT NULL, -- Will be set to 'free' tier after tiers are created
  selected_model VARCHAR(100),
  temperature NUMERIC(3,2),
  top_p NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_selected_chat_id UUID,
  last_selected_chat_updated_at TIMESTAMP WITH TIME ZONE,
  system_prompt_encrypted TEXT,
  system_prompt_iv TEXT,
  system_prompt_tag TEXT,
  
  -- Constraints
  UNIQUE(user_id),
  CHECK (temperature >= 0 AND temperature <= 2),
  CHECK (top_p >= 0 AND top_p <= 1)
);

-- Folders table for chat organization
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name_encrypted TEXT,
  name_iv TEXT,
  name_tag TEXT
);

-- Chat sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  model_id VARCHAR(100) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  parent_chat_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  branched_at_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  system_prompt_encrypted TEXT,
  system_prompt_iv TEXT,
  system_prompt_tag TEXT,
  name_encrypted TEXT,
  name_iv TEXT,
  name_tag TEXT
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  position INTEGER NOT NULL, -- Order within the chat
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_encrypted TEXT NOT NULL, -- Encrypted message content
  content_iv TEXT NOT NULL, -- Initialization vector
  content_tag TEXT NOT NULL, -- Authentication tag
  
  -- Constraints
  UNIQUE(chat_session_id, position)
);

-- Saved prompts table
CREATE TABLE saved_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name_encrypted TEXT NOT NULL,
  name_iv TEXT NOT NULL,
  name_tag TEXT NOT NULL,
  content_encrypted TEXT NOT NULL,
  content_iv TEXT NOT NULL,
  content_tag TEXT NOT NULL,
  
  -- Constraints
  UNIQUE(user_id, name_encrypted)
);

-- User tiers table for subscription management
CREATE TABLE user_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE, -- 'free', 'pro', 'enterprise'
  display_name VARCHAR(100) NOT NULL, -- 'Free Plan', 'Pro Plan', 'Enterprise Plan'
  token_limit INTEGER NOT NULL, -- effective token limit after multipliers
  rate_limit_window_ms INTEGER NOT NULL DEFAULT 14400000, -- 4 hours in milliseconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Models table for dynamic model management
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id VARCHAR(100) NOT NULL UNIQUE, -- 'DeepSeek-V3.1'
  api_id VARCHAR(100), -- 'deepseek-ai/DeepSeek-V3.1' for API mapping
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Access Control
  tier_requirement VARCHAR(50) NOT NULL DEFAULT 'permissionless', -- minimum tier needed
  available BOOLEAN DEFAULT true,
  
  -- HIDDEN Backend Cost Control (not exposed to users)
  token_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00, -- 1.0x, 2.0x, 3.0x
  
  -- Model Properties
  temperature NUMERIC(3,2) DEFAULT 0.7,
  top_p NUMERIC(3,2) DEFAULT 0.95,
  token_limit INTEGER DEFAULT 4096,
  owned_by VARCHAR(100),
  parameters VARCHAR(50), -- '7B', '13B', '70B'
  architecture VARCHAR(100), -- 'Transformer', 'MoE'
  hf_repo VARCHAR(255), -- Hugging Face repository
  
  -- UI/Marketing Content
  about_content TEXT,
  info_content TEXT,
  thumbnail_id VARCHAR(50),
  deploy_url TEXT,
  display_order INTEGER DEFAULT 0,
  
  -- API Availability and Categorization
  category VARCHAR(100), -- 'reasoning', 'general', 'coding', etc.
  is_api_available BOOLEAN, -- null = unknown, true/false = explicit
  is_chat_available BOOLEAN, -- null = unknown, true/false = explicit
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (token_multiplier > 0),
  CHECK (temperature >= 0 AND temperature <= 2),
  CHECK (top_p >= 0 AND top_p <= 1),
  CHECK (tier_requirement IN ('permissionless', 'extended', 'pro'))
);

-- User API keys table for LiteLLM integration
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  litellm_api_key_encrypted_b64 TEXT NOT NULL,
  litellm_api_key_iv_b64 TEXT NOT NULL,
  litellm_api_key_tag_b64 TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(10,6) DEFAULT 0.00,
  
  -- Constraints
  UNIQUE(user_id)
);

-- Create Performance Indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_tier_id ON user_preferences(tier_id);
CREATE INDEX idx_user_tiers_name ON user_tiers(name);
CREATE INDEX idx_models_tier_requirement ON models(tier_requirement, available);
CREATE INDEX idx_models_available ON models(available) WHERE available = true;
CREATE INDEX idx_models_display_order ON models(display_order, tier_requirement);
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id, created_at DESC);
CREATE INDEX idx_chat_sessions_folder_id ON chat_sessions(folder_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(chat_session_id, position);
CREATE INDEX idx_saved_prompts_user_id ON saved_prompts(user_id);
CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_is_active ON user_api_keys(is_active) WHERE (is_active = true);
CREATE INDEX idx_user_api_keys_last_used ON user_api_keys(last_used_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;
-- Models table is read-only for users, admin-only writes
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (users can only access their own data)
-- Note: These policies assume you have Auth0 integration set up with custom JWT claims

-- User Preferences Policy
CREATE POLICY "Users can manage their own preferences" ON user_preferences
  FOR ALL USING (auth.uid()::text = user_id);

-- Folders Policy
CREATE POLICY "Users can manage their own folders" ON folders
  FOR ALL USING (auth.uid()::text = user_id);

-- Chat Sessions Policy
CREATE POLICY "Users can manage their own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid()::text = user_id);

-- Chat Messages Policy
CREATE POLICY "Users can manage their own chat messages" ON chat_messages
  FOR ALL USING (auth.uid()::text = (SELECT user_id FROM chat_sessions WHERE id = chat_session_id));

-- Saved Prompts Policy
CREATE POLICY "Users can manage their own saved prompts" ON saved_prompts
  FOR ALL USING (auth.uid()::text = user_id);

-- User Tiers Policy (read-only for users, admin can manage)
CREATE POLICY "Users can read all user tiers" ON user_tiers
  FOR SELECT USING (true);

-- Models Policy (read-only for users, admin can manage)  
CREATE POLICY "Users can read available models" ON models
  FOR SELECT USING (available = true);

-- API Keys Policy
CREATE POLICY "Users can manage their own API keys" ON user_api_keys
  FOR ALL USING (auth.uid()::text = user_id);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_prompts_updated_at BEFORE UPDATE ON saved_prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON user_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tiers_updated_at BEFORE UPDATE ON user_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default user tiers
INSERT INTO user_tiers (name, display_name, token_limit, rate_limit_window_ms) VALUES
('permissionless', 'Permissionless', 25000, 14400000),      -- 25K effective tokens, 4 hours
('extended', 'Extended', 100000, 14400000),       -- 100K effective tokens, 4 hours  
('pro', 'Pro', 500000, 14400000); -- 500K effective tokens, 4 hours

-- Set default tier for existing users (permissionless tier)
UPDATE user_preferences SET tier_id = (
  SELECT id FROM user_tiers WHERE name = 'permissionless' LIMIT 1
) WHERE tier_id IS NULL;

