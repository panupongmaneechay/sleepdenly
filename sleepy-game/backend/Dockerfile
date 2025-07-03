# backend/Dockerfile
FROM python:3.10.0-slim-buster

WORKDIR /app

# Copy requirements.txt and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code
COPY . .

# Expose the port your Flask app runs on
EXPOSE 5000

# Command to run the Flask application by executing app.py directly
CMD ["python", "app.py"]