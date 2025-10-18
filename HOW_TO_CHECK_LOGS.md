# How to Check Production Logs

## Release Process ✅ DONE

You've just released **v1.0.64** with production logging enabled!

The GitHub Actions workflow is now building your app. Check progress at:
https://github.com/itsukison/CueMeFinal/actions

## Where to Find Logs

### On macOS (Your System):
```bash
# View logs in real-time
tail -f ~/Library/Logs/CueMe/main.log

# Open log file in TextEdit
open ~/Library/Logs/CueMe/main.log

# Open log folder in Finder
open ~/Library/Logs/CueMe/
```

### Log File Location by Platform:
- **macOS:** `~/Library/Logs/CueMe/main.log`
- **Windows:** `%USERPROFILE%\AppData\Roaming\CueMe\logs\main.log`
- **Linux:** `~/.config/CueMe/logs/main.log`

## Testing Steps

### 1. Wait for GitHub Actions to Complete
- Go to: https://github.com/itsukison/CueMeFinal/actions
- Wait for the build to finish (usually 10-15 minutes)
- Download the `.dmg` file from the release

### 2. Install and Run the App
```bash
# Download from GitHub Releases
# Install CueMe.app
# Run the app
```

### 3. Check Logs Immediately
```bash
# Open Terminal and run:
tail -f ~/Library/Logs/CueMe/main.log
```

## What to Look For in Logs

### ✅ Good Signs (Everything Working):
```
[ENV] ✅ Successfully loaded from: /path/to/.env
[ENV] Loaded 4 variables: GEMINI_API_KEY, OPENAI_API_KEY, ...
[ENV] Required variable present: GEMINI_API_KEY
[ENV] Optional variable present: OPENAI_API_KEY
[ENV] ✅ All required variables present

📋 Environment Variables:
  OPENAI_API_KEY: Present
  GEMINI_API_KEY: Present

AudioTranscriber: Initialized successfully
```

### ❌ Problem Signs (Need to Fix):
```
[ENV] ⚠️  No .env file found in any location
[ENV] ❌ Missing required variables: OPENAI_API_KEY

📋 Environment Variables:
  OPENAI_API_KEY: Missing
  
AudioTranscriber: Cannot initialize - Missing OpenAI API key
This is likely why audio transcription is not working!
```

## Common Issues and Solutions

### Issue 1: .env File Not Found
**Log shows:** `[ENV] ⚠️  No .env file found in any location`

**Solution:** The .env file wasn't packaged correctly. Check:
1. Verify GitHub secrets are set in repository settings
2. Check the build logs in GitHub Actions
3. The .env should be in `<app>/Contents/Resources/.env`

### Issue 2: API Keys Missing
**Log shows:** `[ENV] Optional variable missing: OPENAI_API_KEY`

**Solution:** GitHub secrets not configured properly:
1. Go to: https://github.com/itsukison/CueMeFinal/settings/secrets/actions
2. Click on "Environments" → "cueme"
3. Verify these secrets exist:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Issue 3: Audio System Not Initializing
**Log shows:** `AudioTranscriber Error: ...`

**Solution:** Check the full error message in logs and share it for diagnosis.

## Quick Commands

```bash
# Check if log file exists
ls -la ~/Library/Logs/CueMe/

# View last 50 lines of log
tail -50 ~/Library/Logs/CueMe/main.log

# Search for errors
grep -i "error\|missing\|failed" ~/Library/Logs/CueMe/main.log

# Search for environment loading
grep "\[ENV\]" ~/Library/Logs/CueMe/main.log

# Search for audio system
grep -i "audio\|transcrib" ~/Library/Logs/CueMe/main.log
```

## Next Steps After Checking Logs

1. **Run the released app** from GitHub
2. **Open the log file** immediately
3. **Look for the patterns** above
4. **Share the relevant log lines** if you need help diagnosing

The logs will tell us exactly what's failing!
