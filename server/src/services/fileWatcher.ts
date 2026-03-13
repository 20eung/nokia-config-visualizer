/**
 * File Watcher 서비스
 *
 * 지정된 폴더 내 *.txt 파일을 감시하고 변경 이벤트를 발생시킵니다.
 * hostname별 최신 파일만 필터링하여 제공합니다.
 */

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import {
  parseConfigFilename,
  getLatestConfigFiles,
  groupConfigFiles,
  type ParsedConfigFile,
  type ConfigFileGroup
} from '../utils/configFilenameParser';
import {
  detectVendor,
  readFirstLines,
  type VendorType
} from './vendorDetector';

/**
 * File Watcher 이벤트 타입
 */
export type FileWatcherEvent = 'file-added' | 'file-changed' | 'file-deleted' | 'file-list-updated';

/**
 * File Watcher 이벤트 데이터
 */
export interface FileWatcherEventData {
  type: FileWatcherEvent;
  filename: string;
  path: string;
  vendor?: VendorType; // Vendor 정보 추가
  timestamp: number;
  latestFiles?: string[]; // 최신 파일 목록 (file-list-updated 이벤트에서 사용)
}

/**
 * Watch 옵션
 */
export interface WatchOptions {
  recursive?: boolean;            // 재귀 감시 여부
  vendor?: VendorType | 'all';    // Vendor 필터
  depth?: number;                 // 최대 깊이
}

/**
 * File Watcher 에러 데이터
 */
export interface FileWatcherErrorData {
  type: 'file-too-large' | 'watcher-error' | 'permission-denied';
  filename?: string;
  path?: string;
  error: string;
}

/**
 * File Watcher 서비스 클래스
 */
