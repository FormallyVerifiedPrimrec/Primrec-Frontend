# Primrec Verification Platform Concept

## 🛑 Core Problems

- Users must be able to provide a **postcondition** for every function they define.
- **Challenge Creation:** Creators need to define postconditions for every sub-function to ensure a solvable proof path.

---

## 💡 Proposed Solution

### 🖥️ Editor & Language

- **In-code Postconditions:** Postconditions are written directly within the source code using the dedicated postcondition language (by Christoph).
- **Pruned Submission:** Only the functions actually utilized in the solution are sent to the backend, along with their corresponding postconditions.
  - sending one by one see verification
  - show the point where verification flow failed

### 🏆 Challenge Lifecycle

#### 1. Creation

- **Editor Repurposing:** Use the standard editor to define the logic and required postconditions for each sub-function.
  - add a Field for name and description
  - **Entry Function:** Specify the target function for which the user must satisfy a given postcondition.
- **Storing:**
- Entry function with its postcondition is stored -> so it can be given to the challenge solvers as their goal
- Code and postconditions are used to verify challenge validity during creation; they are not strictly required to be stored as "correct" solutions later.
- **Verification:**
  - when clicking on create challenge ther must be a postcondition for every function and the entry function must verify and there for all the "lower" functions as well
  - verification feedback as normal editor
  - when the verification fails the user has to change the code until it verifies successfully

#### 2. Submitting

- **Challenge Setup:** When a user enters a challenge, the target function and its official postcondition are automatically pasted into the editor.
- **Security:** The server-side postcondition for the entry function is used during final verification to prevent client-side manipulation.
- **User Assistance:**
  - Users can add their own postconditions for helper functions to simplify the verification process.
  - **Integrity Check:** The system verifies if the required challenge function or its postcondition has been deleted or modified.
  - **UI Feedback:** Show error messages for missing required components with a "Re-add" button to restore the original challenge block.
- **History:** user can see in the overviwe if he successfully solved a challenge

---

## 🔬 Verification Workflow

### 📤 Sending (Frontend to Backend)

- **Logic Translation:** Code is translated into a logic formula (by the frontend) before transmission.
- **Contract-Based:** Each function is sent with its postcondition. If no postcondition is provided, the backend attempts to verify the function using automated inference.
- **Error Handling:** If verification exceeds a reasonable time limit, a **Timeout Error** is displayed to the user.

### 📥 Receiving (Backend to Frontend)

- **Status Indicators:**
  - ✅ **Green Checkmark:** Displayed in the Verify Panel next to every satisfied (SAT) function.
  - ❌ **Red X:** Displayed for functions that cannot be verified.
  - **Gray Questionmark:** Functions with Unknown postconditions
  - **Red Questionmark:** Functions that cannot be verified due to a dependent function not being able to verify
- **Visual Feedback:**
  - **Semantic Highlighting:** Functions with unsatisfiable postconditions are underlined in the editor (using a non-error color, like orange or blue).
  - **Counter-Examples:** Display the specific counter-example provided by **Eldarica** to help users debug their logic.
