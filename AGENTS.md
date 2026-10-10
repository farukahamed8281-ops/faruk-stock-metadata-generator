# Instructions for AI Coding Assistants (AGENTS.md)

This project is **Faruk Stock Metadata Generator Pro**, a full-stack web application designed for stock photographers and vector contributors.

## Project Structure & Runtime
- **Type**: Full-Stack (Express 4 + Vite + React 19 + TypeScript).
- **Port**: Port 3000 (binds to `0.0.0.0:3000` via `server.ts`).
- **Dev Command**: `npm run dev` (runs `tsx server.ts` with integrated Vite middleware).
- **Build Command**: `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`).
- **Start Command**: `npm start` (`node dist/server.cjs`).
- **Lint Command**: `npm run lint` (`tsc --noEmit`).

## Core Business Logic & Invariant Rules
1. **Zero Trademark Violations (100% Trademark Free)**:
   - Never output brand names or registered trademarks in titles or keywords (e.g., `bosu`, `bosu ball`, `zumba`, `crossfit`, `peloton`, `trx`, `theraband`, `fitbit`, `iphone`, `ipad`, `nike`, `starbucks`, `tesla`, etc.).
   - Replace with generic commercial stock terms:
     - `bosu ball` -> `half balance ball` or `balance trainer`
     - `zumba` -> `dance fitness`
     - `crossfit` -> `functional fitness`
     - `iphone` -> `smartphone`
     - `ipad` -> `digital tablet`
     - `macbook` -> `laptop computer`
     - `nike` / `adidas` -> `sportswear` / `activewear`
2. **Title Punctuation**:
   - All generated titles MUST end with a single full stop (`.`).
   - Sentence case formatting, 65-76 characters default.
3. **Keyword Ordering**:
   - Top 10 keywords MUST mirror the primary nouns and adjectives in the title in exact importance order for Adobe Stock (Sensei) and Shutterstock search ranking.
4. **Backend Architecture**:
   - API endpoints live in `server.ts`.
   - API key management: GEMINI_API_KEY is handled strictly server-side. Key rotation pool in memory allows multi-key fallback.
   - Backup route at `/api/backup-project` generates on-demand full source code backup ZIP.
