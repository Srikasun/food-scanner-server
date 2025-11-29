// Food Scanner Server - Node.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Your Gemini API Key
const GEMINI_API_KEY = 'AIzaSyDIkWkWR-Cm1IZnYpy5xC61Nr47ymQbJm4';

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Food Scanner Server is running!',
        endpoints: {
            health: 'GET /',
            analyze: 'POST /analyze-food'
        }
    });
});

// Main food analysis endpoint
app.post('/analyze-food', async (req, res) => {
    console.log('=== FOOD ANALYSIS REQUEST RECEIVED ===');
    
    try {
        const { imageBase64, imageUrl, userEmail, userName } = req.body;
        
        console.log('User:', userName, userEmail);
        
        let base64Image;
        
        // Check if base64 was sent directly from Cliq
        if (imageBase64) {
            console.log('Using base64 image from request (direct from Cliq)');
            base64Image = imageBase64;
        }
        // Or if URL was sent, download it
        else if (imageUrl) {
            console.log('Downloading image from URL:', imageUrl);
            const imageResponse = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
            console.log('Image converted to base64');
        }
        else {
            return res.status(400).json({ 
                success: false,
                error: 'No image provided (need imageBase64 or imageUrl)' 
            });
        }
        
        // Prepare Gemini API request
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `You are a nutrition expert. Analyze this food image and provide detailed nutritional information.

Return ONLY a valid JSON object (no markdown, no code blocks) in this exact format:

{
  "foods": [
    {
      "name": "food item name",
      "portion": "estimated portion size",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0
    }
  ],
  "total_calories": 0,
  "total_protein": 0,
  "total_carbs": 0,
  "total_fat": 0
}

Important:
- List each food item separately
- Provide realistic portion estimates
- All numbers must be integers
- If multiple items, add them to foods array
- Calculate totals correctly`;
        
        const geminiPayload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: base64Image
                        }
                    }
                ]
            }]
        };
        
        // Call Gemini API
        console.log('Calling Gemini API...');
        const geminiResponse = await axios.post(geminiUrl, geminiPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        
        console.log('Gemini API response received');
        
        // Parse response
        const textResponse = geminiResponse.data.candidates[0].content.parts[0].text;
        console.log('Raw response:', textResponse);
        
        // Clean response (remove markdown if present)
        let cleanedResponse = textResponse.trim();
        if (cleanedResponse.includes('```json')) {
            const start = cleanedResponse.indexOf('{');
            const end = cleanedResponse.lastIndexOf('}') + 1;
            cleanedResponse = cleanedResponse.substring(start, end);
        } else if (cleanedResponse.includes('```')) {
            const start = cleanedResponse.indexOf('{');
            const end = cleanedResponse.lastIndexOf('}') + 1;
            cleanedResponse = cleanedResponse.substring(start, end);
        }
        
        const foodData = JSON.parse(cleanedResponse);
        console.log('Parsed food data:', foodData);
        
        // Return structured response
        res.json({
            success: true,
            data: foodData,
            userEmail: userEmail,
            userName: userName
        });
        
        console.log('=== ANALYSIS COMPLETE ===');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data || 'Check server logs'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Food Scanner Server started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`✅ Ready to analyze food images!`);
    console.log('📸 Accepts: imageBase64 (from Cliq) or imageUrl');
});
