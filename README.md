# DropLet 💧

DropLet is a modern, high-performance cloud file storage and management application. Built with a focus on speed, security, and a seamless user experience, DropLet allows users to securely upload, organize, and access their files from anywhere.

## 🚀 Tech Stack

### Frontend
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** CSS / TailwindCSS (or similar UI library)

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js (via tsx)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma

---

## 📂 Project Structure

This is a monorepo setup containing both the client and server applications:

- `/frontend` - The Next.js web application.
- `/backend` - The Node.js API server and Prisma database schemas.

---

## 🛠️ Getting Started

Follow these instructions to set up the project locally for development and testing.

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v20 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) running locally or via Docker
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/rajathvinod/DropLet.git
cd DropLet
```

### 2. Backend Setup
Navigate to the backend directory, install dependencies, and start the development server:

```bash
cd backend
npm install

# Set up your environment variables
# Create a .env file and add your DATABASE_URL

# Push the database schema
npx prisma db push

# Start the server
npm run dev
```
*The backend server will run on http://localhost:8080*

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, install dependencies, and start the development server:

```bash
cd frontend
npm install

# Start the Next.js development server
npm run dev
```
*The frontend application will be available at http://localhost:3000 (or 3001 if 3000 is in use).*

---

## 📝 Environment Variables

You will need to set up `.env` files in both the `frontend` and `backend` directories. 

**Backend (`backend/.env`):**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/droplet?schema=public"
PORT=8080
# Add other secret keys (e.g., JWT_SECRET, AWS_S3_KEYS) here
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL="http://localhost:8080"
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.
