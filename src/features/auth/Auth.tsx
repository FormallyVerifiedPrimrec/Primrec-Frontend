import { useState } from 'react';
import { supabase } from '../../supabaseClient';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authContainer" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'var(--bg)' 
    }}>
      <form className="modal" onSubmit={handleAuth} style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center' }}>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        
        {error && (
          <div style={{ color: 'var(--danger)', padding: '10px', background: 'var(--danger-bg)', borderRadius: '8px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {isSignUp && (
          <div className="modalField">
            <label>Username</label>
            <input
              type="text"
              placeholder="Your public name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        )}

        <div className="modalField">
          <label>Email</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="modalField">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="saveBtn" type="submit" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            type="button"
            className="backBtn" 
            style={{ margin: 0, fontWeight: 'bold' }}
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </form>
    </div>
  );
}
