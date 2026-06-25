import React, { useState } from 'react';
import { LogIn, User, Lock } from 'lucide-react';
import { tryLogin } from '../lib/auth';

interface LoginScreenProps {
  onSuccess: () => void;
}

/* 应用内登录页（软门）。登录成功后调用 onSuccess。 */
export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState(false);

  const submit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (tryLogin(user, pass)) onSuccess();
    else setErr(true);
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ fontSize: 23, justifyContent: 'center' }}>
          考研词关<span className="dot"> · </span>WordQuest
        </div>
        <div className="label center" style={{ marginTop: 6 }}>请登录后使用</div>

        <div className="login-field mt16">
          <User size={16} className="muted" />
          <input
            className="login-input"
            placeholder="用户名"
            value={user}
            onChange={(e) => { setUser(e.target.value); setErr(false); }}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            autoFocus
          />
        </div>
        <div className="login-field mt12">
          <Lock size={16} className="muted" />
          <input
            className="login-input"
            type="password"
            placeholder="密码"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(false); }}
            autoComplete="current-password"
          />
        </div>

        {err && (
          <div className="label center mt12" style={{ color: 'var(--bad)' }} role="alert">
            用户名或密码不正确
          </div>
        )}

        <button type="submit" className="btn primary block mt16">
          <LogIn size={17} /> 登录
        </button>
      </form>
    </div>
  );
}
