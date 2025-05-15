-- Create priority_areas table
CREATE TABLE IF NOT EXISTS priority_areas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  areas JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE priority_areas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own priority areas"
  ON priority_areas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own priority areas"
  ON priority_areas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own priority areas"
  ON priority_areas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS priority_areas_user_id_idx ON priority_areas(user_id);
CREATE INDEX IF NOT EXISTS priority_areas_created_at_idx ON priority_areas(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_priority_areas_updated_at
  BEFORE UPDATE ON priority_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 