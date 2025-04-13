import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { StyleSheet, View, Alert, ScrollView } from 'react-native'
import { Button, Input } from '@rneui/themed'
import { Session } from '@supabase/supabase-js'
import Avatar from './Avatar'
import Intake from './Intake'
import Chat from './Chat'
import { Question } from '../types/question'

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [address, setAddress] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [showIntake, setShowIntake] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  useEffect(() => {
    if (session) {
      getProfile();
      testSupabaseConnection();
    }
  }, [session]);

  async function getProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      let { data, error, status } = await supabase
        .from('profiles')
        .select(`username, phone_number, address, avatar_url`)
        .eq('id', session?.user.id)
        .single()
      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setUsername(data.username)
        setPhoneNumber(data.phone_number || '')
        setAddress(data.address || '')
        setAvatarUrl(data.avatar_url)
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function testSupabaseConnection() {
    try {
      console.log('Testing Supabase connection...');
      
      // Check if intake_sections table exists
      const { data: sectionCount, error: sectionsError } = await supabase
        .from('intake_sections')
        .select('count', { count: 'exact' });
        
      if (sectionsError) {
        console.error('Error accessing intake_sections table:', sectionsError);
      } else {
        console.log('intake_sections table count:', sectionCount);
      }
      
      // Check if intake_questions table exists
      const { data: questionCount, error: questionsError } = await supabase
        .from('intake_questions')
        .select('count', { count: 'exact' });
        
      if (questionsError) {
        console.error('Error accessing intake_questions table:', questionsError);
      } else {
        console.log('intake_questions table count:', questionCount);
      }
      
      // Check if intake_responses table exists
      const { data: responseCount, error: responsesError } = await supabase
        .from('intake_responses')
        .select('count', { count: 'exact' });
        
      if (responsesError) {
        console.error('Error accessing intake_responses table:', responsesError);
      } else {
        console.log('intake_responses table count:', responseCount);
      }
      
      // Check for answer options
      const { data: optionsCount, error: optionsError } = await supabase
        .from('intake_answer_options')
        .select('count', { count: 'exact' });
      
      if (optionsError) {
        console.error('Error accessing intake_answer_options table:', optionsError);
        // The table might not exist, try creating it
        await createAnswerOptionsTable();
      } else {
        console.log('intake_answer_options table count:', optionsCount);
        // If no options exist, add some
        if (!optionsCount || optionsCount.length === 0 || optionsCount[0].count === 0) {
          await addTestAnswerOptions();
        }
      }
      
    } catch (e) {
      console.error('Error testing Supabase connection:', e);
    }
  }

  async function createAnswerOptionsTable() {
    try {
      console.log('Attempting to create intake_answer_options table...');
      const { error } = await supabase.rpc('execute_sql', {
        sql_string: `
          CREATE TABLE IF NOT EXISTS intake_answer_options (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            question_id UUID REFERENCES intake_questions(id) ON DELETE CASCADE,
            option_text TEXT NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
          );
        `
      });
      
      if (error) {
        console.error('Failed to create table:', error);
      } else {
        console.log('Table created successfully, adding test options...');
        await addTestAnswerOptions();
      }
    } catch (e) {
      console.error('Error creating table:', e);
    }
  }

  async function addTestAnswerOptions() {
    try {
      console.log('Adding test answer options...');
      
      // First get all questions that need options
      const { data: questions, error: questionsError } = await supabase
        .from('intake_questions')
        .select('id, question_text, question_type')
        .in('question_type', ['single_choice', 'multiple_choice']);
      
      if (questionsError || !questions || questions.length === 0) {
        console.error('Error fetching questions or no questions found:', questionsError);
        return;
      }
      
      console.log('Found questions needing options:', questions);
      
      // For each question, add appropriate options
      for (const question of questions) {
        let options = [];
        
        // Add age options for the first question about age
        if (question.question_text.toLowerCase().includes('age')) {
          options = [
            { question_id: question.id, option_text: 'Under 18', order_index: 0 },
            { question_id: question.id, option_text: '18-24', order_index: 1 },
            { question_id: question.id, option_text: '25-34', order_index: 2 },
            { question_id: question.id, option_text: '35-44', order_index: 3 },
            { question_id: question.id, option_text: '45-54', order_index: 4 },
            { question_id: question.id, option_text: '55-64', order_index: 5 },
            { question_id: question.id, option_text: '65+', order_index: 6 }
          ];
        } 
        // Generic options for other questions
        else {
          options = [
            { question_id: question.id, option_text: 'Option 1', order_index: 0 },
            { question_id: question.id, option_text: 'Option 2', order_index: 1 },
            { question_id: question.id, option_text: 'Option 3', order_index: 2 },
            { question_id: question.id, option_text: 'Option 4', order_index: 3 }
          ];
        }
        
        const { error: insertError } = await supabase
          .from('intake_answer_options')
          .upsert(options);
        
        if (insertError) {
          console.error(`Error adding options for question ${question.id}:`, insertError);
        } else {
          console.log(`Added options for question ${question.id}`);
        }
      }
      
    } catch (e) {
      console.error('Error adding test options:', e);
    }
  }

  async function fetchQuestions() {
    try {
      console.log('fetchQuestions function called');
      setLoadingQuestions(true);
      console.log('Calling Supabase to fetch questions');
      
      // First fetch sections with their questions
      let { data: sections, error: sectionsError } = await supabase
        .from('intake_sections')
        .select(`
          id,
          title,
          description,
          order_index,
          intake_questions (
            id,
            question_text,
            question_type,
            is_required,
            order_index
          )
        `)
        .order('order_index', { ascending: true });

      console.log('Supabase response for sections:', { sections, sectionsError });

      // If error or no data, use hardcoded questions as fallback
      if (sectionsError || !sections || sections.length === 0) {
        console.log('Using fallback questions');
        // Use fallback questions
        const fallbackQuestions: Question[] = [
          {
            id: '1',
            question_text: 'Are you experiencing any symptoms?',
            question_type: 'yes_no',
          },
          {
            id: '2',
            question_text: 'What symptoms are you experiencing?',
            question_type: 'multiple_choice',
            options: ['Fever', 'Cough', 'Fatigue', 'Body aches'],
          },
          {
            id: '3',
            question_text: 'How severe are your symptoms?',
            question_type: 'scale',
            min_value: 0,
            max_value: 10,
            step: 1,
          }
        ];
        
        setQuestions(fallbackQuestions);
        setShowIntake(true);
        setLoadingQuestions(false);
        return;
      }
      
      if (sections) {
        console.log('Got sections from Supabase:', sections);
        
        // Flatten the questions from all sections
        const questionsFlat = sections.flatMap(section => 
          section.intake_questions.map(q => ({ ...q, section_title: section.title }))
        );
        console.log('Questions from all sections:', questionsFlat);
        
        // Get all question IDs that need options
        const questionIdsNeedingOptions = questionsFlat
          .filter(q => q.question_type === 'multiple_choice' || q.question_type === 'single_choice')
          .map(q => q.id);
        
        console.log('Question IDs needing options:', questionIdsNeedingOptions);
        
        // Fetch options for all questions that need them
        let optionsMap: Record<string, string[]> = {};
        if (questionIdsNeedingOptions.length > 0) {
          const { data: optionsData, error: optionsError } = await supabase
            .from('intake_answer_options')
            .select('*')
            .in('question_id', questionIdsNeedingOptions)
            .order('order_index', { ascending: true });
            
          console.log('Options response:', { optionsData, optionsError });
          
          if (!optionsError && optionsData) {
            // Group options by question_id
            optionsMap = optionsData.reduce((map, option) => {
              if (!map[option.question_id]) {
                map[option.question_id] = [];
              }
              map[option.question_id].push(option.option_text);
              return map;
            }, {});
          }
        }
        
        console.log('Options map:', optionsMap);
        
        // Fetch existing answers for this user
        const { data: existingResponses, error: responsesError } = await supabase
          .from('intake_responses')
          .select('*')
          .eq('user_id', session.user.id);
          
        console.log('Raw existing responses:', JSON.stringify(existingResponses, null, 2));
        
        // Create a map of question_id to response_value
        let responseMap: Record<string, string> = {};
        if (!responsesError && existingResponses && existingResponses.length > 0) {
          console.log(`Found ${existingResponses.length} existing responses`);
          
          // First, extract all question IDs to verify against the questions we're loading
          const questionIds = questionsFlat.map(q => q.id);
          console.log('Question IDs in current form:', questionIds);
          
          // Show the existing response question IDs
          const responseIds = existingResponses.map(r => r.question_id);
          console.log('Response question IDs in database:', responseIds);
          
          // Count how many match
          const matchingIds = responseIds.filter(id => questionIds.includes(id));
          console.log(`Found ${matchingIds.length} matching question IDs between form and responses`);
          
          existingResponses.forEach(response => {
            console.log(`Processing response for question ID: ${response.question_id}`);
            console.log(`  Response value: ${response.response_value}`);
            
            // Skip any test responses
            if (response.response_value && response.response_value.includes('Test response')) {
              console.log(`  Skipping test response: ${response.response_value}`);
              // Optionally delete the test response
              deleteResponse(response.question_id);
              return;
            }
            
            // Find the corresponding question
            const matchingQuestion = questionsFlat.find(q => q.id === response.question_id);
            if (matchingQuestion) {
              console.log(`  Matched question: ${matchingQuestion.question_text}`);
              responseMap[response.question_id] = response.response_value;
            } else {
              console.log(`  No matching question found for ID: ${response.question_id}`);
            }
          });
        }
        
        console.log('Final response map:', responseMap);
        console.log('Response map keys:', Object.keys(responseMap));
        console.log('Question IDs:', questionsFlat.map(q => q.id));
        
        // Sort questions by order_index
        questionsFlat.sort((a, b) => a.order_index - b.order_index);
        
        // Convert to required Question format
        const parsedQuestions: Question[] = questionsFlat.map(q => {
          console.log(`Creating question object for: ${q.question_text} (ID: ${q.id})`);
          
          let options;
          
          // Use options from the database if available, otherwise use placeholders
          if ((q.question_type === 'multiple_choice' || q.question_type === 'single_choice')) {
            options = optionsMap[q.id] || ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
          }
          
          // Get the existing answer from the response map
          const existingAnswer = responseMap[q.id];
          if (existingAnswer) {
            console.log(`Found existing answer for question ${q.id}: ${existingAnswer}`);
          } else {
            console.log(`No existing answer found for question ${q.id}`);
          }
          
          return {
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type as 'yes_no' | 'multiple_choice' | 'single_choice' | 'scale',
            options: options,
            min_value: q.question_type === 'scale' ? 0 : undefined,
            max_value: q.question_type === 'scale' ? 10 : undefined,
            step: q.question_type === 'scale' ? 1 : undefined,
            is_required: q.is_required,
            existing_answer: existingAnswer
          };
        });

        setQuestions(parsedQuestions);
        setShowIntake(true);
      }
    } catch (error) {
      console.error('Error in fetchQuestions:', error);
      if (error instanceof Error) {
        Alert.alert('Error fetching questions', error.message);
      }
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function updateProfile({
    username,
    phone_number,
    address,
    avatar_url,
  }: {
    username: string
    phone_number: string
    address: string
    avatar_url: string
  }) {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const updates = {
        id: session?.user.id,
        username,
        phone_number,
        address,
        avatar_url,
        updated_at: new Date(),
      }

      let { error } = await supabase.from('profiles').upsert(updates)

      if (error) {
        throw error
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function deleteResponse(questionId: string) {
    try {
      console.log(`Deleting response for question ID: ${questionId}`);
      
      const { error } = await supabase
        .from('intake_responses')
        .delete()
        .eq('user_id', session.user.id)
        .eq('question_id', questionId);
        
      if (error) {
        console.error('Error deleting response:', error);
        Alert.alert('Error', 'Failed to delete response. Please try again.');
        return false;
      }
      
      console.log('Response deleted successfully');
      return true;
    } catch (e) {
      console.error('Error in deleteResponse:', e);
      return false;
    }
  }

  if (showChat) {
    return <Chat onClose={() => setShowChat(false)} />;
  }

  if (showIntake) {
    return <Intake 
      questions={questions} 
      onComplete={async (answers) => {
        try {
          setLoading(true);
          console.log('Intake completed:', answers);
          console.log('Questions being answered:', questions);
          
          // Format answers for database storage
          const formattedAnswers = answers.map((answer, index) => {
            if (!questions[index] || answer === null || answer === undefined) {
              console.log(`Skipping answer for question at index ${index} - null or undefined`);
              return null;
            }
            
            console.log(`Formatting answer for question: ${questions[index].question_text}`);
            return {
              user_id: session.user.id,
              question_id: questions[index].id,
              response_value: typeof answer === 'object' ? JSON.stringify(answer) : String(answer)
            };
          }).filter(answer => answer !== null); // Remove null answers
          
          console.log('Saving answers to database (formatted):', JSON.stringify(formattedAnswers, null, 2));
          
          if (formattedAnswers.length === 0) {
            console.warn('No valid answers to save to database');
            Alert.alert('Warning', 'No answers were recorded. Please try again.');
            setLoading(false);
            return;
          }
          
          // Save to database
          console.log('Calling Supabase to save answers to intake_responses table');
          const { data, error } = await supabase
            .from('intake_responses')
            .upsert(formattedAnswers, { 
              onConflict: 'user_id,question_id',  // This matches the UNIQUE constraint
              ignoreDuplicates: false
            });
            
          if (error) {
            console.error('Error saving answers:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            throw error;
          }
          
          console.log('Successfully saved answers to database:', data);
          // The user has already seen their summary, so we don't need to show an alert
          // Alert.alert('Thank you!', 'Your responses have been recorded.');
        } catch (error) {
          console.error('Error in onComplete:', error);
          if (error instanceof Error) {
            Alert.alert('Error saving answers', error.message);
          }
        } finally {
          setLoading(false);
          setShowIntake(false);
        }
      }} 
    />
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.container}>
        <View>
          <Avatar
            size={200}
            url={avatarUrl}
            onUpload={(url: string) => {
              setAvatarUrl(url)
              updateProfile({ username, phone_number: phoneNumber, address, avatar_url: url })
            }}
          />
        </View>
        <View style={[styles.verticallySpaced, styles.mt20]}>
          <Input label="Email" value={session?.user?.email} disabled />
        </View>
        <View style={styles.verticallySpaced}>
          <Input 
            label="Username" 
            value={username || ''} 
            onChangeText={(text) => setUsername(text)} 
          />
        </View>
        <View style={styles.verticallySpaced}>
          <Input 
            label="Phone Number" 
            value={phoneNumber || ''} 
            onChangeText={(text) => setPhoneNumber(text)}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.verticallySpaced}>
          <Input 
            label="Address" 
            value={address || ''} 
            onChangeText={(text) => setAddress(text)}
            placeholder="Enter your address"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={[styles.verticallySpaced, styles.mt20]}>
          <Button
            title={loading ? 'Loading ...' : 'Update'}
            onPress={() => updateProfile({ username, phone_number: phoneNumber, address, avatar_url: avatarUrl })}
            disabled={loading}
          />
        </View>

        <View style={styles.verticallySpaced}>
          <Button
            title={loadingQuestions ? "Loading..." : "Start Intake"}
            onPress={() => {
              console.log('Start Intake button pressed');
              fetchQuestions();
            }}
            loading={loadingQuestions}
            disabled={loadingQuestions}
            containerStyle={styles.buttonContainer}
          />
        </View>

        <View style={styles.verticallySpaced}>
          <Button
            title="Open Chat"
            onPress={() => setShowChat(true)}
            containerStyle={styles.buttonContainer}
          />
        </View>

        <View style={styles.verticallySpaced}>
          <Button title="Sign Out" onPress={() => supabase.auth.signOut()} />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 1,
  },
  container: {
    padding: 12,
    paddingTop: 40,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
})