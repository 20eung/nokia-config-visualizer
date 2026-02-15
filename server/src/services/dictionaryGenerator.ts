import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DICTIONARY_SYSTEM_PROMPT } from '../prompts/dictionaryPrompt';
import type { DictionaryGenerateResponse } from '../types';

// AWS Bedrock 클라이언트 (claudeClient.ts와 동일한 설정)
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION
    || process.env.AWS_DEFAULT_REGION
    || 'ap-northeast-2',
  ...(process.env.AWS_PROFILE ? { profile: process.env.AWS_PROFILE } : {}),
});

const MODEL_ID = process.env.BEDROCK_MODEL_ID
  || 'apac.anthropic.claude-sonnet-4-20250514-v1:0';

export async function generateDictionaryEntries(
  descriptions: string[],
): Promise<DictionaryGenerateResponse> {
  const userContent = `다음 Nokia 장비 설정 description 목록에서 엔티티를 추출하고 이름 변형을 생성해주세요.

## Description 목록 (${descriptions.length}개)

${descriptions.map((d, i) => `${i + 1}. "${d}"`).join('\n')}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: [{ text: userContent }] as ContentBlock[],
    },
  ];

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: DICTIONARY_SYSTEM_PROMPT }],
    messages,
    inferenceConfig: {
      maxTokens: 8192,
      temperature: 0.2,
    },
  });

  const response = await client.send(command);

  const outputContent = response.output?.message?.content;
  if (!outputContent || outputContent.length === 0) {
    throw new Error('Bedrock 응답이 비어있습니다.');
  }

  const textBlock = outputContent.find(block => 'text' in block);
  if (!textBlock || !('text' in textBlock)) {
    throw new Error('Bedrock 응답에서 텍스트를 찾을 수 없습니다.');
  }

  const rawText = textBlock.text as string;

  // JSON 파싱 (코드블록으로 감싸진 경우 처리)
  let jsonText = rawText.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  let parsed: DictionaryGenerateResponse;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Dictionary 응답 JSON 파싱 실패: ${rawText.substring(0, 200)}`);
  }

  // 응답 구조 검증
  if (!Array.isArray(parsed.entries)) {
    parsed.entries = [];
  }

  // 각 엔트리 기본값 보정
  parsed.entries = parsed.entries.map(entry => ({
    originalToken: entry.originalToken || '',
    category: (['customer', 'location', 'service', 'device', 'other'].includes(entry.category)
      ? entry.category
      : 'other') as 'customer' | 'location' | 'service' | 'device' | 'other',
    shortName: entry.shortName || entry.originalToken || '',
    longName: entry.longName || entry.originalToken || '',
    koreanName: entry.koreanName || entry.originalToken || '',
    aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
  }));

  return parsed;
}
