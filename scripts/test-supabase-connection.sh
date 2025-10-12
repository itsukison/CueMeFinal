#!/bin/bash

# Test Supabase Connection
# This script tests if the Supabase configuration is working

echo "🔧 Supabase Connection Test"
echo "=========================="
echo ""

# Check if .env.local file exists
if [[ ! -f ".env.local" ]]; then
    echo "❌ .env.local file not found!"
    exit 1
fi

# Extract Supabase URL and check if it's accessible
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2)
SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d'=' -f2)

echo "📋 Configuration Status:"
echo "  SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "  ANON_KEY: ${SUPABASE_ANON_KEY:0:30}..."
echo ""

# Test if Supabase endpoint is reachable
echo "🌐 Testing Supabase connectivity..."
if curl -s --max-time 10 "${SUPABASE_URL}/rest/v1/" -H "apikey: ${SUPABASE_ANON_KEY}" > /dev/null; then
    echo "✅ Supabase endpoint is reachable"
else
    echo "❌ Supabase endpoint is not reachable"
    echo "   Check your internet connection and Supabase URL"
fi

echo ""
echo "🔍 Next steps:"
echo "  1. Run: npm run dev -- --port 5180"
echo "  2. Look for '[ENV] NEXT_PUBLIC_SUPABASE_URL: Present' in logs"
echo "  3. Try developer login (Cmd+Z) to test authentication"
echo ""
echo "💡 If login still fails:"
echo "  - Check if the user account exists in Supabase"
echo "  - Verify the password is correct"  
echo "  - Check Supabase Auth settings"