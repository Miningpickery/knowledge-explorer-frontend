// ============================================================================
// DATA SYNC SERVICE - 데이터 일관성 및 동기화 관리
// ============================================================================

import { errorHandler, handleApiCall, handleResponse } from './errorHandler';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingChanges: number;
  syncErrors: string[];
}

export interface SyncConfig {
  autoSync: boolean;
  syncInterval: number; // milliseconds
  retryOnFailure: boolean;
  batchSize: number;
}

export class DataSyncService {
  private static instance: DataSyncService;
  private syncStatus: SyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    syncErrors: []
  };

  private config: SyncConfig = {
    autoSync: true,
    syncInterval: 120000, // 2분으로 증가 (30초 → 2분)
    retryOnFailure: true,
    batchSize: 50
  };

  private syncTimer: NodeJS.Timeout | null = null;
  private pendingOperations: Array<() => Promise<void>> = [];

  private constructor() {
    this.initializeAutoSync();
  }

  static getInstance(): DataSyncService {
    if (!DataSyncService.instance) {
      DataSyncService.instance = new DataSyncService();
    }
    return DataSyncService.instance;
  }

  // 자동 동기화 초기화
  private initializeAutoSync(): void {
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  // 자동 동기화 시작
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);

    console.log('Auto sync started');
  }

  // 자동 동기화 중지
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    console.log('Auto sync stopped');
  }

  // 동기화 상태 조회
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  // 설정 업데이트
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  // 동기화 수행
  async performSync(): Promise<void> {
    if (this.syncStatus.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.syncStatus.isSyncing = true;
    this.syncStatus.syncErrors = [];

    try {
      console.log('Starting data sync...');
      
      // 대기 중인 작업들 처리
      await this.processPendingOperations();
      
      // 로컬 스토리지와 서버 데이터 동기화
      await this.syncLocalWithServer();
      
      this.syncStatus.lastSyncTime = new Date().toISOString();
      this.syncStatus.pendingChanges = 0;
      
      console.log('Data sync completed successfully');
    } catch (error) {
      console.error('Data sync failed:', error);
      this.syncStatus.syncErrors.push(error instanceof Error ? error.message : 'Unknown error');
      
      if (this.config.retryOnFailure) {
        // 재시도 로직 - Rate Limiting 방지를 위해 더 긴 간격으로 재시도
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const retryDelay = errorMessage.includes('429') || errorMessage.includes('Too Many Requests') 
          ? 30000 // Rate Limiting 시 30초 대기
          : 10000; // 일반 오류 시 10초 대기
        setTimeout(() => this.performSync(), retryDelay);
      }
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  // 대기 중인 작업들 처리
  private async processPendingOperations(): Promise<void> {
    if (this.pendingOperations.length === 0) return;

    console.log(`Processing ${this.pendingOperations.length} pending operations...`);

    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        console.error('Failed to process pending operation:', error);
        // 실패한 작업은 다시 큐에 추가
        this.pendingOperations.push(operation);
      }
    }
  }

  // 로컬 스토리지와 서버 동기화
  private async syncLocalWithServer(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      // 인증되지 않은 사용자는 로컬 스토리지만 사용
      return;
    }

    // 마지막 동기화 시간 확인 - 너무 자주 동기화하지 않도록 제한
    const lastSync = this.syncStatus.lastSyncTime;
    const now = new Date();
    if (lastSync) {
      const timeSinceLastSync = now.getTime() - new Date(lastSync).getTime();
      if (timeSinceLastSync < 60000) { // 1분 이내에 동기화한 경우 스킵
        console.log('Skipping sync - too soon since last sync');
        return;
      }
    }

    try {
      // 서버에서 최신 데이터 가져오기
      const serverData = await this.fetchServerData(token);
      
      // 로컬 데이터와 비교하여 동기화
      await this.mergeData(serverData);
      
    } catch (error) {
      console.error('Failed to sync with server:', error);
      throw error;
    }
  }

  // 서버 데이터 가져오기
  private async fetchServerData(token: string): Promise<any> {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const response = await handleApiCall(
      () => fetch(`${baseUrl}/api/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }),
      'fetchServerData'
    );

    return handleResponse(response, 'fetchServerData');
  }

  // 데이터 병합
  private async mergeData(serverData: any): Promise<void> {
    const localData = this.getLocalData();
    
    // 서버 데이터가 더 최신인 경우 로컬 업데이트
    if (serverData.updated_at > localData.updated_at) {
      this.updateLocalData(serverData);
    }
    
    // 로컬에만 있는 변경사항이 있으면 서버에 전송
    if (localData.hasLocalChanges) {
      await this.pushLocalChanges();
    }
  }

  // 로컬 데이터 가져오기
  private getLocalData(): any {
    const localChats = localStorage.getItem('anonymous_chats');
    return localChats ? JSON.parse(localChats) : [];
  }

  // 로컬 데이터 업데이트
  private updateLocalData(data: any): void {
    localStorage.setItem('anonymous_chats', JSON.stringify(data));
  }

  // 로컬 변경사항 서버에 전송
  private async pushLocalChanges(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const localChanges = this.getLocalChanges();

    for (const change of localChanges) {
      try {
        await handleApiCall(
          () => fetch(`${baseUrl}/api/chats/${change.chatId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(change.data)
          }),
          'pushLocalChanges'
        );
      } catch (error) {
        console.error('Failed to push local change:', error);
        // 실패한 변경사항은 다시 큐에 추가
        this.addPendingOperation(() => this.pushLocalChanges());
      }
    }
  }

  // 로컬 변경사항 감지
  private getLocalChanges(): any[] {
    // 실제 구현에서는 변경사항 추적 로직 필요
    return [];
  }

  // 대기 중인 작업 추가
  addPendingOperation(operation: () => Promise<void>): void {
    this.pendingOperations.push(operation);
    this.syncStatus.pendingChanges = this.pendingOperations.length;
  }

  // 강제 동기화
  async forceSync(): Promise<void> {
    console.log('Force sync requested');
    await this.performSync();
  }

  // 동기화 상태 리셋
  resetSyncStatus(): void {
    this.syncStatus = {
      isSyncing: false,
      lastSyncTime: null,
      pendingChanges: 0,
      syncErrors: []
    };
  }

  // 서비스 정리
  cleanup(): void {
    this.stopAutoSync();
    this.resetSyncStatus();
    this.pendingOperations = [];
  }
}

// 편의 함수들
export const dataSyncService = DataSyncService.getInstance();

// 자동 동기화 시작/중지 훅
export const useAutoSync = (enabled: boolean = true) => {
  if (enabled) {
    dataSyncService.startAutoSync();
  } else {
    dataSyncService.stopAutoSync();
  }
};

// 동기화 상태 훅
export const useSyncStatus = () => {
  return dataSyncService.getSyncStatus();
};
