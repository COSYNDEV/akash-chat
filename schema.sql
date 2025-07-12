-- AkashChat Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
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

