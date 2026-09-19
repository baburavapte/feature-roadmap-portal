# Feature Request & Public Roadmap Portal

A robust, full-stack MERN (MongoDB, Express, React, Node.js) application for collecting, discussing, and managing community feature requests. It includes a public kanban-style roadmap to communicate product direction with users.

## Main Features
- **Authentication & Security:** Dual-token JWT architecture (short-lived access token, httpOnly refresh token) with complete signup, login, email verification, and password reset flows.
- **Feature Requests:** Create, upvote, and track feature requests. Includes advanced server-side pagination, sorting (newest, most upvoted, discussed), and debounced search.
- **Discussion Threads:** Nested, threaded comments with Markdown support, allowing users to deeply discuss features. Supports soft-deletion for orphaned threads.
- **Public Roadmap:** A responsive, 3-column Kanban-style public roadmap (Under Review, Planned, In Progress) synchronized securely with backend statuses.
- **Role-Based Access Control (RBAC):** Admin users can manage feature statuses and moderate comments. Normal users can only edit/delete their own features and comments.

## Technology Stack
- **Frontend:** React, React Router, Vite, Vanilla CSS
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Security:** JSON Web Tokens (JWT), bcryptjs, DOMPurify, Marked

## Project Architecture
The repository is split into two primary packages:
- `/frontend`: The Vite-powered React client application.
- `/backend`: The Node.js/Express API server.

## Local Setup Instructions

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB running locally or a MongoDB Atlas URI

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in the required values.
   ```bash
   cp .env.example .env
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend will typically run on `http://localhost:5000`.

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Copy `.env.example` to `.env` and configure your API URL.
   ```bash
   cp .env.example .env
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The frontend will typically run on `http://localhost:5173`.

### 3. Running Verification Tests
The backend includes automated verification scripts to validate the integrity of core functionalities (comments, routing, RBAC, etc.). From the `/backend` directory, run:
```bash
node scripts/verify_task5.mjs
node scripts/verify_task6.mjs
```
- `verify_task5.mjs`: Validates authentication, atomic voting, and hierarchical threaded comments.
- `verify_task6.mjs`: Validates the public roadmap endpoint filtering, privacy strips (voters), and admin-only status modification.

## Documentation
Comprehensive API documentation detailing all endpoints, parameters, responses, and security implementations can be found in [API.md](./API.md).

## Environment Variables
Ensure `.env` files are created in both `/frontend` and `/backend` based on their respective `.env.example` files. **Never commit real credentials, secrets, or passwords to Git.**

## Security Overview
This project strictly enforces data sanitization and authorization boundaries. Sensitive user information (e.g., the array of user IDs who voted on a feature) is stripped at the controller level before being returned to the client. Write access to feature statuses and global comment moderation is strictly gated behind the `admin` role middleware. 

## Roadmap Overview
The application handles Feature Request states seamlessly via the `FeatureRequest.status` field. The public `/roadmap` route fetches features explicitly categorized as `Under Review`, `Planned`, or `In Progress`, keeping the UI perfectly in sync with the database without duplicating tracking models. Completed features remain completely accessible in the general feed and direct links for historical continuity.
