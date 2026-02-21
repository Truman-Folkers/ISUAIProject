# Syllabus Summarization Feature

## Overview
The AI-powered syllabus summarization feature automatically extracts and categorizes key information from course syllabi into 4 useful categories.

## How It Works

### When You Click "📄 Summarize Syllabus"

1. **Scraping** - The extension scrapes the syllabus content from the current Canvas course page using multi-strategy approach:
   - Looks for dedicated syllabus sections
   - Searches for content with "syllabus" or "course information" headings
   - Falls back to all visible page text if needed

2. **Detection** - The extension checks if meaningful content was found:
   - If less than 50 characters OR contains "No syllabus content found" → Shows **"No syllabus detected"**
   - If meaningful content found → Proceeds to AI summarization

3. **AI Summarization** - The backend calls OpenAI API to extract:
   - **DUE DATES** - All assignment/exam deadlines
   - **GRADING BREAKDOWN** - How grades are calculated (percentages/weights)
   - **MAJOR ASSIGNMENTS** - Significant projects, exams, papers
   - **INSTRUCTOR CONTACT** - Name, email, office hours, phone

4. **Display** - Results appear in the textbox for easy reading

## Requirements

### Backend Setup
The backend server must be running on `localhost:3000` with:
- Node.js/Express
- OpenAI API key in `.env` file (OPENAI_API_KEY)

### Canvas Course Page
The feature works when:
- You're on a Canvas course page (URL contains `/courses/[id]`)
- The course has syllabus content available
- You're logged into Canvas

## File Changes

### Modified Files
- `src/sidebar/sidebar.jsx` - Added `summarizeWithAI()` and enhanced `summarizeSyllabus()`
- `backend/index.js` - Added `/api/summarize` endpoint for AI processing

### Key Functions
```javascript
// Main function - triggered by button click
const summarizeSyllabus = async () {
  // 1. Scrapes syllabus from page
  // 2. Checks if content is meaningful
  // 3. Calls AI if meaningful, displays "No syllabus detected" otherwise
}

// Helper function - calls backend AI API
const summarizeWithAI = async (syllabusText) {
  // Sends prompt to backend
  // Receives formatted 4-category summary
}
```

## Error Handling

If the feature fails, you'll see:
- **"No syllabus detected"** - No meaningful content found on page
- **"Failed to process syllabus. Please ensure you have configured an API key."** - Backend not running or API key missing
- **"Error: [message]"** - Connection/parsing error

## Testing

To test the feature:
1. Navigate to any Canvas course page
2. Ensure the backend is running (`npm run dev` in `/backend`)
3. Click "📄 Summarize Syllabus" button
4. Wait for processing (should take 2-5 seconds)
5. Check the textbox for results

## Future Enhancements

Possible improvements:
- Copy button to copy summary to clipboard
- Export as PDF
- Custom category selection
- Caching summaries per course
- Multi-language support
