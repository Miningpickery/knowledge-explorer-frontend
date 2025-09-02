export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  created_at: string;
  updated_at: string;
}

export interface AdminPermission {
  id: number;
  admin_id: number;
  permissions: string[];
  created_at: string;
}

export interface DatabaseStats {
  connection: {
    status: string;
    timestamp: string;
    version: string;
  };
  tables: {
    [key: string]: boolean;
  };
  recordCounts: {
    [key: string]: number;
  };
  sampleData: {
    users: any[];
    chats: any[];
    messages: any[];
    memories: any[];
  };
}

export interface SystemHealth {
  database: DatabaseStats;
  api: {
    status: string;
    responseTime: number;
    uptime: number;
  };
  frontend: {
    status: string;
    version: string;
  };
}
