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
} from 'react-native';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SurveyQuestion {
  category?: string;
  priority?: number;
  question: string;
  followUp?: string;
}

interface ChatProps {
  onClose: () => void;
}

export default function Chat({ onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [usedQuestions, setUsedQuestions] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);

  // Load survey questions from Excel
  useEffect(() => {
    const loadSurveyData = async () => {
      try {
        // Use the document directory path
        const fileUri = `${FileSystem.documentDirectory}survey.xlsx`;
        console.log('Attempting to load survey from:', fileUri);

        // First, copy the file from assets to document directory if it doesn't exist
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists) {
          console.log('Survey file not found in document directory, copying from assets...');
          
          // Try to load the asset directly
          const asset = Asset.fromModule(require('../assets/survey.xlsx'));
          await asset.downloadAsync();
          
          if (!asset.localUri) {
            console.error('Failed to load survey file from assets');
            return;
          }
          
          console.log('Found survey file at:', asset.localUri);
          
          // Copy the file from the asset to the document directory
          await FileSystem.copyAsync({
            from: asset.localUri,
            to: fileUri
          });
          
          console.log('Successfully copied survey file to:', fileUri);
        }

        // Read the file content
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const workbook = XLSX.read(fileContent, { type: 'base64' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet) as SurveyQuestion[];
        setSurveyQuestions(data);
        console.log('Successfully loaded survey data:', data.length, 'questions');
      } catch (error) {
        console.error('Error loading survey data:', error);
      }
    };

    loadSurveyData();
  }, []);

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
        const history = data.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
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
        if (!q || !q.question) return false;
        
        const responseLower = (userResponse || '').toLowerCase();
        const questionLower = q.question.toLowerCase();
        
        // Check if the question's category or content relates to the user's response
        if (q.category && responseLower.includes(q.category.toLowerCase())) return true;
        if (questionLower.includes('alcohol') && responseLower.includes('drink')) return true;
        if (questionLower.includes('family') && (responseLower.includes('family') || responseLower.includes('wife') || responseLower.includes('husband'))) return true;
        // Add more relevance checks as needed
        
        return false;
      });

    // If we found relevant questions, use one of them
    if (relevantQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * relevantQuestions.length);
      const questionIndex = surveyQuestions.indexOf(relevantQuestions[randomIndex]);
      usedQuestions.add(questionIndex);
      return relevantQuestions[randomIndex].question;
    }

    // If no relevant questions found, use a random unused question
    const unusedQuestions = surveyQuestions
      .filter((_, index) => !usedQuestions.has(index))
      .filter(q => q && q.question); // Filter out any undefined or null questions
    
    if (unusedQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * unusedQuestions.length);
      const questionIndex = surveyQuestions.indexOf(unusedQuestions[randomIndex]);
      usedQuestions.add(questionIndex);
      return unusedQuestions[randomIndex].question;
    }

    console.log('No more unused questions available');
    return '';
  };

  const handleSend = async () => {
    if (inputText.trim() === '' || !userId) return;

    const userMessage: Message = {
      role: 'user',
      content: inputText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);
    setInputText('');
    setIsLoading(true);

    try {
      // Get next question based on user's response
      const nextQuestion = getNextQuestion(userMessage.content);

      if (nextQuestion) {
        // Ask the next survey question
        const assistantMessage: Message = {
          role: 'assistant',
          content: nextQuestion,
        };
        setMessages(prev => [...prev, assistantMessage]);
        await saveMessage(assistantMessage);
      } else {
        // Switch to normal chat mode with context from survey
        const chat = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: `You are an Alcoholics Anonymous (AA) counselor. Your role is to provide support, guidance, and encouragement to individuals struggling with alcohol addiction.
You should respond with empathy, understanding, and non-judgmental advice. Your goal is to help the user reflect on their situation, consider the 12-step program,
and provide resources or coping strategies when appropriate. Always maintain a supportive and compassionate tone.

Keep responses to 100 words or less.` }]
            },
            {
              role: 'model',
              parts: [{ text: 'I understand. I will provide supportive, empathetic guidance as an AA counselor, keeping responses concise and focused on the 12-step program.' }]
            },
            ...messages.map(msg => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            })),
          ],
        });

        const result = await chat.sendMessage(inputText.trim());
        const response = await result.response;
        const text = response.text();
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: text,
        };

        setMessages(prev => [...prev, assistantMessage]);
        await saveMessage(assistantMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message.',
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

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
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={[
              styles.messageText,
              message.role === 'user' ? styles.userText : styles.assistantText,
            ]}>
              {message.content}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={[styles.messageText, { marginLeft: 8 }]}>Thinking...</Text>
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
        />
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
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9E9EB',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#000',
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
}); 