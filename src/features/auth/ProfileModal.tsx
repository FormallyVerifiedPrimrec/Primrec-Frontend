import { useState, useEffect } from 'react';
import { getCurrentProfile, updateProfile } from '../../api/challengesApi';
import type { User } from '../challenges/types';
import { downscaleImage } from './avatarUtils';

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [avatarData, setAvatarData] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentProfile()
      .then(p => {
        setProfile(p);
        setUsername(p.username);
        setAvatarData(p.avatarData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const downscaled = await downscaleImage(file);
      setAvatarData(downscaled);
    } catch (err) {
      setError('Failed to process image');
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (username.trim().length > 50) {
      setError('Username must be 50 characters or fewer');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateProfile({ username: username.trim(), avatarData });
      onClose();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent profileModal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>Edit Profile</h3>
          <button className="iconBtn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <div className="modalBody">Loading...</div>
        ) : (
          <div className="modalBody">
            {error && <div className="error">{error}</div>}
            
            <div className="formGroup avatarGroup">
              <label>Profile Picture</label>
              <div className="avatarPreviewContainer">
                {avatarData ? (
                  <img src={avatarData} alt="Avatar" className="avatarLarge" />
                ) : (
                  <div className="avatarPlaceholder large">{username[0]?.toUpperCase() ?? '?'}</div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  id="avatarInput" 
                  onChange={handleAvatarChange} 
                  style={{ display: 'none' }}
                />
                <button 
                  className="saveBtn" 
                  onClick={() => document.getElementById('avatarInput')?.click()}
                  style={{ marginTop: '8px' }}
                >
                  Change Photo
                </button>
              </div>
            </div>

            <div className="formGroup">
              <label>Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                className="modalInput"
                maxLength={50}
              />
            </div>

            <div className="statsPreview">
              <div className="statItem">
                <span className="statLabel">Rank Points:</span>
                <span className="statValue"> {profile?.rankPoints ?? 0}</span>
              </div>
            </div>
          </div>
        )}

        <div className="modalFooter">
          <button className="navBtn" onClick={onClose}>Cancel</button>
          <button 
            className="saveBtn" 
            onClick={handleSave} 
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
