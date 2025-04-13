import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native'
import { RadioButton, Checkbox } from 'react-native-paper'
import Slider from '@react-native-community/slider'
import { Question } from '../types/question'
import { supabase } from '../lib/supabase'

interface IntakeProps {
  questions: Question[]
  onComplete: (answers: (string | string[] | number)[]) => void
}

export default function Intake({ questions, onComplete }: IntakeProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<(string | string[] | number)[]>(new Array(questions.length).fill(null))
  const [showSummary, setShowSummary] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [prefilledAnswers, setPrefilledAnswers] = useState<boolean[]>(new Array(questions.length).fill(false))
  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestionIndex]

  // Fetch existing answers on component mount
  useEffect(() => {
    fetchExistingAnswers()
  }, [])

  const fetchExistingAnswers = async () => {
    setIsLoading(true)
    setLoadingError(null)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.error('User not authenticated')
        setLoadingError('You are not authenticated. Please log in again.')
        setIsLoading(false)
        return
      }
      
      // Get all question IDs
      const questionIds = questions.map(q => q.id)
      
      // Fetch existing answers from the database
      const { data, error } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('user_id', user.id)
        .in('question_id', questionIds)
      
      if (error) {
        console.error('Error fetching existing answers:', error)
        setLoadingError('Failed to load your previous answers. Please try again later.')
        setIsLoading(false)
        return
      }
      
      if (data && data.length > 0) {
        console.log('Found existing answers:', data)
        
        // Create a new answers array
        const newAnswers = new Array(questions.length).fill(null)
        const newPrefilledAnswers = new Array(questions.length).fill(false)
        
        // Fill in existing answers
        data.forEach(response => {
          const questionIndex = questions.findIndex(q => q.id === response.question_id)
          if (questionIndex !== -1) {
            let value: string | string[] | number = response.response_value
            
            // Parse response value based on question type
            const questionType = questions[questionIndex].question_type
            
            if (questionType === 'multiple_choice') {
              try {
                // Parse JSON array
                value = JSON.parse(response.response_value) as string[]
              } catch (e) {
                console.error('Error parsing multiple choice value:', e)
                // Use as string if parsing fails
                value = response.response_value
              }
            } else if (questionType === 'scale') {
              // Convert to number
              value = Number(response.response_value)
            }
            
            newAnswers[questionIndex] = value
            newPrefilledAnswers[questionIndex] = true
          }
        })
        
        console.log('Initialized answers from database:', newAnswers)
        setAnswers(newAnswers)
        setPrefilledAnswers(newPrefilledAnswers)
        
        // Find the first unanswered question
        const firstUnansweredIndex = newAnswers.findIndex(answer => answer === null)
        if (firstUnansweredIndex !== -1) {
          console.log('Starting at first unanswered question index:', firstUnansweredIndex)
          setCurrentQuestionIndex(firstUnansweredIndex)
        } else {
          // All questions have answers, but let's start from the beginning to allow re-answering
          console.log('All questions already have answers, starting from the beginning')
          setCurrentQuestionIndex(0)
        }
      } else {
        console.log('No existing answers found, starting from beginning')
      }
    } catch (error) {
      console.error('Error in fetchExistingAnswers:', error)
      setLoadingError('An unexpected error occurred. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = (answer: string | string[] | number) => {
    console.log('Current answers:', answers)
    console.log('Adding answer:', answer)
    console.log('Answer type:', typeof answer, Array.isArray(answer) ? 'array' : 'not array')
    console.log('Current index:', currentQuestionIndex)
    console.log('Current question:', currentQuestion)
    
    // Create a new array with the correct length
    const newAnswers = new Array(questions.length).fill(null)
    const newPrefilledAnswers = [...prefilledAnswers]
    
    // Copy existing answers
    answers.forEach((ans, idx) => {
      newAnswers[idx] = ans
    })
    
    // Add the new answer
    newAnswers[currentQuestionIndex] = answer
    // Mark as not prefilled since user just answered it
    newPrefilledAnswers[currentQuestionIndex] = false
    
    console.log('New answers array:', newAnswers)
    console.log(`Answer at index ${currentQuestionIndex} is now:`, newAnswers[currentQuestionIndex])
    setAnswers(newAnswers)
    setPrefilledAnswers(newPrefilledAnswers)
  }

  const saveCurrentAnswer = async () => {
    setIsSubmitting(true)
    try {
      // Skip if no answer
      if (currentAnswer === null || currentAnswer === undefined) {
        console.log('No answer to save')
        return
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Current user:', user?.id)
      
      if (!user) {
        console.error('User not authenticated')
        setSubmitError('Error: Not authenticated. Please log in again.')
        return
      }
      
      // Format the response value
      let responseValue = currentAnswer
      if (Array.isArray(responseValue)) {
        responseValue = JSON.stringify(responseValue)
      } else {
        responseValue = String(responseValue)
      }
      
      console.log(`Saving individual response for question ${currentQuestion.id}: ${responseValue}`)
      
      // Save to database
      const { error } = await supabase
        .from('intake_responses')
        .upsert({
          user_id: user.id,
          question_id: currentQuestion.id,
          response_value: responseValue
        }, { onConflict: 'user_id,question_id' })
      
      if (error) {
        console.error('Error saving individual response:', error)
        setSubmitError('Failed to save your response. Please try again.')
      } else {
        console.log('Individual response saved successfully')
        setSubmitError(null)
      }
    } catch (error) {
      console.error('Error in saveCurrentAnswer:', error)
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    // First, make sure the current answer is saved
    if (currentAnswer !== null && currentAnswer !== undefined) {
      console.log(`Answer for question ${currentQuestionIndex} confirmed: ${currentAnswer}`)
      
      // Save this answer to the database immediately
      await saveCurrentAnswer()
    } else {
      console.log(`No answer provided for question ${currentQuestionIndex}`)
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      console.log('All questions completed, showing summary')
      console.log('Final answers array:', answers)
      setShowSummary(true)
      // Don't call onComplete here, let the user view the summary first
    }
  }

  const handleRestart = () => {
    setCurrentQuestionIndex(0)
    setAnswers(new Array(questions.length).fill(null))
    setShowSummary(false)
    setSubmitError(null)
  }

  const renderQuestionInput = () => {
    // Check if currentQuestion exists before trying to render it
    if (!currentQuestion) {
      return (
        <View style={styles.testContainer}>
          <Text style={styles.questionText}>Loading question...</Text>
        </View>
      );
    }

    switch (currentQuestion.question_type) {
      case 'yes_no':
        return (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.yesNoButton, { backgroundColor: currentAnswer === 'yes' ? 'green' : 'gray' }]}
              onPress={() => handleAnswer('yes')}
            >
              <Text style={styles.buttonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.yesNoButton, { backgroundColor: currentAnswer === 'no' ? 'red' : 'gray' }]}
              onPress={() => handleAnswer('no')}
            >
              <Text style={styles.buttonText}>No</Text>
            </TouchableOpacity>
          </View>
        )

      case 'single_choice':
        console.log('Rendering single_choice, current answer:', currentAnswer)
        return (
          <View style={styles.optionsContainer}>
            <RadioButton.Group
              onValueChange={value => {
                console.log('Radio button selected:', value)
                handleAnswer(value)
              }}
              value={currentAnswer as string || ''}
            >
              {currentQuestion.options?.map((option, index) => (
                <View key={index} style={styles.radioOptionContainer}>
                  <RadioButton value={option} />
                  <Text style={styles.radioText}>{option}</Text>
                </View>
              ))}
            </RadioButton.Group>
          </View>
        )

      case 'multiple_choice':
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, index) => (
              <View key={index} style={styles.checkboxOptionContainer}>
                <Checkbox
                  status={(currentAnswer as string[] || []).includes(option) ? 'checked' : 'unchecked'}
                  onPress={() => {
                    const currentAnswers = currentAnswer as string[] || []
                    const newAnswers = currentAnswers.includes(option)
                      ? currentAnswers.filter(a => a !== option)
                      : [...currentAnswers, option]
                    handleAnswer(newAnswers)
                  }}
                />
                <Text style={styles.radioText}>{option}</Text>
              </View>
            ))}
          </View>
        )

      case 'scale':
        // Ensure all values are properly converted to strings
        const minValue = currentQuestion.min_value !== undefined ? String(currentQuestion.min_value) : '0';
        const maxValue = currentQuestion.max_value !== undefined ? String(currentQuestion.max_value) : '10';
        const currentValue = typeof currentAnswer === 'number' ? String(currentAnswer) : '0';
        
        return (
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>{minValue}</Text>
              <Text style={styles.sliderValue}>{currentValue}</Text>
              <Text style={styles.sliderLabel}>{maxValue}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={currentQuestion.min_value !== undefined ? currentQuestion.min_value : 0}
              maximumValue={currentQuestion.max_value !== undefined ? currentQuestion.max_value : 10}
              step={currentQuestion.step !== undefined ? currentQuestion.step : 1}
              value={typeof currentAnswer === 'number' ? currentAnswer : 0}
              onValueChange={(value: number) => handleAnswer(value)}
            />
          </View>
        );

      default:
        return (
          <View style={styles.testContainer}>
            <Text style={styles.questionText}>
              Unsupported question type: {currentQuestion.question_type}
            </Text>
          </View>
        );
    }
  }

  // Helper function to safely render answer text
  const renderAnswerText = (answer: string | string[] | number): string => {
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }
    return String(answer);
  };

  // Show loading indicator while fetching existing answers
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Loading Your Survey</Text>
          </View>
          <View style={[styles.loadingContainer, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={styles.loadingText}>Loading your previous answers...</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }
  
  // Show error if loading failed
  if (loadingError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Error</Text>
          </View>
          <View style={[styles.errorContainer, { flex: 1, justifyContent: 'center', margin: 20 }]}>
            <Text style={styles.errorText}>{loadingError}</Text>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#4CAF50', marginTop: 20 }]}
              onPress={fetchExistingAnswers}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#333', marginTop: 10 }]}
              onPress={() => {
                // Reset to start a new survey from scratch
                setLoadingError(null)
                setIsLoading(false)
                setAnswers(new Array(questions.length).fill(null))
                setCurrentQuestionIndex(0)
              }}
            >
              <Text style={styles.buttonText}>Start New Survey</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (showSummary) {
    console.log('Showing summary with answers:', answers)
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Summary</Text>
          </View>

          <ScrollView 
            style={{ flex: 1, minHeight: 600 }}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {questions.map((question, index) => (
              <View key={question.id} style={styles.summaryItem}>
                <Text style={styles.questionText}>Q{index + 1}: {question.question_text}</Text>
                <View style={[
                  styles.answerContainer,
                  { backgroundColor: question.question_type === 'yes_no' 
                    ? (answers[index] === 'yes' ? 'green' : 'red')
                    : 'blue'
                  }
                ]}>
                  <Text style={styles.answerText}>
                    A: {answers[index] !== null && answers[index] !== undefined 
                      ? renderAnswerText(answers[index]) 
                      : 'Not answered'}
                  </Text>
                </View>
              </View>
            ))}
            
            {submitError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            <View style={styles.successContainer}>
              <Text style={styles.successText}>All answers have been successfully saved!</Text>
            </View>
          </ScrollView>

          <View style={styles.submitButtonContainer}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
              onPress={() => onComplete(answers)}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Please wait...' : 'Return to Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Question {currentQuestionIndex + 1} of {questions.length}</Text>
        </View>

        <View style={styles.contentContainer}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.testContainer}>
              <Text style={styles.questionText}>
                {currentQuestion?.question_text || 'Loading question...'}
              </Text>
            </View>

            {renderQuestionInput()}

            {currentAnswer !== null && currentAnswer !== undefined && (
              <View style={styles.testContainer}>
                <Text style={styles.questionText}>
                  Your answer: {renderAnswerText(currentAnswer)}
                </Text>
              </View>
            )}
            
            {submitError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.submitButtonContainer}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: currentAnswer ? (isSubmitting ? '#999' : 'green') : 'gray' }]}
              onPress={handleSubmit}
              disabled={!currentAnswer || isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting 
                  ? 'Saving...' 
                  : (currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Summary')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    height: 50,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  submitButtonContainer: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  testContainer: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    width: '100%',
  },
  button: {
    width: 200,
    height: 60,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    alignSelf: 'center',
  },
  yesNoButton: {
    width: 130,
    height: 60,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  questionText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  answerText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  mainScrollContent: {
    paddingBottom: 80, // Space for the button
  },
  summaryItem: {
    backgroundColor: '#f2f2f2',
    padding: 20,
    margin: 20,
    marginBottom: 20,
    borderRadius: 8,
    minHeight: 100,
    justifyContent: 'center',
  },
  answerContainer: {
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonWrapper: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
  },
  optionsContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  radioOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    padding: 8,
    borderRadius: 8,
  },
  radioText: {
    fontSize: 18,
    marginLeft: 15,
    color: '#000000',
    fontWeight: 'bold',
  },
  checkboxOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 18,
    marginLeft: 10,
    color: '#000000',
    fontWeight: '500',
  },
  sliderContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 24,
    textAlign: 'center',
    color: '#000000',
    fontWeight: 'bold',
  },
  sliderLabel: {
    fontSize: 16,
    color: '#000000',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  debugText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#ffdddd',
    borderRadius: 8,
    margin: 20,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successContainer: {
    padding: 20,
    backgroundColor: '#ddffdd',
    borderRadius: 8,
    margin: 20,
  },
  successText: {
    color: '#008800',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  prefilledBadge: {
    backgroundColor: '#4CAF50',
    padding: 5,
    borderRadius: 5,
    marginLeft: 10,
  },
  prefilledText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subHeaderText: {
    color: '#ffffff',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 5,
  },
  prefilledIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    padding: 5,
    borderRadius: 5,
  },
  prefilledIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
}) 