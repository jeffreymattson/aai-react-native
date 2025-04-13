-- Create intake_sections table
CREATE TABLE IF NOT EXISTS intake_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create intake_questions table
CREATE TABLE IF NOT EXISTS intake_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section_id UUID REFERENCES intake_sections(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('yes_no', 'multiple_choice', 'single_choice', 'scale')),
    is_required BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create intake_answer_options table
CREATE TABLE IF NOT EXISTS intake_answer_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID REFERENCES intake_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create intake_responses table
CREATE TABLE IF NOT EXISTS intake_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES intake_questions(id) ON DELETE CASCADE,
    response_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, question_id)
);

-- Insert example data
INSERT INTO intake_sections (title, description, order_index) VALUES
('Personal Information', 'Basic information about yourself', 1),
('Health History', 'Your medical and health background', 2),
('Lifestyle', 'Your daily habits and activities', 3);

-- Insert questions for Personal Information section
INSERT INTO intake_questions (section_id, question_text, question_type, is_required, order_index)
SELECT id, 'What is your age?', 'single_choice', true, 1
FROM intake_sections WHERE title = 'Personal Information';

INSERT INTO intake_answer_options (question_id, option_text, order_index)
SELECT q.id, o.option_text, o.order_index
FROM intake_questions q
CROSS JOIN (
    VALUES 
        ('Under 18', 1),
        ('18-24', 2),
        ('25-34', 3),
        ('35-44', 4),
        ('45-54', 5),
        ('55-64', 6),
        ('65 or older', 7)
) AS o(option_text, order_index)
WHERE q.question_text = 'What is your age?';

-- Insert questions for Health History section
INSERT INTO intake_questions (section_id, question_text, question_type, is_required, order_index)
SELECT id, 'Do you have any chronic conditions?', 'multiple_choice', true, 1
FROM intake_sections WHERE title = 'Health History';

INSERT INTO intake_answer_options (question_id, option_text, order_index)
SELECT q.id, o.option_text, o.order_index
FROM intake_questions q
CROSS JOIN (
    VALUES 
        ('Diabetes', 1),
        ('Hypertension', 2),
        ('Heart Disease', 3),
        ('Asthma', 4),
        ('None of the above', 5)
) AS o(option_text, order_index)
WHERE q.question_text = 'Do you have any chronic conditions?';

-- Insert questions for Lifestyle section
INSERT INTO intake_questions (section_id, question_text, question_type, is_required, order_index)
SELECT id, 'How would you rate your stress level?', 'scale', true, 1
FROM intake_sections WHERE title = 'Lifestyle';

INSERT INTO intake_questions (section_id, question_text, question_type, is_required, order_index)
SELECT id, 'Do you exercise regularly?', 'yes_no', true, 2
FROM intake_sections WHERE title = 'Lifestyle';

-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

-- Add row level security (RLS) policies for chat_history
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own chat history
CREATE POLICY "Users can view own chat history"
    ON chat_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own chat messages
CREATE POLICY "Users can insert own chat messages"
    ON chat_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id); 