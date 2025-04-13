import gradio as gr
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic

from langchain.schema import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool

load_dotenv()

#llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)
#llm = ChatAnthropic(model="claude-3-5-sonnet-20241022",streaming=True)
llm = ChatGoogleGenerativeAI(model="gemini-exp-1206", streaming=True)

# System-level prompt for AA counselor
SYSTEM_PROMPT = """
You are an Alcoholics Anonymous (AA) counselor. Your role is to provide support, guidance, and encouragement to individuals struggling with alcohol addiction.
You should respond with empathy, understanding, and non-judgmental advice. Your goal is to help the user reflect on their situation, consider the 12-step program,
and provide resources or coping strategies when appropriate. Always maintain a supportive and compassionate tone.

Keep responses to 100 words or less.
"""

# Database connection parameters
DB_NAME = "postgres"
DB_USER = "postgres.mxocgitdwarxhtxfjeeg"
DB_PASSWORD = "8JEtn7UQnhFneyPc"
DB_HOST = "aws-0-us-east-2.pooler.supabase.com"
DB_PORT = "6543"

# Connect to the PostgreSQL database
def get_db_connection():
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    return conn

# Function to store chat history in the database
def store_chat_history(user_id, message, response):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (user_id, message, response) VALUES (%s, %s, %s)",
        (user_id, message, response)
    )
    conn.commit()
    cur.close()
    conn.close()

# Function to retrieve chat history from the database
def get_chat_history(user_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT message, response, timestamp FROM chat_history WHERE user_id = %s ORDER BY timestamp",
        (user_id,)
    )
    history = cur.fetchall()
    cur.close()
    conn.close()
    return history

def format_message(text: str, is_user: bool = True) -> dict:
    """Format a message with role and content keys."""
    return {
        "role": "user" if is_user else "assistant",
        "content": text
    }

def generate_response(user_message: str, history: list) -> str:
    """Generate a response to the user message."""
    try:
        # Format the system prompt and conversation history
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
        
        # Add conversation history
        for user_msg, bot_msg in history:
            messages.append({"role": "user", "content": user_msg})
            messages.append({"role": "assistant", "content": bot_msg})
        
        # Add the current message
        messages.append({"role": "user", "content": user_message})
        
        # Generate response using the language model
        response = llm.invoke(messages)
        return response.content
    except Exception as e:
        print(f"Error generating response: {e}")
        return str(e)

def chat(message, history):
    # Add the user's message to history
    history = history + [[message, None]]
    
    # Process the message and get the response
    response = generate_response(message, history)
    
    # Update the history with the response
    history[-1][1] = response
    
    # Return both the updated history and an empty string to clear the input
    return history, ""

# Set up the Gradio interface
with gr.Blocks(css="""
    .gradio-container { height: 100vh !important; }
    .contain { display: flex !important; flex-direction: column !important; height: 100% !important; }
    .chatbot { flex-grow: 1 !important; overflow-y: auto !important; max-height: calc(100vh - 140px) !important; }
    .input-row { padding: 10px !important; background: white !important; border-top: 1px solid #eee !important; }
    .message { padding: 0px 4px !important; margin: 0 !important; }
    .message.user { margin-right: 5px !important; }
    .message.assistant { margin-left: 5px !important; }
    .message-content { padding: 3px 5px !important; }
    .message.user .message-content { background: #e3f2fd !important; }
    .message.assistant .message-content { background: #f5f5f5 !important; }
    .chatbot > div { margin: 0 !important; }
    .chatbot > div > div { margin: 0 !important; }
    .chatbot > div > div > div { margin: 0 !important; }
""") as demo:
    with gr.Column(elem_classes="contain"):
        chatbot = gr.Chatbot(
            value=[],
            elem_classes="chatbot",
            height=400,
            show_label=False,
            container=True
        )
        with gr.Row(elem_classes="input-row"):
            msg = gr.Textbox(
                placeholder="Type your message here...",
                container=False,
                scale=7,
                show_label=False,
                lines=1,
                max_lines=1
            )
            clear = gr.ClearButton([msg, chatbot], scale=1)

    # Handle both button click and Enter key press
    msg.submit(chat, [msg, chatbot], [chatbot, msg], queue=True)
    clear.click(lambda: ([], ""), None, [chatbot, msg], queue=False)

    # Add keyboard event handler
    demo.load(None, None, _js="""
        function() {
            const textbox = document.querySelector('.input-row textarea');
            if (textbox) {
                textbox.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const submitButton = document.querySelector('.input-row button');
                        if (submitButton) {
                            submitButton.click();
                        }
                    }
                });
            }
        }
    """)

# Launch the server
if __name__ == "__main__":
    print("Starting chat server...")
    demo.queue()
    demo.launch(
        server_name="0.0.0.0",
        show_api=False,
        favicon_path=None
    )