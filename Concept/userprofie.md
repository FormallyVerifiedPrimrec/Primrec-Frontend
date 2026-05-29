# User Profiles and Challenge Rework - Implementation Split

Based on the conceptual requirements and the existing `user_interactions` table, here is the technical breakdown of what needs to happen in the Backend (Supabase/Custom API) vs. the Frontend (React Application).

---

## 🛠️ Backend Changes (Supabase & Custom API)

### 1. User Profiles
*   **Database (Supabase):**
    *   Ensure the `profiles` table has columns for `name` and `avatar_url` (or `profile_picture`).
*   **Custom API:**
    *   `GET /api/users/me` - Fetch the current user's profile data.
    *   `PATCH /api/users/me` - Endpoint to update `name` and `avatar_url`.

### 2. Immutable Submissions
*   **Database (Supabase):**
    *   *Note: We can use the existing `best_submission_source` column in the `user_interactions` table.*
    *   **Rule Enforcement (RLS/Triggers):** Create a trigger or RLS policy that **prevents updates** to `best_submission_source` if it is already not null. This enforces the "cannot change or resubmit" rule.
*   **Custom API:**
    *   Update `POST /api/challenges/:id/submission`: 
        *   If `success` is true, save the `source` code to `best_submission_source`.
        *   If the user already `has_solved = true`, reject the request (403 Forbidden) to prevent overwriting.

### 3. Community Solutions & Avatars
*   **Custom API:**
    *   Update `GET /api/challenges`: 
        *   Return the avatars/profile pictures of the last ~3 users who solved it by joining `user_interactions` (where `has_solved = true`) with the `profiles` table.
    *   New Endpoint `GET /api/challenges/:id/solutions`: 
        *   Return a list of `best_submission_source` and user profiles for everyone who solved the challenge.
        *   **Security:** This API *must* check if the requesting user has `has_solved = true` for this challenge (or is the host) before returning the data. If not, return 403 Forbidden.

---

## 💻 Frontend Changes (React)

### 1. User Profiles Component
*   **UI Components:**
    *   Create a `UserProfile.tsx` component (accessible via a new modal or a dedicated `/profile` route).
    *   Form fields for editing Name and Profile Picture URL.
    *   Display the user's avatar in the `AppHeader` next to the "Logout" button.
*   **State/API Integration:**
    *   Create functions in `api/challengesApi.ts` (or a new `usersApi.ts`) to fetch and update the profile.

### 2. Challenge Submissions
*   **State/API Integration:**
    *   Update `saveSubmission` in `api/challengesApi.ts` to ensure the `source` code is sent to the backend when a user successfully verifies a challenge.
*   **Editor UI (`EditorPane.tsx`):**
    *   If the user has already solved the challenge, **disable the Editor** (make it read-only) or disable the "Submit" button, showing a message: "You have already submitted your solution."

### 3. Dashboard UI (`Dashboard.tsx` & `ChallengeCard.tsx`)
*   **Card Updates:**
    *   Use CSS `line-clamp` on the challenge description to show only a small part of it.
    *   Display the small avatar circles (fetched from the updated `GET /api/challenges` endpoint) of recent solvers on the card.
*   **Navigation Logic:**
    *   Currently, clicking a card goes to `/editor/:id`. This logic remains, but the destination UI will change based on solve status.

### 4. Community Solutions View (`ToolsSidebar.tsx` / `ChallengeDetails.tsx`)
*   **UI Components:**
    *   When the user is in the Editor for a specific challenge:
        *   **If NOT solved:** Show the full description (already happening).
        *   **If SOLVED:** Add a new tab or section in the sidebar called **"Community Solutions"**.
*   **State/API Integration:**
    *   If `currentChallenge` is loaded and the user has solved it, fetch `GET /api/challenges/:id/solutions`.
    *   Render a list of solutions showing the user's name, avatar, and a read-only Monaco editor (or formatted code block) displaying their submitted code.