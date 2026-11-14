FROM node:22-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm run install:all

# Copy project source
COPY . .

# Build frontend and server
RUN npm run build

# Hugging Face Spaces & standard cloud default port
ENV PORT=7860
ENV NODE_ENV=production

EXPOSE 7860

CMD ["npm", "start"]
