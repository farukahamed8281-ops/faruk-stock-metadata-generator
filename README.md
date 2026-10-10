# Faruk Stock Metadata Generator Pro

A full-stack, AI-powered stock photography and illustration metadata generator optimized for microstock contributors (Adobe Stock, Shutterstock, Getty Images / iStock, Dreamstime, Vecteezy, and Magnific).

---

## 🚀 Quick Start Guide

If you extract this project or upload it to Google AI Studio / another machine:

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Add your Google Gemini API key to `.env` (optional, as rotation key pools and intelligent fallback engines are also built-in):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Development Server
Run the unified Express + Vite development server:
```bash
npm run dev
```
The application will start on `http://localhost:3000`.

### 4. Production Build & Start
```bash
# Build Vite client assets and bundle Express backend
npm run build

# Start production server
npm start
```

---

## 🛠 Project Architecture

* **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide React icons, Motion animations.
* **Backend**: Express.js (`server.ts`) with custom Vite middleware integration for single-port dev/prod routing.
* **AI Service**: Google GenAI SDK (`@google/genai`) using Gemini 2.5 Flash / Gemini 1.5 with automated rate-limit retry, key rotation pool, and intelligent taxonomy fallback.
* **Stock SEO Engine**:
  * **Zero-Trademark Policy**: Automatic filtering and generic conversion of trademarked items (e.g. `bosu ball` → `half balance ball`, `zumba` → `dance fitness`, `crossfit` → `functional fitness`).
  * **Title SEO Rule**: Titles strictly formatted in sentence case and always end with a single full stop (`.`).
  * **Keyword Order**: First 10 keywords strictly aligned with the core words in the title for Adobe Sensei and Shutterstock mShot search ranking.
* **Export Utilities**:
  * Direct CSV exports customized for Adobe Stock, Shutterstock, etc.
  * Direct image EXIF / IPTC metadata injection.
  * Batch ZIP download for images with rewritten SEO filenames.
  * Full source code backup ZIP exporter.
