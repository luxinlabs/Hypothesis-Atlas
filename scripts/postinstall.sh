#!/bin/bash
# Generate Prisma client without database validation
# This allows builds to succeed even without a valid DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set, using placeholder for build"
  export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
fi

npx prisma generate || echo "Prisma generate failed, continuing anyway..."
