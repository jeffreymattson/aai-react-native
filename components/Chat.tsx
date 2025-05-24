import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SummaryGraph from './SummaryGraph';
import { Audio } from 'expo-av';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-community/voice';

console.log('SummaryGraph imported:', SummaryGraph);

interface Message {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  timestamp: Date;
  type?: 'text' | 'summary';
  priorityAreas?: PriorityArea[];
}

interface SurveyQuestion {
  [key: string]: string | number | boolean | null;
}

interface PriorityArea {
  name: string;
  score: number;
  explanation: string;
}

interface ChatProps {
  onClose: () => void;
}

interface SpeechResult {
  value: string;
  isDone: boolean;
}

interface SpeechError {
  message: string;
}

export default function Chat({ onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: 'Hello! I\'m here to help you with your recovery journey. To better understand your situation, I\'d like to ask you some questions about your experiences with alcohol. Would you be willing to answer a few questions?',
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [usedQuestions, setUsedQuestions] = useState<Set<number>>(new Set());
  const [priorityAreas, setPriorityAreas] = useState<PriorityArea[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isSurveyComplete, setIsSurveyComplete] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recognitionRef = useRef<any>(null);

  // Add logging for initial state
  useEffect(() => {
    console.log('Initial state - showSummary:', showSummary, 'priorityAreas:', priorityAreas, 'isSurveyComplete:', isSurveyComplete);
  }, []);

  // Add logging for state changes
  useEffect(() => {
    console.log('State changed - showSummary:', showSummary, 'priorityAreas:', priorityAreas, 'isSurveyComplete:', isSurveyComplete);
  }, [showSummary, priorityAreas, isSurveyComplete]);

  // Add logging for survey completion
  useEffect(() => {
    console.log('Survey completion check - answeredQuestions:', answeredQuestions.size, 'totalQuestions:', surveyQuestions.length);
  }, [answeredQuestions, surveyQuestions]);

  // Add logging for priority areas changes
  useEffect(() => {
    console.log('Priority areas updated:', priorityAreas);
  }, [priorityAreas]);

  // Add logging for showSummary changes
  useEffect(() => {
    console.log('showSummary changed:', showSummary);
  }, [showSummary]);

  // Load survey questions from Excel
  useEffect(() => {
    console.log('Starting to load survey data...');
    const loadSurveyData = async () => {
      try {
        if (Platform.OS === 'web') {
          // For web, we'll use a direct fetch to get the Excel file
          const response = await fetch('/survey.xlsx');
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          console.log('Workbook sheets:', workbook.SheetNames);

          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          console.log('Worksheet data:', worksheet);

          const data = XLSX.utils.sheet_to_json(worksheet) as SurveyQuestion[];
          console.log('Parsed survey data:', data);

          if (!data || data.length === 0) {
            console.error('No data found in Excel file');
            return;
          }

          setSurveyQuestions(data);
          console.log('Successfully loaded survey data:', data.length, 'questions');
        } else {
          // For native platforms, use the existing file system approach
          const fileUri = `${FileSystem.documentDirectory}survey.xlsx`;
          console.log('Attempting to load survey from:', fileUri);

          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          console.log('File info:', fileInfo);
          
          if (!fileInfo.exists) {
            console.log('Survey file not found in document directory, copying from assets...');
            
            const asset = Asset.fromModule(require('../assets/survey.xlsx'));
            console.log('Asset loaded:', asset);
            await asset.downloadAsync();
            
            if (!asset.localUri) {
              console.error('Failed to load survey file from assets');
              return;
            }
            
            console.log('Found survey file at:', asset.localUri);
            
            await FileSystem.copyAsync({
              from: asset.localUri,
              to: fileUri
            });
            
            console.log('Successfully copied survey file to:', fileUri);
          }

          const fileContent = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('Successfully read file content, length:', fileContent.length);

          const workbook = XLSX.read(fileContent, { type: 'base64' });
          console.log('Workbook sheets:', workbook.SheetNames);

          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          console.log('Worksheet data:', worksheet);

          const data = XLSX.utils.sheet_to_json(worksheet) as SurveyQuestion[];
          console.log('Parsed survey data:', data);

          if (!data || data.length === 0) {
            console.error('No data found in Excel file');
            return;
          }

          setSurveyQuestions(data);
          console.log('Successfully loaded survey data:', data.length, 'questions');
        }
      } catch (error) {
        console.error('Error loading survey data:', error);
      }
    };

    loadSurveyData();
  }, []);

  // Add logging for survey context
  useEffect(() => {
    console.log('Current survey questions:', surveyQuestions);
    if (surveyQuestions.length > 0) {
      const context = surveyQuestions
        .filter(q => q && q.Question)
        .map(q => {
          console.log('Processing question:', q);
          return Object.entries(q)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        })
        .join('\n\n');
      console.log('Generated survey context:', context);
    }
  }, [surveyQuestions]);

  // Initialize the Gemini model
  const genAI = new GoogleGenerativeAI('AIzaSyAd4oo7qJgo2lsr80p6B0zymVNvBuygAT4');
  const model = genAI.getGenerativeModel({ model: 'gemini-exp-1206' });

  // Get current user on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Load chat history for this user
        loadChatHistory(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const loadChatHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        console.log('Loading chat history:', data);
        const history = data.map(msg => {
          console.log('Processing message:', msg);
          // Convert 'assistant' to 'model', but keep 'model' as is
          const role = msg.role === 'assistant' ? 'model' : msg.role;
          console.log('Converted role:', role);
          return {
            role: role as 'user' | 'model',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            type: 'text' as const
          };
        });
        console.log('Converted history:', history);
        setMessages(history);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveMessage = async (message: Message) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          role: message.role,
          content: message.content,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const getNextQuestion = (userResponse: string): string => {
    // If we have no questions, return empty string
    if (!surveyQuestions || surveyQuestions.length === 0) {
      console.log('No survey questions available');
      return '';
    }

    // Find unused questions that might be relevant to the user's response
    const relevantQuestions = surveyQuestions
      .filter((_, index) => !usedQuestions.has(index))
      .filter(q => {
        if (!q || typeof q.Question !== 'string') return false;
        
        const responseLower = (userResponse || '').toLowerCase();
        const questionLower = q.Question.toLowerCase();
        const priorityAreaLower = (typeof q['Priority Area'] === 'string' ? q['Priority Area'] : '').toLowerCase();
        const typeLower = (typeof q.Type === 'string' ? q.Type : '').toLowerCase();
        
        // Check if the question's priority area or type relates to the user's response
        if (priorityAreaLower && responseLower.includes(priorityAreaLower)) return true;
        if (typeLower && responseLower.includes(typeLower)) return true;
        if (questionLower.includes('alcohol') && responseLower.includes('drink')) return true;
        if (questionLower.includes('family') && (responseLower.includes('family') || responseLower.includes('wife') || responseLower.includes('husband'))) return true;
        
        return false;
      });

    // If we found relevant questions, use one of them
    if (relevantQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * relevantQuestions.length);
      const questionIndex = surveyQuestions.indexOf(relevantQuestions[randomIndex]);
      usedQuestions.add(questionIndex);
      return typeof relevantQuestions[randomIndex].Question === 'string' ? relevantQuestions[randomIndex].Question : '';
    }

    // If no relevant questions found, use a random unused question
    const unusedQuestions = surveyQuestions
      .filter((_, index) => !usedQuestions.has(index))
      .filter(q => q && typeof q.Question === 'string');
    
    if (unusedQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * unusedQuestions.length);
      const questionIndex = surveyQuestions.indexOf(unusedQuestions[randomIndex]);
      usedQuestions.add(questionIndex);
      return typeof unusedQuestions[randomIndex].Question === 'string' ? unusedQuestions[randomIndex].Question : '';
    }

    console.log('No more unused questions available');
    return '';
  };

  // Add function to save priority areas
  const savePriorityAreas = async (areas: PriorityArea[]) => {
    if (!userId) {
      console.log('Cannot save priority areas: no userId');
      return;
    }
    
    console.log('Attempting to save priority areas:', JSON.stringify(areas, null, 2));
    try {
      const { data, error } = await supabase
        .from('priority_areas')
        .upsert({
          user_id: userId,
          areas: areas,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Error saving priority areas:', error);
        throw error;
      }
      
      console.log('Successfully saved priority areas:', JSON.stringify(data, null, 2));
      
      // Verify the save by immediately loading
      const { data: verifyData, error: verifyError } = await supabase
        .from('priority_areas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (verifyError) {
        console.error('Error verifying saved priority areas:', verifyError);
      } else {
        console.log('Verified saved priority areas:', JSON.stringify(verifyData, null, 2));
      }
    } catch (error) {
      console.error('Error in savePriorityAreas:', error);
    }
  };

  // Add function to load priority areas
  const loadPriorityAreas = async () => {
    if (!userId) {
      console.log('Cannot load priority areas: no userId');
      return;
    }
    
    console.log('Attempting to load priority areas for user:', userId);
    try {
      const { data, error } = await supabase
        .from('priority_areas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading priority areas:', error);
        throw error;
      }

      console.log('Loaded priority areas data:', JSON.stringify(data, null, 2));
      
      if (data && data.length > 0) {
        console.log('Setting priority areas from database:', JSON.stringify(data[0].areas, null, 2));
        setPriorityAreas(data[0].areas);
        setShowSummary(true);
      } else {
        console.log('No priority areas found in database');
      }
    } catch (error) {
      console.error('Error in loadPriorityAreas:', error);
    }
  };

  // Load priority areas on component mount and when userId changes
  useEffect(() => {
    console.log('Component mounted or userId changed, loading priority areas');
    console.log('Current userId:', userId);
    loadPriorityAreas();
  }, [userId]);

  // Add this function to check if survey is complete
  const checkSurveyCompletion = () => {
    const allQuestionsAnswered = surveyQuestions.length > 0 && answeredQuestions.size === surveyQuestions.length;
    setIsSurveyComplete(allQuestionsAnswered);
    return allQuestionsAnswered;
  };

  const handleSend = async () => {
    if (isLoading || inputText.trim() === '') return;

    const userMessage: Message = {
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    // Update state first
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Then save the message
    await saveMessage(userMessage);

    try {
      // Get next question based on user's response
      const nextQuestion = getNextQuestion(userMessage.content);

      if (nextQuestion) {
        // Ask the next survey question
        const assistantMessage: Message = {
          role: 'model',
          content: nextQuestion,
          timestamp: new Date(),
          type: 'text'
        };
        setMessages(prev => [...prev, assistantMessage]);
        await saveMessage(assistantMessage);
        
        // Mark the question as answered
        const questionIndex = surveyQuestions.findIndex(q => q.Question === nextQuestion);
        if (questionIndex !== -1) {
          setAnsweredQuestions(prev => new Set([...prev, questionIndex]));
        }
        
        // Check if survey is complete
        checkSurveyCompletion();
      } else {
        // Switch to normal chat mode with context from survey
        console.log('Survey Questions:', surveyQuestions);
        
        const surveyContext = surveyQuestions
          .filter(q => q && q.Question)
          .map(q => {
            console.log('Processing question:', q);
            const formattedQuestion = Object.entries(q)
              .filter(([key, value]) => value !== null && value !== undefined && value !== '')
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n');
            console.log('Formatted question:', formattedQuestion);
            return formattedQuestion;
          })
          .join('\n\n');

        console.log('Survey Context being sent to Gemini:', surveyContext);
        console.log('Current messages:', messages);

        // Create a new array with properly typed roles
        const mappedMessages = messages.map(msg => {
          console.log('Mapping message:', msg);
          // Convert 'assistant' role to 'model' for Gemini API
          const role = msg.role === 'assistant' ? 'model' : msg.role;
          console.log('Mapped role:', role);
          return {
            role: role as 'user' | 'model',
            parts: [{ text: msg.content }],
          };
        });

        console.log('Mapped messages:', mappedMessages);

        const chatHistory = [
          {
            role: 'user',
            parts: [{ text: `You are an Alcoholics Anonymous (AA) counselor. Your role is to provide support, guidance, and encouragement to individuals struggling with alcohol addiction.
You should respond with empathy, understanding, and non-judgmental advice. Your goal is to help the user reflect on their situation, consider the 12-step program,
and provide resources or coping strategies when appropriate. Always maintain a supportive and compassionate tone.

IMPORTANT: Start by asking survey questions from the provided list. Only proceed to general counseling after all survey questions have been asked and answered.
If the user agrees to answer questions, begin with the first survey question. If they decline, respond empathetically and offer to help in other ways.

Here are the survey questions you should use:
${surveyContext}

IMPORTANT: For each response, you should:
1. Track the user's answers for each Priority Area
2. Score each Priority Area on a scale from 1-10 based on the severity of the issues discussed
3. Consider multiple factors when scoring:
   - Frequency of alcohol use
   - Impact on relationships
   - Physical health effects
   - Mental health effects
   - Work/social life impact
   - Willingness to change
4. Provide a brief explanation for each score
5. Keep track of the scores for later use in an octopus graph visualization

After analyzing all responses, provide your response in this format:
[Your human-readable response here]

<!--JSON_START-->
{
  "priorityAreas": [
    {
      "name": "Area Name",
      "score": number (1-10),
      "explanation": "Brief explanation of the score"
    }
  ]
}
<!--JSON_END-->

Use this context to inform your responses, but maintain a natural conversation flow. Keep responses to 100 words or less.` }]
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I will start by asking survey questions to better understand the user\'s situation. I will maintain a supportive and empathetic tone throughout the conversation, and only proceed to general counseling after all survey questions have been asked and answered.' }]
          },
          ...mappedMessages,
        ];

        console.log('Final chat history:', chatHistory);

        const chat = model.startChat({
          history: chatHistory,
        });

        const result = await chat.sendMessage(inputText.trim());
        const response = await result.response;
        const text = response.text();
        
        // Try to extract the JSON array from the response
        try {
          const jsonMatch = text.match(/<!--JSON_START-->([\s\S]*?)<!--JSON_END-->/);
          console.log('Found JSON match:', jsonMatch);
          console.log('Survey completion status:', isSurveyComplete);
          if (jsonMatch && isSurveyComplete) {  // Only process JSON if survey is complete
            const jsonStr = jsonMatch[1].trim().replace(/\n\s+/g, ' ');  // Remove extra whitespace and newlines
            console.log('Cleaned JSON string to parse:', jsonStr);
            const jsonData = JSON.parse(jsonStr);
            console.log('Parsed JSON data:', jsonData);
            if (jsonData.priorityAreas && Array.isArray(jsonData.priorityAreas)) {
              console.log('Setting priority areas:', jsonData.priorityAreas);
              setPriorityAreas(jsonData.priorityAreas);
              await savePriorityAreas(jsonData.priorityAreas);
              
              // Add summary message to messages array
              const summaryMessage: Message = {
                role: 'model',
                content: 'Priority Areas Summary',
                timestamp: new Date(),
                type: 'summary',
                priorityAreas: jsonData.priorityAreas
              };
              
              // Extract the human-readable part of the response
              const humanReadableResponse = text.split('<!--JSON_START-->')[0].trim();
              
              const modelResponse: Message = {
                role: 'model',
                content: humanReadableResponse,
                timestamp: new Date(),
                type: 'text'
              };
              
              setMessages(prev => [...prev, modelResponse, summaryMessage]);
              await saveMessage(modelResponse);
              await saveMessage(summaryMessage);
              
              console.log('Setting showSummary to true');
              setShowSummary(true);
            } else {
              console.log('No priority areas found in JSON data or invalid format:', jsonData);
              const modelResponse: Message = {
                role: 'model',
                content: text,
                timestamp: new Date(),
                type: 'text'
              };
              setMessages(prev => [...prev, modelResponse]);
              await saveMessage(modelResponse);
            }
          } else {
            console.log('No JSON match found or survey not complete');
            const modelResponse: Message = {
              role: 'model',
              content: text,
              timestamp: new Date(),
              type: 'text'
            };
            setMessages(prev => [...prev, modelResponse]);
            await saveMessage(modelResponse);
          }
        } catch (e) {
          console.error('Error parsing JSON from response:', e);
          console.error('Response text:', text);
          const errorMessage: Message = {
            role: 'model',
            content: text,
            timestamp: new Date(),
            type: 'text'
          };
          setMessages(prev => [...prev, errorMessage]);
          await saveMessage(errorMessage);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'model',
        content: 'Sorry, there was an error processing your message.',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      // Use requestAnimationFrame to ensure the scroll happens after content is rendered
      requestAnimationFrame(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
      });
    }
  };

  // Add effect to scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollViewRef.current) {
        // Use requestAnimationFrame to ensure the scroll happens after content is rendered
        requestAnimationFrame(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        });
      }
    };

    // Initial scroll
    scrollToBottom();

    // Add a small delay to ensure content is rendered
    const timer = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleKeyPress = (e: any) => {
    if (Platform.OS === 'web') {
      // On web, check if it's Enter without Shift
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  // Add function to get unique priority areas from survey
  const getUniquePriorityAreas = () => {
    if (!surveyQuestions || surveyQuestions.length === 0) {
      console.log('No survey questions available');
      return [];
    }

    // Get unique priority areas from the survey
    const uniqueAreas = new Set<string>();
    surveyQuestions.forEach(q => {
      if (q['Priority Area']) {
        uniqueAreas.add(q['Priority Area'] as string);
      }
    });

    console.log('Unique priority areas from survey:', Array.from(uniqueAreas));
    return Array.from(uniqueAreas);
  };

  const requestPriorityAreas = async () => {
    try {
      console.log('Current priority areas before loading:', priorityAreas);
      
      // First try to load existing priority areas from the database
      await loadPriorityAreas();
      
      console.log('Priority areas after loading:', priorityAreas);
      
      // If we have priority areas, no need to request from Gemini
      if (priorityAreas.length > 0) {
        console.log('Using existing priority areas from database');
        return;
      }

      // Get unique priority areas from survey
      const surveyPriorityAreas = getUniquePriorityAreas();
      if (surveyPriorityAreas.length === 0) {
        console.error('No priority areas found in survey data');
        return;
      }

      // If no existing areas found, request from Gemini with survey context
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: `Based on the following survey responses, please provide scores for each of these priority areas in this exact format, with no additional text or markdown:

Priority Areas to Score:
${surveyPriorityAreas.map(area => `- ${area}`).join('\n')}

Survey Context:
${messages
  .filter(msg => msg.role === 'user')
  .map(msg => msg.content)
  .join('\n')}

Format the response as:
{
  "priorityAreas": [
    {
      "name": "Area Name",
      "score": number (1-10),
      "explanation": "REQUIRED: Provide a detailed explanation (minimum 5-6 sentences) that MUST include:
        1. Direct quotes from the user's responses that specifically relate to this area
        2. Analysis of how these responses indicate the severity of issues
        3. Comparison to other areas in terms of urgency and impact
        4. Specific examples of behaviors or situations mentioned
        5. Patterns or trends observed across multiple responses
        6. Detailed reasoning for the specific numerical score
        7. How this area affects other aspects of the user's life
        8. Potential implications if this area is not addressed
        
        The explanation must be thorough and detailed, with specific references to the user's responses. Each point should be supported by direct quotes or specific examples from the conversation."
    }
  ]
}

Consider the following when scoring:
1. Frequency of alcohol use
2. Impact on relationships
3. Physical health effects
4. Mental health effects
5. Work/social life impact
6. Willingness to change

IMPORTANT: For each priority area, you MUST:
- Write a minimum of 5-6 sentences
- Include direct quotes from the user's responses
- Provide specific examples and details
- Explain the reasoning behind the score
- Compare to other areas
- Analyze patterns and trends
- Discuss implications and impact

The explanation should be comprehensive and detailed, not just a brief sentence. Each point must be supported by specific evidence from the user's responses.` }]
          }
        ],
      });

      const result = await chat.sendMessage('');
      const response = await result.response;
      const text = response.text();
      
      console.log('Raw response:', text);
      
      // Try to extract the JSON array from the response
      try {
        // First try to find JSON between markers
        let jsonMatch = text.match(/<!--JSON_START-->([\s\S]*?)<!--JSON_END-->/);
        
        // If no markers found, try to find JSON directly
        if (!jsonMatch) {
          jsonMatch = text.match(/\{[\s\S]*\}/);
        }
        
        console.log('Found JSON match:', jsonMatch);
        
        if (jsonMatch) {
          let jsonStr = jsonMatch[0];
          
          // Clean up the string
          jsonStr = jsonStr
            .replace(/<!--JSON_START-->/, '')
            .replace(/<!--JSON_END-->/, '')
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          
          console.log('Cleaned JSON string to parse:', jsonStr);
          
          // Try to parse the JSON
          const jsonData = JSON.parse(jsonStr);
          console.log('Parsed JSON data:', jsonData);
          
          if (jsonData.priorityAreas && Array.isArray(jsonData.priorityAreas)) {
            // Verify that all priority areas from survey are included
            const missingAreas = surveyPriorityAreas.filter(
              area => !jsonData.priorityAreas.some((pa: PriorityArea) => pa.name === area)
            );
            
            if (missingAreas.length > 0) {
              console.error('Missing priority areas in response:', missingAreas);
              return;
            }
            
            console.log('Setting priority areas:', jsonData.priorityAreas);
            setPriorityAreas(jsonData.priorityAreas);
            await savePriorityAreas(jsonData.priorityAreas);
            setShowSummary(true);
          } else {
            console.error('Invalid priority areas format:', jsonData);
          }
        } else {
          console.error('No JSON found in response');
          console.error('Full response:', text);
        }
      } catch (e) {
        console.error('Error parsing JSON from response:', e);
        console.error('Response text:', text);
      }
    } catch (error) {
      console.error('Error requesting priority areas:', error);
    }
  };

  useEffect(() => {
    // Initialize Voice
    Voice.onSpeechStart = () => setIsRecording(true);
    Voice.onSpeechEnd = () => setIsRecording(false);
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;

    return () => {
      // Cleanup
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechResults = (e: SpeechResultsEvent) => {
    if (e.value && e.value[0]) {
      setInputText(e.value[0]);
    }
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    console.error('Speech recognition error:', e);
    setIsRecording(false);
    Alert.alert('Error', 'Failed to recognize speech. Please try again.');
  };

  const startRecording = async () => {
    try {
      await Voice.start('en-US');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      Alert.alert('Error', 'Failed to start speech recognition');
    }
  };

  const stopRecording = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      Alert.alert('Error', 'Failed to stop speech recognition');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
        <View style={styles.header}>
        <Text style={styles.headerTitle}>AA Counselor</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
        </View>
        
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageContainer,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            {message.type === 'summary' && message.priorityAreas ? (
              <View style={styles.summaryWrapper}>
                <SummaryGraph priorityAreas={message.priorityAreas} />
              </View>
            ) : (
              <Text style={styles.messageText}>
                {message.content.split('<!--JSON_START-->')[0].trim()}
              </Text>
            )}
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageContainer, styles.assistantMessage]}>
            <Text style={styles.messageText}>Thinking...</Text>
          </View>
        )}
        {showSummary && priorityAreas.length > 0 && (
          <View style={[styles.messageContainer, styles.assistantMessage]}>
            <View style={styles.summaryWrapper}>
              <SummaryGraph priorityAreas={priorityAreas} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#666"
          multiline
          maxLength={500}
          onKeyPress={handleKeyPress}
          onSubmitEditing={Platform.OS !== 'web' ? handleSend : undefined}
        />
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording && styles.micButtonActive
          ]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons 
            name={isRecording ? "mic" : "mic-outline"} 
            size={24} 
            color={isRecording ? "#FF3B30" : "#007AFF"} 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (isLoading || inputText.trim() === '') && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={isLoading || inputText.trim() === ''}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.requestButton}
        onPress={requestPriorityAreas}
      >
        <Text style={styles.requestButtonText}>Show Priority Areas</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    marginLeft: '20%',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    marginRight: '20%',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9E9EB',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  micButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: '#FFE5E5',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryWrapper: {
    width: '100%',
    marginVertical: 16,
  },
  requestButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    margin: 8,
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 