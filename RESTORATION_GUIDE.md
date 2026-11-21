# Faruk Stock Metadata Generator Pro - Restoration & Blueprint Guide

এই ডকুমেন্টটি সংরক্ষণ করা হয়েছে যাতে ভবিষ্যতে প্রজেক্ট কোনো কারণে মুছে গেলেও এই ব্যাকআপ ফাইলটি আপলোড করামাত্র যে কোনো AI অ্যাসিস্ট্যান্ট বা ডেভেলপার কোনো নতুন নির্দেশনা ছাড়াই হুবহু এই সম্পূর্ণ টুলটি পুনরায় বিল্ড ও রান করতে পারে।

---

## ১. প্রজেক্ট পরিচিতি ও আর্কিটেকচার (System Architecture)
- **নাম**: Faruk Stock Metadata Generator Pro
- **ক্যাটাগরি**: Microstock Photography & Vector Metadata SEO Suite
- **প্রযুক্তি**: Express 4 (Node.js) + Vite 6 + React 19 + TypeScript + Tailwind CSS v4.
- **রানটাইম পোর্ট**: `3000` (বাইনরি `0.0.0.0:3000`, `server.ts` ফাইল থেকে পরিচালিত)।
- **ডেভ কমান্ড**: `npm run dev` (একটি সিঙ্গেল কমান্ডে Express ব্যাকএন্ড এবং Vite ফ্রন্টএন্ড একসাথে চলে)।
- **বিল্ড কমান্ড**: `npm run build` (`vite build && esbuild server.ts --bundle ...`).
- **লিন্ট ও টাইপচেক**: `npm run lint` (`tsc --noEmit`).

---

## ২. মূল ব্যবসায়িক নিয়ম ও অপরিবর্তনীয় ফিচার (Core Business Logic & Invariants)

1. **Zero-Trademark Policy (১০০% ট্রেডমার্ক মুক্ত)**:
   - কোনো টাইটেল বা কীওয়ার্ডে রেজিস্টার্ড ব্র্যান্ড বা ট্রেডমার্ক থাকতে পারবে না (যেমন: `BOSU`, `Zumba`, `CrossFit`, `Peloton`, `TRX`, `Nike`, `iPhone`, ইত্যাদি)।
   - বিল্ট-ইন স্যানিটাইজার স্বয়ংক্রিয়ভাবে এগুলোকে জেনেরিক বাণিজ্যিক শব্দে রূপান্তর করবে:
     - `BOSU ball` ➔ `half balance ball`
     - `Zumba` ➔ `dance fitness`
     - `CrossFit` ➔ `functional fitness`
     - `iPhone` ➔ `smartphone`
     - `iPad` ➔ `digital tablet`
     - `Nike / Adidas` ➔ `sportswear / activewear`

2. **Title Punctuation (টাইটেল বিরামচিহ্ন)**:
   - প্রতিটি জেনারেট হওয়া স্টক টাইটেল অবশ্যই একটি ফুলস্টপ (`.`) দিয়ে শেষ হতে হবে।
   - টাইটেলের আদর্শ দৈর্ঘ্য: ৬৫ থেকে ৭৬ ক্যারেক্টার (Sentence case)।

3. **Adobe Sensei & Shutterstock Keyword Ranking (টপ ১০ কীওয়ার্ডের অগ্রাধিকার)**:
   - জেনারেট হওয়া টাইটেলের মূল বিশেষ্য ও বিশেষণ শব্দগুলোকে হুবহু গুরুত্ব অনুসারে **১ থেকে ১০ নম্বর কীওয়ার্ডে** সাজাতে হবে।

4. **Conceptual Keywords (বিমূর্ত কীওয়ার্ড)**:
   - দৃশ্যমান অবজেক্টের বাইরেও ইমেজ ও ক্যাটাগরি বিশ্লেষণ করে ৩-৫টি উচ্চ-মূল্যের অনুভূতি ও বার্তাভিত্তিক কীওয়ার্ড (যেমন: `hope`, `future`, `innovation`, `success`, `sustainability`) স্বয়ংক্রিয়ভাবে যুক্ত হতে হবে।

5. **ডুয়াল ইঞ্জিন (Dual Engine)**:
   - **ইঞ্জিন ১ (Online Gemini Vision AI)**: মাল্টিমোডাল ভিশন এনালাইসিস এবং একাধিক এপিআই কী রোটেশন পুল।
   - **ইঞ্জিন ২ (Offline Smart SEO Engine)**: কোনো API Key ছাড়াই সম্পূর্ণ অফলাইনে আনলিমিটেড স্টক মেটাডাটা ও Adobe Sensei র‍্যাঙ্কিং।

6. **এক্সপোর্ট ব্যবস্থা**:
   - Adobe Stock, Shutterstock, Magnific ইত্যাদি প্ল্যাটফর্মের জন্য ওয়ান-ক্লিক কাস্টম CSV এক্সপোর্ট।
   - সরাসরি IPTC/XMP মেটাডাটা এম্বেডিং।
   - `/api/backup-project` দিয়ে সম্পূর্ণ সোর্স কোডের ব্যাকআপ জিপ ডাউনলোড।

---

## ৩. রিস্টোর করার ধাপ (How to Restore in AI Studio or New Machine)

যদি কখনো নতুন করে প্রজেক্ট সেটআপ করতে হয়:
```bash
# ১. ডিপেনডেন্সি ইন্সটল
npm install

# ২. টাইপস্ক্রিপ্ট ও কোড ভ্যালিডেশন
npm run lint

# ৩. অ্যাপ চালু করা
npm run dev
```

AI অ্যাসিস্ট্যান্টদের জন্য নির্দেশ: এই রিপোজিটরির রুট ডিরেক্টরিতে থাকা `AGENTS.md` ও `GEMINI.md` ফাইলে বর্ণিত সকল রুলস ও বিজনেস লজিক কঠোরভাবে অনুসরণ করতে হবে।
