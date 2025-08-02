#!/bin/bash

# Database Setup Script for Stripe Payment Template
# This script sets up PostgreSQL, runs migrations, and seeds data

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_message $BLUE "🚀 Starting database setup for Stripe Payment Template..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_message $RED "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    print_message $YELLOW "⚠️ .env.local not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_message $GREEN "✅ Created .env.local from .env.example"
        print_message $YELLOW "📝 Please edit .env.local with your specific configuration"
    else
        print_message $RED "❌ .env.example not found. Please create .env.local manually"
        exit 1
    fi
fi

# Load environment variables
source .env.local

# Ensure required environment variables are set
if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ]; then
    print_message $RED "❌ Required database environment variables are not set"
    print_message $YELLOW "Please set POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD in .env.local"
    exit 1
fi

print_message $BLUE "🐳 Starting PostgreSQL and Redis containers..."

# Start database services
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
print_message $YELLOW "⏳ Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB > /dev/null 2>&1; then
        print_message $GREEN "✅ PostgreSQL is ready"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        print_message $RED "❌ PostgreSQL failed to start after $max_attempts attempts"
        exit 1
    fi
    
    echo -n "."
    sleep 2
    ((attempt++))
done

# Install Node.js dependencies if not already installed
if [ ! -d "node_modules" ]; then
    print_message $BLUE "📦 Installing Node.js dependencies..."
    npm install
fi

# Check if Prisma CLI is available
if ! command -v npx prisma > /dev/null 2>&1; then
    print_message $RED "❌ Prisma CLI not found. Make sure dependencies are installed."
    exit 1
fi

# Generate Prisma client
print_message $BLUE "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
print_message $BLUE "🔄 Running database migrations..."
npx prisma migrate dev --name init

# Check if migration was successful
if [ $? -eq 0 ]; then
    print_message $GREEN "✅ Database migrations completed successfully"
else
    print_message $RED "❌ Database migrations failed"
    exit 1
fi

# Seed the database
print_message $BLUE "🌱 Seeding database with initial data..."
npx prisma db seed

# Check if seeding was successful
if [ $? -eq 0 ]; then
    print_message $GREEN "✅ Database seeding completed successfully"
else
    print_message $YELLOW "⚠️ Database seeding failed or was skipped"
fi

# Verify database connection
print_message $BLUE "🔍 Verifying database connection..."
node -e "
const { prisma } = require('./src/lib/database/connection');
(async () => {
  try {
    await prisma.\$connect();
    console.log('✅ Database connection verified');
    await prisma.\$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
})();
"

# Show database status
print_message $BLUE "📊 Database Status:"
echo ""
echo "Database: $POSTGRES_DB"
echo "User: $POSTGRES_USER"
echo "Host: localhost"
echo "Port: ${POSTGRES_PORT:-5432}"
echo ""

# Display next steps
print_message $GREEN "🎉 Database setup completed successfully!"
print_message $BLUE "📋 Next steps:"
echo "1. Update your Stripe API keys in .env.local"
echo "2. Configure your email settings for notifications"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Visit http://localhost:3000 to access the application"
echo ""
print_message $YELLOW "📝 Sample login credentials (development only):"
echo "Admin: admin@example.com / admin123!"
echo "Customer: customer@example.com / customer123!"
echo "Support: support@example.com / support123!"

print_message $GREEN "✨ Setup complete! Happy coding!"