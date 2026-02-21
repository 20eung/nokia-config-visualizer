/**
 * NCV AI Platform - RAG 인덱서 (v4.8.0)
 *
 * vectra(로컬 파일 기반 벡터 DB)를 사용하여 Config 서비스를 인덱싱.
 * POST /api/ncv/index 로 트리거, POST /api/ncv/semantic-search 로 검색.
 *
 * 요구사항: npm install vectra
 */

import path from 'path';
import type { NcvSemanticSearchResult } from '../types';

// vectra는 선택적 의존성 (npm install vectra 후 활성화)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LocalIndex } = require('vectra') as { LocalIndex: new (path: string) => VectraIndex };

/** vectra LocalIndex 최소 타입 정의 */
interface VectraIndex {
  isIndexCreated(): Promise<boolean>;
  createIndex(options?: { version?: number; deleteIfExists?: boolean }): Promise<void>;
  deleteIndex(): Promise<void>;
  insertItem(item: { vector: number[]; metadata: Record<string, unknown> }): Promise<void>;
  queryItems(vector: number[], topK: number): Promise<Array<{
    item: { vector: number[]; metadata: Record<string, unknown> };
    score: number;
  }>>;
}

const INDEX_PATH = process.env['RAG_INDEX_PATH']
  ?? path.join(process.cwd(), 'data', 'rag-index');

let _index: VectraIndex | null = null;
let _indexedAt: Date | null = null;

async function getIndex(): Promise<VectraIndex> {
  if (!_index) {
    _index = new LocalIndex(INDEX_PATH);
    if (!(await _index.isIndexCreated())) {
      await _index.createIndex({ version: 1 });
    }
  }
  return _index;
}

/**
 * ConfigStore의 전체 서비스를 벡터 인덱스에 빌드
 * @returns 인덱싱된 청크 수 + 소요 시간
 */
export async function buildIndex(): Promise<{ chunkCount: number; durationMs: number }> {
  const start = Date.now();

  // 동적 import (순환 방지)
  const { configStore } = await import('./configStore');
  const { buildChunks } = await import('./chunkBuilder');
  const { getEmbeddings } = await import('./embeddingService');

  const services = configStore.getAllServices();
  const chunks = buildChunks(services);

  if (chunks.length === 0) {
    return { chunkCount: 0, durationMs: Date.now() - start };
  }

  // 인덱스 재생성
  const idx = await getIndex();
  try {
    await idx.deleteIndex();
  } catch {
    // 인덱스가 없으면 무시
  }
  await idx.createIndex({ version: 1, deleteIfExists: true });
  _index = new LocalIndex(INDEX_PATH);

  console.log(`[ragIndexer] ${chunks.length}개 청크 임베딩 시작...`);

  // 배치 임베딩 생성
  const texts = chunks.map(c => c.text);
  const embeddings = await getEmbeddings(texts);

  // 인덱스에 삽입
  const freshIdx = await getIndex();
  for (let i = 0; i < chunks.length; i++) {
    await freshIdx.insertItem({
      vector: embeddings[i],
      metadata: chunks[i].metadata as Record<string, unknown>,
    });
  }

  // 인덱싱 시간 기록
  _indexedAt = new Date();
  for (const svc of services) {
    configStore.setIndexedAt(`${svc.hostname}.txt`, _indexedAt);
  }

  const durationMs = Date.now() - start;
  console.log(`[ragIndexer] 인덱싱 완료: ${chunks.length}개 청크, ${durationMs}ms`);

  return { chunkCount: chunks.length, durationMs };
}

/**
 * 자연어 쿼리로 관련 서비스 검색
 */
export async function semanticSearch(
  query: string,
  topK = 5,
): Promise<NcvSemanticSearchResult[]> {
  const idx = await getIndex();

  if (!(await idx.isIndexCreated())) {
    return [];
  }

  const { getEmbedding } = await import('./embeddingService');
  const queryVector = await getEmbedding(query);

  const results = await idx.queryItems(queryVector, topK);

  return results.map(r => ({
    selectionKey: String(r.item.metadata['selectionKey'] ?? ''),
    hostname: String(r.item.metadata['hostname'] ?? ''),
    serviceType: String(r.item.metadata['serviceType'] ?? ''),
    description: String(r.item.metadata['description'] ?? ''),
    score: r.score,
  }));
}

/** 마지막 인덱싱 시간 */
export function getIndexedAt(): Date | null {
  return _indexedAt;
}
