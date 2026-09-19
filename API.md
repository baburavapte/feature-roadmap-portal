# API Documentation

This document describes the backend API for the Feature Request & Public Roadmap Portal. The base URL for all endpoints is `/api`.

## Authentication & Security

The API uses a dual-token JWT authentication model:
- **Access Token:** Short-lived token returned in the login/refresh response body. Must be included in the `Authorization` header as `Bearer <token>` for protected routes.
- **Refresh Token:** Long-lived token sent as an `httpOnly` cookie. Used to obtain new access tokens.

### Security Policies
- **Role-Based Access Control (RBAC):** Normal users cannot change feature statuses. Admin-only endpoints require the `admin` role.
- **Voter Privacy:** Voter information (arrays of user IDs) is stripped from feature payloads before being returned to the client to prevent exposing sensitive data.
- **Atomic Voting:** Voting toggles use atomic MongoDB operations to prevent race conditions and duplicate voting.
- **Comment Ownership:** Users can only edit or delete their own comments. Admins have overarching permissions to delete any comment.

---

## 1. Auth Endpoints

### Signup
- **Method:** `POST`
- **Route:** `/auth/signup`
- **Auth Required:** No
- **Request Body:** `{ "name": "...", "email": "...", "password": "...", "confirmPassword": "..." }`
- **Success Response:** `201 Created` with a simulated `verifyEmailUrl` in data.
- **Description:** Registers a new user.

### Verify Email
- **Method:** `POST`
- **Route:** `/auth/verify-email/:token`
- **Auth Required:** No
- **Path Parameters:** `token` (verification token)
- **Success Response:** `200 OK`
- **Description:** Verifies a user's email address using the provided token.

### Login
- **Method:** `POST`
- **Route:** `/auth/login`
- **Auth Required:** No
- **Request Body:** `{ "email": "...", "password": "..." }`
- **Success Response:** `200 OK` with `accessToken` in body and `refreshToken` in `httpOnly` cookie.
- **Error Response:** `401 Unauthorized` for invalid credentials.
- **Description:** Authenticates a user and returns tokens.

### Refresh Token
- **Method:** `POST`
- **Route:** `/auth/refresh`
- **Auth Required:** No (requires valid `httpOnly` refresh cookie)
- **Success Response:** `200 OK` with a new `accessToken`.
- **Description:** Rotates the access token using a valid refresh token.

### Logout
- **Method:** `POST`
- **Route:** `/auth/logout`
- **Auth Required:** No
- **Success Response:** `200 OK` (clears cookies)
- **Description:** Logs the user out by invalidating the refresh token cookie.

### Get Current User (Me)
- **Method:** `GET`
- **Route:** `/auth/me`
- **Auth Required:** Yes
- **Success Response:** `200 OK` with user details.
- **Description:** Returns the currently authenticated user's profile.

### Forgot Password
- **Method:** `POST`
- **Route:** `/auth/forgot-password`
- **Auth Required:** No
- **Request Body:** `{ "email": "..." }`
- **Success Response:** `200 OK`
- **Description:** Initiates the password reset flow.

### Reset Password
- **Method:** `POST`
- **Route:** `/auth/reset-password/:token`
- **Auth Required:** No
- **Path Parameters:** `token`
- **Request Body:** `{ "password": "..." }`
- **Success Response:** `200 OK`
- **Description:** Resets the password using a valid reset token.

---

## 2. Feature Requests

### Status & Category Values
- **Categories:** `UI/UX`, `Integrations`, `Performance`, `General`
- **Statuses:** `Under Review`, `Planned`, `In Progress`, `Completed`

### List / Feed Features
- **Method:** `GET`
- **Route:** `/features`
- **Auth Required:** Optional (if provided, computes `hasVoted` for the user)
- **Query Parameters:** 
  - `status` (filter by status)
  - `category` (filter by category)
  - `search` (text search on title/description)
  - `sort` (`newest`, `upvoted`, `discussed`)
  - `page` & `limit` for pagination
- **Success Response:** `200 OK` with `features` array and `pagination` metadata.
- **Description:** Retrieves a paginated, filterable list of feature requests.

### Get Feature by ID
- **Method:** `GET`
- **Route:** `/features/:id`
- **Auth Required:** Optional
- **Path Parameters:** `id`
- **Success Response:** `200 OK` with `feature` object.
- **Error Response:** `404 Not Found` if feature does not exist.
- **Description:** Retrieves a single feature request by its ID.

### Create Feature
- **Method:** `POST`
- **Route:** `/features`
- **Auth Required:** Yes
- **Request Body:** `{ "title": "...", "description": "...", "category": "..." }`
- **Success Response:** `201 Created`
- **Description:** Creates a new feature request. Status defaults to `Under Review`.

### Update Feature
- **Method:** `PATCH`
- **Route:** `/features/:id`
- **Auth Required:** Yes (must be author or admin)
- **Path Parameters:** `id`
- **Request Body:** Fields to update (e.g., `title`, `description`, `category`)
- **Success Response:** `200 OK`
- **Description:** Updates the details of a feature request.

### Toggle Vote
- **Method:** `POST`
- **Route:** `/features/:id/vote`
- **Auth Required:** Yes
- **Path Parameters:** `id`
- **Success Response:** `200 OK` with `voteCount` and `voted` boolean.
- **Description:** Toggles the authenticated user's vote on a feature.

### Update Status (Admin Only)
- **Method:** `PATCH`
- **Route:** `/features/:id/status`
- **Auth Required:** Yes
- **Role Required:** `admin`
- **Path Parameters:** `id`
- **Request Body:** `{ "status": "..." }`
- **Success Response:** `200 OK`
- **Error Response:** `403 Forbidden` if user is not an admin.
- **Description:** Updates the workflow status of a feature request.

---

## 3. Comments

### List Comments for Feature
- **Method:** `GET`
- **Route:** `/features/:id/comments`
- **Auth Required:** Optional
- **Path Parameters:** `id` (Feature ID)
- **Success Response:** `200 OK` with `comments` array.
- **Description:** Retrieves all comments associated with a specific feature.

### Create Comment
- **Method:** `POST`
- **Route:** `/features/:id/comments`
- **Auth Required:** Yes
- **Path Parameters:** `id` (Feature ID)
- **Request Body:** `{ "content": "...", "parentComment": "<optional_id>" }`
- **Success Response:** `201 Created`
- **Description:** Adds a new comment to a feature. Can be a top-level comment or a reply to an existing `parentComment`.

### Edit Comment
- **Method:** `PATCH`
- **Route:** `/comments/:id`
- **Auth Required:** Yes (must be author)
- **Path Parameters:** `id` (Comment ID)
- **Request Body:** `{ "content": "..." }`
- **Success Response:** `200 OK`
- **Description:** Edits the content of an existing comment.

### Delete Comment
- **Method:** `DELETE`
- **Route:** `/comments/:id`
- **Auth Required:** Yes (must be author or admin)
- **Path Parameters:** `id` (Comment ID)
- **Success Response:** `200 OK`
- **Description:** Soft-deletes a comment. If it has replies, its content is replaced with a deletion placeholder to preserve thread structure.

---

## 4. System / Health

### Health Check
- **Method:** `GET`
- **Route:** `/health`
- **Auth Required:** No
- **Success Response:** `200 OK` with status payload.
- **Description:** Endpoint to verify API uptime and responsiveness.
