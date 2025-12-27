import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  feishu_user_id?: string;
  name: string;
  avatar?: string;
  email?: string;
  department?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 初始化时从 localStorage 读取用户信息
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // 超级管理员飞书 ID 列表（环境变量配置）
  // 注意：user.id 就是飞书的 open_id，user.feishu_user_id 是可选的兼容字段
  const superAdminIds = (import.meta.env.VITE_SUPER_ADMIN_FEISHU_IDS || '').split(',').filter(Boolean);
  const userFeishuId = user?.feishu_user_id || user?.id;
  const isSuperAdmin = !!userFeishuId && superAdminIds.includes(userFeishuId);

  // 调试日志
  console.log('🔑 权限检查:', { userFeishuId, superAdminIds, isSuperAdmin });

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isSuperAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
