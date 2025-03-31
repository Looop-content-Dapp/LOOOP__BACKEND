# Use Alpine Node.js 22 for a lightweight image
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package files separately for better caching
COPY package.json package-lock.json ./

# Install dependencies (omit dev dependencies)
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port the app runs on (adjust as needed)
EXPOSE 3000

# Use environment variables passed at runtime
CMD ["node", "index.js"]