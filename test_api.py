import google.generativeai as genai
import os

# --- IMPORTANT ---
# For security, it's best to set your API key as an environment variable.
# In your terminal, run: export GOOGLE_API_KEY='YOUR_API_KEY'
# -----------------
genai.configure(api_key=os.environ.get("AIzaSyCAUYioBx3b03PHR4FSZtUNmfZ282m7yaY"))

# (Alternatively, you can paste the key directly, but this is not recommended)
# genai.configure(api_key="YOUR_API_KEY")

# Initialize the model
model = genai.GenerativeModel('gemini-pro')

# Send a prompt and get the response
prompt = "Write a short story about a robot who discovers music."
response = model.generate_content(prompt)

# Print the result
print(response.text)