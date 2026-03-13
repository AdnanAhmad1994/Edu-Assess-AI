# Edu-Assess-AI 🎓🤖

Edu-Assess-AI is a premium, AI-powered educational assessment platform designed to streamline quiz creation, delivery, and analysis. Powered by **Google Gemini**, it provides instructors with cutting-edge tools to generate assessments, monitor student performance with advanced proctoring, and manage educational content.

## 🚀 Key Features

### 🧠 Intelligent AI Quiz Generation
- **Dynamic Creation**: Generate high-quality MCQs and essay questions directly from uploaded PDF/Docx lectures or text descriptions.
- **Provider Choice**: Full integration with **Google Gemini (2.0/2.5)**, Groq, and OpenAI.
- **Context-Aware**: AI understands the nuance of your content for accurate testing.

### 🛡️ Advanced Proctoring & Security
- **Multi-layer Anti-Cheat**: Real-time tracking of tab switching and browser focus loss.
- **Violation Thresholds**: Automatic flagging and submission lock based on customizable violation limits.
- **Pattern Authentication**: Secure "Pattern Lock" login option for enhanced user security.

### 📅 Advanced Scheduling & Access
- **Precision Timing**: Set exact availability windows for quizzes and assignments.
- **Status Badges**: Real-time "Upcoming", "Active", and "Expired" indicators for students.
- **Public Quiz Links**: Shared access for guest attempts with custom identification fields.

### 📁 Smart Content Management
- **Google Drive Integration**: Seamlessly store and retrieve lecture files using Google Drive API.
- **Multiple Formats**: Support for PDF, Word (.docx), and Excel (.xlsx) file parsing.

### 📊 Professional Analytics
- **Dynamic Gradebook**: Comprehensive view of all student performance across courses.
- **Visual Insights**: Performance trends, score distributions, and top/low performer analytics using Recharts.

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Shadcn/ui, Framer Motion.
- **Backend**: Node.js, Express, Netlify Functions.
- **Database**: PostgreSQL (Supabase/Postgres) with **Drizzle ORM**.
- **Auth**: Passport.js (Session-based) + Email OTP Verification.
- **Storage**: Google Drive / Supabase Object Storage.

---

## ⚙️ Setup & Deployment

### Environment Variables
Create a `.env` file in the root directory:

```env
DATABASE_URL=your_postgres_url
SESSION_SECRET=your_secure_secret
GENAI_API_KEY=your_google_gemini_api_key
# Optional for Google Drive storage
GOOGLE_DRIVE_CLIENT_EMAIL=...
GOOGLE_DRIVE_PRIVATE_KEY=...
GOOGLE_DRIVE_FOLDER_ID=...
```

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Sync Database**:
   ```bash
   npm run db:push
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

### 🌍 Netlify Deployment

This project is optimized for Netlify Functions. When deploying:
1. Set the **Build Command** to `npm run build`.
2. Set the **Publish Directory** to `dist`.
3. Add all `.env` variables to Netlify's Environment Variables settings.
4. **Important**: Add `NODE_ENV=production` to ensure SSL and performance optimizations are active.

---

## 🔍 Debugging
Use the built-in diagnostic endpoint to verify database health:
`/api/debug-db`

## 📜 License
This project is licensed under the MIT License.
