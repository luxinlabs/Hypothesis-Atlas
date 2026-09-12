#!/bin/bash
# Generate Prisma client during build. Schema pushes (db push) should be done manually.

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set, using placeholder for build"
  export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
fi

npx prisma generate || echo "Prisma generate failed, continuing anyway..."
