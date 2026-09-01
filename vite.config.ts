import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

function localApiPlugin(): Plugin {
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  function generateFallback(
    filename: string,
    category: string,
    marketplace: string,
    targetKeywordsCount = 30,
    maxTitleLength = 76,
    maxDescLength = 120
  ) {
    const cleanName = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const genericTags = [
      'high quality',
      'commercial use',
      'isolated',
      'creative',
      'modern',
      'concept',
      'background',
      'vector',
      'graphic',
      'design',
      'illustration',
      'digital art',
      'professional',
      'stock photography',
      'marketing',
      'advertising',
      'banner',
      'copy space',
      'template',
      'trendy',
      'vibrant',
      'clean',
      'contemporary',
      'presentation',
      'technology',
      'business',
      'lifestyle',
      'minimalist',
      'element',
      'wallpaper',
      'symbol',
      'icon',
      'collection',
      'texture',
      'composition',
      'focus',
      'detailed',
      'studio shot',
      'abstract',
      'beautiful',
      'creative design',
      'commercial photo',
      'graphic asset',
      'visual element'
    ];

    const words = cleanName.toLowerCase().split(' ').filter(Boolean);
    const combinedSet = new Set<string>([...words, ...genericTags]);
    const keywords = Array.from(combinedSet).slice(0, targetKeywordsCount);

    let title = `${cleanName} for ${marketplace || 'Stock'} Marketplace`;
    if (title.length > maxTitleLength) {
      title = title.substring(0, maxTitleLength - 3) + '...';
    }

    let description = `Professional ${cleanName.toLowerCase()} asset with clean layout, perfect for creative design, advertising, and marketing campaigns.`;
    if (description.length > maxDescLength) {
      description = description.substring(0, maxDescLength - 3) + '...';
    }

    return {
      title,
      description,
      keywords,
      category: category || 'Graphic Resources',
      confidenceScore: 0.94,
      source: 'local-engine',
    };
  }

  return {
    name: 'local-api-handler',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
              serverTime: new Date().toISOString(),
            })
          );
          return;
        }

        if (req.url === '/api/generate-metadata' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsedBody = JSON.parse(body || '{}');
              const {
                filename,
                fileType,
                imageData,
                marketplace = 'Adobe Stock',
                titleLength = 76,
                descLength = 120,
                keywordsCount = 30,
                customPrompt = '',
                category = 'General',
              } = parsedBody;

              if (!filename) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Filename is required' }));
                return;
              }

              if (ai && process.env.GEMINI_API_KEY) {
                try {
                  const promptText = `
You are an expert stock photography and digital asset contributor specializing in metadata optimization for microstock platforms like Adobe Stock, Shutterstock, Freepik, Getty Images, and iStock.

Asset details:
- Filename: ${filename}
- File Format: ${fileType || 'Image/Vector'}
- Target Platform: ${marketplace}
- Category: ${category}
- Maximum Title Length: ${titleLength} characters
- Maximum Description Length: ${descLength} characters
- Required Keywords Count: Exactly ${keywordsCount} comma-separated tags
${customPrompt ? `- Custom Contributor Instructions: ${customPrompt}` : ''}

Rules:
1. Title must be concise, descriptive, commercial, and no more than ${titleLength} characters.
2. Description must be engaging and relevant, under ${descLength} characters.
3. Keywords must be an array of exactly ${keywordsCount} highly relevant, high-search-volume microstock keywords. No trademarked brand names. Ordered by relevance.
4. Suggest the best marketplace category.
`;

                  const contents: any[] = [];
                  if (imageData && imageData.startsWith('data:')) {
                    const [header, base64] = imageData.split(';base64,');
                    const mimeType = header.replace('data:', '');
                    contents.push({
                      inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: base64,
                      },
                    });
                  }
                  contents.push({ text: promptText });

                  const response = await ai.models.generateContent({
                    model: 'gemini-3.7-flash',
                    contents: contents.length === 1 ? contents[0].text : { parts: contents },
                    config: {
                      responseMimeType: 'application/json',
                      responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING, description: 'Optimized stock asset title' },
                          description: { type: Type.STRING, description: 'Commercial asset description' },
                          keywords: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: 'List of relevant keywords for search ranking',
                          },
                          category: { type: Type.STRING, description: 'Microstock category' },
                        },
                        required: ['title', 'description', 'keywords', 'category'],
                      },
                    },
                  });

                  if (response.text) {
                    const data = JSON.parse(response.text);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(
                      JSON.stringify({
                        title: data.title || filename,
                        description: data.description || '',
                        keywords: data.keywords || [],
                        category: data.category || category,
                        source: 'gemini-3.7-flash',
                      })
                    );
                    return;
                  }
                } catch (geminiError: any) {
                  console.warn('Dev middleware Gemini call fallback:', geminiError?.message);
                }
              }

              const fallback = generateFallback(
                filename,
                category,
                marketplace,
                keywordsCount,
                titleLength,
                descLength
              );
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(fallback));
            } catch (error: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