export class FileWatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private watchPath: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private allFiles: Set<string> = new Set(); // 모든 파일 목록 추적
  private filePathMap: Map<string, string> = new Map(); // 파일명 → 전체 경로 매핑
  private watchMode: 'flat' | 'recursive' = 'flat';
  private vendorFilter: VendorType | 'all' = 'all';
  private maxDepth: number = 5;

  constructor(watchPath: string = '/app/configs') {
    super();
    this.watchPath = watchPath;
  }

  /**
   * 파일 감시 시작 (재귀 + vendor 필터 지원)
   */
  startWatching(watchPath?: string, options?: WatchOptions): void {
    if (watchPath) {
      this.watchPath = watchPath;
    }

    this.watchMode = options?.recursive ? 'recursive' : 'flat';
    this.vendorFilter = options?.vendor ?? 'all';
    this.maxDepth = options?.depth ?? 5;

    // 기존 watcher 중지
    if (this.watcher) {
      this.stopWatching();
    }

    console.log(`[FileWatcher] Starting (mode=${this.watchMode}, vendor=${this.vendorFilter}, depth=${this.maxDepth})`);

    // Watch pattern 설정
    const watchPattern = this.watchMode === 'recursive'
      ? `${this.watchPath}/**/*.txt`   // 재귀
      : `${this.watchPath}/*.txt`;     // 단일 레벨

    // chokidar 설정
    this.watcher = chokidar.watch(watchPattern, {
      persistent: true,
      ignoreInitial: false, // 초기 파일들도 감지
      awaitWriteFinish: {
        stabilityThreshold: 1000, // 1초 동안 변경 없으면 완료
        pollInterval: 100 // 100ms마다 체크
      },
      depth: this.watchMode === 'recursive' ? this.maxDepth : 0,
      ignored: /(^|[\/\\])\../  // 숨김 파일 제외
    });

    // 이벤트 리스너 등록
    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileDelete(filePath))
      .on('error', (error) => this.handleError(error as Error));

    console.log(`[FileWatcher] Watch started successfully`);
  }

  /**
   * 파일 감시 중지
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.allFiles.clear();
      this.filePathMap.clear();
      console.log('[FileWatcher] Stopped watching');
    }
  }

  /**
   * 파일 목록을 수동으로 추가 (초기 스캔 결과 반영용)
   */
  async addFilesManually(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      await this.handleFileAdd(filePath);
    }
  }

  /**
   * 현재 파일 목록 조회 (모든 파일)
   * allFiles Set에서 파일명 목록을 반환 (recursive 모드 지원)
   */
  async getAllFiles(): Promise<string[]> {
    return Array.from(this.allFiles).sort();
  }

  /**
   * 최신 파일 목록 조회 (hostname별 최신 파일만)
   */
  async getLatestFiles(): Promise<string[]> {
    const allFiles = await this.getAllFiles();
    return getLatestConfigFiles(allFiles);
  }

  /**
   * 파일 그룹 정보 조회
   */
  async getFileGroups(): Promise<ConfigFileGroup[]> {
    const allFiles = await this.getAllFiles();
    return groupConfigFiles(allFiles);
  }

  /**
   * 파일 크기 체크
   */
  private async checkFileSize(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        console.warn(
          `[FileWatcher] File too large: ${filePath} (${stats.size} bytes > ${this.maxFileSize} bytes)`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error(`[FileWatcher] Error checking file size: ${filePath}`, error);
      return false;
    }
  }

  /**
   * 파일 추가 이벤트 핸들러 (Vendor 검출 추가)
   */
  private async handleFileAdd(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const isValid = await this.checkFileSize(filePath);

    if (!isValid) {
      this.emit('error', {
        type: 'file-too-large',
        filename,
        path: filePath,
        error: `File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`
      } as FileWatcherErrorData);
      return;
    }

    // ===== Vendor 검출 로직 추가 =====
    const firstLines = await readFirstLines(filePath, 10);
    const detection = detectVendor(firstLines);

    // Vendor 필터링
    if (this.vendorFilter !== 'all' && detection.vendor !== this.vendorFilter) {
      console.log(`[FileWatcher] Skipped ${detection.vendor} file: ${filename}`);
      return;
    }
    // ================================

    // 파일 목록에 추가
    this.allFiles.add(filename);
    // 파일명 → 전체 경로 매핑 저장
    this.filePathMap.set(filename, filePath);

    // 개별 파일 추가 이벤트 (Vendor 정보 포함)
    this.emit('file-added', {
      type: 'file-added',
      filename,
      path: filePath,
      vendor: detection.vendor,
      timestamp: Date.now()
    } as FileWatcherEventData);

    // 최신 파일 목록 업데이트 이벤트
    await this.emitFileListUpdate();

    console.log(`[FileWatcher] File added (${detection.vendor}): ${filename}`);
  }

  /**
   * 파일 변경 이벤트 핸들러
   */
  private async handleFileChange(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const isValid = await this.checkFileSize(filePath);

    if (!isValid) {
      this.emit('error', {
        type: 'file-too-large',
        filename,
        path: filePath,
        error: `File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`
      } as FileWatcherErrorData);
      return;
    }

    // 개별 파일 변경 이벤트
    this.emit('file-changed', {
      type: 'file-changed',
      filename,
      path: filePath,
      timestamp: Date.now()
    } as FileWatcherEventData);

    // 최신 파일 목록 업데이트 이벤트 (날짜가 바뀌었을 수도 있으므로)
    await this.emitFileListUpdate();

    console.log(`[FileWatcher] File changed: ${filename}`);
  }

  /**
   * 파일 삭제 이벤트 핸들러
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    const filename = path.basename(filePath);

    // 파일 목록에서 제거
    this.allFiles.delete(filename);
    this.filePathMap.delete(filename);

    // 개별 파일 삭제 이벤트
    this.emit('file-deleted', {
      type: 'file-deleted',
      filename,
      path: filePath,
      timestamp: Date.now()
    } as FileWatcherEventData);

    // 최신 파일 목록 업데이트 이벤트
    await this.emitFileListUpdate();

    console.log(`[FileWatcher] File deleted: ${filename}`);
  }

  /**
   * 최신 파일 목록 업데이트 이벤트 발생
   */
  private async emitFileListUpdate(): Promise<void> {
    const latestFiles = await this.getLatestFiles();

    this.emit('file-list-updated', {
      type: 'file-list-updated',
      filename: '', // N/A
      path: this.watchPath,
      timestamp: Date.now(),
      latestFiles
    } as FileWatcherEventData);
  }

  /**
   * 에러 핸들러
   */
  private handleError(error: Error): void {
    console.error('[FileWatcher] Error:', error);
    this.emit('error', {
      type: 'watcher-error',
      error: error.message
    } as FileWatcherErrorData);
  }

  /**
   * Watch 경로 변경
   */
  setWatchPath(path: string): void {
    this.watchPath = path;
    if (this.watcher) {
      // 재시작
      this.startWatching();
    }
  }

  /**
   * 현재 감시 중인 경로 반환
   */
  getWatchPath(): string {
    return this.watchPath;
  }

  /**
   * 파일명으로 전체 경로 조회
   */
  getFilePath(filename: string): string | undefined {
    return this.filePathMap.get(filename);
  }

  /**
   * 감시 중 여부
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }

  /**
   * 최대 파일 크기 설정
   */
  setMaxFileSize(size: number): void {
    this.maxFileSize = size;
  }

  /**
   * 최대 파일 크기 조회
   */
  getMaxFileSize(): number {
    return this.maxFileSize;
  }
}

// 싱글톤 인스턴스
export const fileWatcher = new FileWatcherService();
