-- Delete any test responses from the intake_responses table
DELETE FROM intake_responses
WHERE response_value LIKE 'Test response%';

-- Verify the deletion
SELECT * FROM intake_responses; 