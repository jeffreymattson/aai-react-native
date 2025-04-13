export interface Question {
  id: string
  question_text: string
  question_type: 'yes_no' | 'single_choice' | 'multiple_choice' | 'scale'
  options?: string[]
  min_value?: number
  max_value?: number
  step?: number
  is_required?: boolean
  existing_answer?: string
} 