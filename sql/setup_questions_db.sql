-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options JSONB,
  min_value INTEGER,
  max_value INTEGER,
  step INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create answers table
CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id),
  user_id UUID REFERENCES auth.users(id),
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some sample questions
INSERT INTO questions (question_text, question_type, options, min_value, max_value, step)
VALUES 
('Are you experiencing any symptoms?', 'yes_no', NULL, NULL, NULL, NULL),
('What symptoms are you experiencing?', 'multiple_choice', '["Fever", "Cough", "Fatigue", "Body aches", "Sore throat", "Headache"]', NULL, NULL, NULL),
('How severe are your symptoms?', 'scale', NULL, 0, 10, 1),
('When did your symptoms start?', 'single_choice', '["Today", "Yesterday", "2-3 days ago", "4-7 days ago", "More than a week ago"]', NULL, NULL, NULL); 