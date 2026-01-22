#!/bin/bash
# Generate Prisma client and push schema to database

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set, using placeholder for build"
  export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
  npx prisma generate || echo "Prisma generate failed, continuing anyway..."
else
  echo "DATABASE_URL is set, pushing schema and generating client"
  npx prisma db push --accept-data-loss || echo "Prisma db push failed, continuing anyway..."
  npx prisma generate || echo "Prisma generate failed, continuing anyway..."
fi
