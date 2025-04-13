-- Enable RLS on all intake tables
ALTER TABLE intake_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_answer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_responses ENABLE ROW LEVEL SECURITY;

-- Policies for intake_sections
CREATE POLICY "Anyone can view intake sections"
    ON intake_sections
    FOR SELECT
    USING (true);

-- Policies for intake_questions
CREATE POLICY "Anyone can view intake questions"
    ON intake_questions
    FOR SELECT
    USING (true);

-- Policies for intake_answer_options
CREATE POLICY "Anyone can view answer options"
    ON intake_answer_options
    FOR SELECT
    USING (true);

-- Policies for intake_responses
CREATE POLICY "Users can view their own responses"
    ON intake_responses
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own responses"
    ON intake_responses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
    ON intake_responses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
    ON intake_responses
    FOR DELETE
    USING (auth.uid() = user_id); 