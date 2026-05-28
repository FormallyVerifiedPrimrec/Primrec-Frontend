import { useState } from "react";
import type { Challenge } from "./types";

interface CreateChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (challenge: Omit<Challenge, "id" | "votes" | "createdAt">) => void;
}

export function CreateChallengeModal({
  isOpen,
  onClose,
  onCreate,
}: CreateChallengeModalProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPostcondition, setNewPostcondition] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!newTitle || !newDescription) return;

    onCreate({
      title: newTitle,
      description: newDescription,
      postcondition: newPostcondition,
      templateFunc: "// Write your code here\n",
      testCases: [],
    });

    // Reset and close
    setNewTitle("");
    setNewDescription("");
    setNewPostcondition("");
    onClose();
  };

  return (
    <div className="modalOverlay">
      <div className="modal">
        <h2>Create New Challenge</h2>
        <div className="modalField">
          <label>Challenge Name</label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g., Square of a number"
          />
        </div>
        <div className="modalField">
          <label>Description / Message</label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe what the user should implement..."
            rows={4}
          />
        </div>
        <div className="modalField">
          <label>Postcondition</label>
          <input
            type="text"
            value={newPostcondition}
            onChange={(e) => setNewPostcondition(e.target.value)}
            placeholder="e.g., f(x) = x * x"
          />
        </div>
        <div className="modalActions">
          <button className="cancelBtn" onClick={onClose}>
            Cancel
          </button>
          <button className="saveBtn" onClick={handleSubmit}>
            Create Challenge
          </button>
        </div>
      </div>
    </div>
  );
}
