/**
 * NCV AI Platform - AWS Bedrock Titan 임베딩 서비스 (v4.8.0)
 *
 * Amazon Titan Embed Text v2 모델로 텍스트 → 벡터 변환.
 * 기존 Bedrock 인프라(claudeClient.ts) 재활용.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config';

const client = new BedrockRuntimeClient({ region: config.aws.region });

/** Amazon Titan Embed Text v2 모델 ID */
const EMBEDDING_MODEL = 'amazon.titan-embed-text-v2:0';

/** 임베딩 벡터 차원 수 (Titan v2: 1024) */
export const EMBEDDING_DIMENSION = 1024;

/** 단일 텍스트 임베딩 생성 */
export async function getEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding: number[];
  };

  return body.embedding;
}

/**
 * 배치 임베딩 생성 (스로틀링 방지)
 * @param texts 임베딩할 텍스트 배열
 * @param batchSize 배치 크기 (기본 5)
 */
export async function getEmbeddings(
  texts: string[],
  batchSize = 5,
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(getEmbedding));
    results.push(...batchResults);

    // 배치 간 100ms 대기 (Bedrock 스로틀링 방지)
    if (i + batchSize < texts.length) {
      await new Promise<void>(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
