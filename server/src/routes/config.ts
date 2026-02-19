/**
 * Config 파일 관리 API
 *
 * 파일 감시, 파일 목록 조회, 파일 다운로드 엔드포인트를 제공합니다.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileWatcher } from '../services/fileWatcher';

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

    // 폴더 존재 확인
    try {
      await fs.access(watchPath);
      const stats = await fs.stat(watchPath);

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
      error: error.message || 'Internal server error'
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
      error: error.message || 'Internal server error'
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

    const watchPath = fileWatcher.getWatchPath();
    const filePath = path.join(watchPath, safeFilename);

    // 경로 검증 (상위 디렉토리 접근 방지)
    const resolvedPath = path.resolve(filePath);
    const resolvedWatchPath = path.resolve(watchPath);

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
      error: error.message || 'Internal server error'
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
      error: error.message || 'Internal server error'
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
      error: error.message || 'Internal server error'
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
      error: error.message || 'Internal server error'
    });
  }
});

export default router;
