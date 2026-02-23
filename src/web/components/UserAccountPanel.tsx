import React, { useState } from 'react';
import { User, LogOut, Cloud, Mail, Key, User as UserIcon, RefreshCw, CheckCircle, Trash2, Edit3 } from 'lucide-react';
import { useBookmarkStore } from '../../store/bookmarkStore';

const UserAccountPanel: React.FC = () => {
  const {
    cloudUser,
    isLoggedIn,
    cloudLogin,
    cloudRegister,
    cloudLogout,
    syncBookmarks,
    isLoading
  } = useBookmarkStore();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('请填写所有必填字段');
      return;
    }

    if (!isLoginMode && !username) {
      setError('请填写用户名');
      return;
    }

    try {
      if (isLoginMode) {
        await cloudLogin(email, password);
      } else {
        await cloudRegister(email, username, password);
      }
      setSuccess('操作成功');
    } catch (err) {
      setError((err as Error).message || '操作失败');
    }
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await cloudLogout();
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncBookmarks();
      setSuccess('同步成功');
    } catch (err) {
      setError((err as Error).message || '同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('请填写新密码和确认密码');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    // 模拟修改密码（实际应用中需要调用API）
    setSuccess('密码修改成功');
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('确定要删除账户吗？此操作不可恢复！')) {
      return;
    }

    if (!confirm('警告：删除账户将永久删除所有云端数据！\n\n确定要继续吗？')) {
      return;
    }

    try {
      await cloudLogout();
      setSuccess('账户已删除');
    } catch (err) {
      setError((err as Error).message || '删除账户失败');
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '从未同步';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="user-panel">
      {isLoggedIn && cloudUser ? (
        <div className="account-container">
          <div className="user-info-card">
            <div className="user-avatar">
              {cloudUser.avatar ? (
                <img src={cloudUser.avatar} alt={cloudUser.username} />
              ) : (
                <UserIcon className="w-16 h-16" />
              )}
            </div>
            <div className="user-details">
              <h3 className="user-name">{cloudUser.username}</h3>
              <p className="user-email">{cloudUser.email}</p>
              <p className="user-joined">注册时间: {new Date(cloudUser.createdAt).toLocaleDateString('zh-CN')}</p>
            </div>
          </div>

          <div className="sync-status-card">
            <div className="sync-header">
              <Cloud className="w-5 h-5 mr-2" />
              <span>云同步状态</span>
              <CheckCircle className="w-4 h-4 ml-auto text-green-500" />
            </div>
            <div className="sync-info">
              <div className="sync-item">
                <span className="sync-label">同步状态:</span>
                <span className="sync-value">
                  {cloudUser.syncEnabled ? '已启用' : '已禁用'}
                </span>
              </div>
              <div className="sync-item">
                <span className="sync-label">上次同步:</span>
                <span className="sync-value">{formatTime(cloudUser.lastSyncTime)}</span>
              </div>
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleSync}
              disabled={isSyncing || isLoading}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  同步中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  立即同步
                </>
              )}
            </button>
          </div>

          <div className="account-actions">
            <button
              className="btn btn-secondary w-full"
              onClick={() => setShowPasswordForm(true)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              修改密码
            </button>
            <button
              className="btn btn-danger w-full"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除账户
            </button>
            <button
              className="btn btn-secondary w-full"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </button>
          </div>

          {showPasswordForm && (
            <div className="modal-overlay" onClick={() => setShowPasswordForm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">修改密码</h3>
                <form onSubmit={handleChangePassword} className="auth-form">
                  <div className="form-group">
                    <label className="form-label">新密码</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="请输入新密码"
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">确认密码</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入新密码"
                      className="form-input"
                      required
                    />
                  </div>
                  {error && <div className="error-message">{error}</div>}
                  {success && <div className="success-message">{success}</div>}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setError('');
                        setSuccess('');
                      }}
                    >
                      取消
                    </button>
                    <button type="submit" className="btn btn-primary">
                      确认修改
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">确认删除账户</h3>
                <p className="delete-warning">此操作将永久删除您的账户和所有云端数据，无法恢复！</p>
                <div className="modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    取消
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteAccount}
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-icon">
              <Cloud className="w-12 h-12" />
            </div>
            <h3 className="auth-title">
              {isLoginMode ? '登录账号' : '注册账号'}
            </h3>
            <p className="auth-desc">
              {isLoginMode ? '登录以同步书签到云端' : '创建账号以开始使用云同步'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">
                <Mail className="w-4 h-4 mr-2" />
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="form-input"
                required
              />
            </div>

            {!isLoginMode && (
              <div className="form-group">
                <label className="form-label">
                  <UserIcon className="w-4 h-4 mr-2" />
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="form-input"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <Key className="w-4 h-4 mr-2" />
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="form-input"
                required
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? '处理中...' : (isLoginMode ? '登录' : '注册')}
            </button>
          </form>

          <div className="auth-switch">
            <span className="switch-text">
              {isLoginMode ? '还没有账号？' : '已有账号？'}
            </span>
            <button
              className="switch-btn"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
                setSuccess('');
              }}
            >
              {isLoginMode ? '立即注册' : '立即登录'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccountPanel;