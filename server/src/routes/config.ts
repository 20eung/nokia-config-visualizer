/**
 * Config 파일 관리 API
 *
 * 파일 감시, 파일 목록 조회, 파일 다운로드 엔드포인트를 제공합니다.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileWatcher } from '../services/fileWatcher';
import { scanConfigsRecursive, validatePath } from '../services/recursiveScanner';
import type { VendorType } from '../services/vendorDetector';

const router = express.Router();

/**
 * POST /api/config/watch-folder
 * 폴더 경로 설정 및 감시 시작
 */
router.post('/watch-folder', async (req: Request, res: Response) => {
  try {
    const { path: watchPath } = req.body;

    if (!watchPath) {
      return res.status(400).json({
        success: false,
        error: 'Path is required'
      });
    }

    // 경로 보안 검증
    const resolvedPath = path.resolve(watchPath);
    const allowedPrefixes = ['/app/configs', '/tmp/configs', process.env.WATCH_FOLDER_PATH].filter(Boolean) as string[];

    const isAllowed = allowedPrefixes.some(prefix => resolvedPath.startsWith(path.resolve(prefix)));
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Path is not in the allowed list'
      });
    }

    // 폴더 존재 확인
    try {
      await fs.access(resolvedPath);
      const stats = await fs.lstat(resolvedPath);

      // 심볼릭 링크 차단
      if (stats.isSymbolicLink()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Symbolic links are not allowed'
        });
      }

      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'Path is not a directory'
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Path does not exist or is not accessible'
      });
    }

    // File Watcher 시작
    fileWatcher.startWatching(watchPath);

    res.json({
      success: true,
      watchPath,
      message: 'File watching started successfully'
    });
  } catch (error: any) {
    console.error('[API] Error setting watch folder:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/config/files
 * 현재 파일 목록 조회 (최신 파일만)
 */
router.get('/files', async (req: Request, res: Response) => {
  try {
    const showAll = req.query.all === 'true';

    if (showAll) {
      // 모든 파일 조회
      const files = await fileWatcher.getAllFiles();
      res.json({
        success: true,
        files,
        watchPath: fileWatcher.getWatchPath(),
        mode: 'all'
      });
    } else {
      // 최신 파일만 조회 (기본값)
      const files = await fileWatcher.getLatestFiles();
      const groups = await fileWatcher.getFileGroups();

      res.json({
        success: true,
        files,
        groups,
        watchPath: fileWatcher.getWatchPath(),
        mode: 'latest'
      });
    }
  } catch (error: any) {
    console.error('[API] Error getting files:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/config/file/:filename
 * 특정 파일 다운로드
 */
router.get('/file/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // 파일명 검증 (경로 탐색 공격 방지)
    const safeFilename = path.basename(filename as string);
    if (safeFilename !== filename) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    // FileWatcher Map에서 전체 경로 조회 (서브디렉토리 지원)
    let filePath = fileWatcher.getFilePath(safeFilename);

    // Map에 없으면 watchPath에서 직접 찾기 (fallback)
    if (!filePath) {
      const watchPath = fileWatcher.getWatchPath();
      filePath = path.join(watchPath, safeFilename);
    }

    // 경로 검증 (상위 디렉토리 접근 방지)
    const resolvedPath = path.resolve(filePath);
    const resolvedWatchPath = path.resolve(fileWatcher.getWatchPath());

    if (!resolvedPath.startsWith(resolvedWatchPath)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // 파일 존재 확인
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // 파일 크기 확인
    const stats = await fs.stat(filePath);
    const maxSize = fileWatcher.getMaxFileSize();

    if (stats.size > maxSize) {
      return res.status(413).json({
        success: false,
        error: `File too large (max: ${maxSize / 1024 / 1024}MB)`
      });
    }

    // 파일 전송
    res.sendFile(resolvedPath);
  } catch (error: any) {
    console.error('[API] Error sending file:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/config/watch-status
 * 현재 감시 상태 조회
 */
router.get('/watch-status', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      watchPath: fileWatcher.getWatchPath(),
      isWatching: fileWatcher.isWatching(),
      maxFileSize: fileWatcher.getMaxFileSize()
    });
  } catch (error: any) {
    console.error('[API] Error getting watch status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/config/stop-watching
 * 파일 감시 중지
 */
router.post('/stop-watching', (req: Request, res: Response) => {
  try {
    fileWatcher.stopWatching();

    res.json({
      success: true,
      message: 'File watching stopped'
    });
  } catch (error: any) {
    console.error('[API] Error stopping watch:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/config/groups
 * 파일 그룹 정보 조회 (hostname별)
 */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await fileWatcher.getFileGroups();

    res.json({
      success: true,
      groups,
      watchPath: fileWatcher.getWatchPath()
    });
  } catch (error: any) {
    console.error('[API] Error getting file groups:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/config/scan-server
 * 서버 디렉토리 재귀적 스캔 및 파일 감시 시작
 */
router.post('/scan-server', async (req: Request, res: Response) => {
  try {
    const {
      vendor = 'nokia',
      recursive = true,
      maxDepth = 5
    } = req.body;

    const serverPath = process.env.WATCH_FOLDER_PATH || '/app/configs';

    // 경로 존재 확인
    if (!fsSync.existsSync(serverPath)) {
      return res.status(404).json({
        success: false,
        error: 'Server config directory not found',
        path: serverPath
      });
    }

    // 디렉토리 확인
    const stats = fsSync.lstatSync(serverPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({
        success: false,
        error: 'Server config path is not a directory',
        path: serverPath
      });
    }

    // Vendor 타입 검증
    const validVendors: VendorType[] = ['nokia', 'arista', 'cisco', 'juniper', 'unknown'];
    if (vendor !== 'all' && !validVendors.includes(vendor)) {
      return res.status(400).json({
        success: false,
        error: `Invalid vendor. Must be one of: ${validVendors.join(', ')}, 'all'`
      });
    }

    console.log(`[API] Starting server scan: vendor=${vendor}, recursive=${recursive}, maxDepth=${maxDepth}`);

    // 재귀적 스캔 수행
    const { results, stats: scanStats } = await scanConfigsRecursive(serverPath, {
      vendor: vendor as VendorType | 'all',
      maxDepth,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    });

    // File Watcher 시작 (recursive 모드)
    fileWatcher.startWatching(serverPath, {
      recursive,
      vendor: vendor as VendorType | 'all',
      depth: maxDepth
    });

    res.json({
      success: true,
      vendor,
      path: serverPath,
      recursive,
      maxDepth,
      fileCount: results.length,
      stats: scanStats,
      files: results.map(r => ({
        path: r.path,
        relativePath: r.relativePath,
        vendor: r.vendor,
        filename: r.filename,
        size: r.size,
        mtime: r.mtime
      }))
    });
  } catch (error: any) {
    console.error('[API] Error scanning server configs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/config/server-status
 * 서버 디렉토리 사용 가능 여부 확인
 */
router.get('/server-status', async (req: Request, res: Response) => {
  try {
    const serverPath = process.env.WATCH_FOLDER_PATH || '/app/configs';

    // 경로 존재 확인
    const exists = fsSync.existsSync(serverPath);

    if (!exists) {
      return res.json({
        success: true,
        available: false,
        path: serverPath,
        exists: false,
        isDirectory: false,
        readable: false
      });
    }

    // 디렉토리 확인
    const stats = fsSync.lstatSync(serverPath);
    const isDirectory = stats.isDirectory();

    // 읽기 권한 확인
    let readable = false;
    try {
      await fs.access(serverPath, fsSync.constants.R_OK);
      readable = true;
    } catch {
      readable = false;
    }

    res.json({
      success: true,
      available: exists && isDirectory && readable,
      path: serverPath,
      exists,
      isDirectory,
      readable
    });
  } catch (error: any) {
    console.error('[API] Error checking server status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
