# Campus OS AI

Campus OS AI is a full-stack campus management platform with AI-powered features, built with a separate frontend and backend.

🔗 **Live Demo:** https://campus-os-ai-frontend-backend-beryl.vercel.app/
---

## ✨ Features

- 🎓 Student, course, and campus data management
- 🤖 AI-powered assistant for answering campus-related queries
- 🔐 User authentication and role-based access
- 📊 Dashboard for viewing and managing records
- ⚡ Fast, responsive UI

> Update this list with your project's actual features.


## 🛠️ Tech Stack

**Frontend**
- React.js
- Tailwind CSS / CSS
- Axios (API calls)

**Backend**
- Node.js
- Express.js
- MongoDB / PostgreSQL (Database)

**Other**
- Vercel (Deployment)
- OpenAI / AI API (for AI features)

> Update this section to match your exact stack.

---

## 📁 Project Structure

```
campus-os-ai-frontend-backend/
├── frontend/          # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Node/Express backend
│   ├── src/
│   ├── routes/
│   ├── models/
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (for local development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/campus-os-ai-frontend-backend.git
   cd campus-os-ai-frontend-backend
   cd campus-os-ai
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend` folder:
   ```
   PORT=3001
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
   JWT_SECRET=dev-secret-change-me
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=http://localhost:5173
   ```
   Start the backend server:
   ```bash
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   ```
   Create a `.env` file in the `frontend` folder:
   ```
   VITE_API_URL=http://localhost:3001
   ```
   Start the frontend:
   ```bash
   npm run dev
   ```

4. **Open the app**
   ```
   http://localhost:5173
   ```

---

## 🌐 Deployment

This project is deployed on **Vercel**.

- The frontend is deployed to Vercel, and the backend is deployed to a separate service like Render.
- The `frontend/vercel.json` file is crucial for a Single Page Application (SPA). It ensures that direct navigation to routes like `/dashboard` works correctly after deployment.
- **Important:** For the live backend on Render, you must set the environment variables in the Render dashboard. The `DATABASE_URL` should be the "Internal Connection String" provided by your Render PostgreSQL instance, and `CORS_ORIGIN` must be set to your Vercel frontend URL (e.g., `https://campus-os-ai-frontend-backend-beryl.vercel.app`).

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 📧 Contact

For questions or feedback, feel free to reach out or open an issue on GitHub.
