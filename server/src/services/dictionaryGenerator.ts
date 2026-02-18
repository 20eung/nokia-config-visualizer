import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { DICTIONARY_SYSTEM_PROMPT } from '../prompts/dictionaryPrompt';
import { config } from '../config';
import type { DictionaryGenerateResponse } from '../types';

// AWS Bedrock 클라이언트 (config에서 중앙 관리)
const client = new BedrockRuntimeClient({
  region: config.aws.region,
  ...(config.aws.profile ? { profile: config.aws.profile } : {}),
});

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
    modelId: config.bedrock.modelId,
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

  // 각 엔트리 기본값 보정 (v5.0)
  parsed.entries = parsed.entries.map(entry => ({
    name: entry.name || '',
    configKeywords: Array.isArray(entry.configKeywords) ? entry.configKeywords : [],
    searchAliases: Array.isArray(entry.searchAliases) ? entry.searchAliases : [],
  }));

  return parsed;
}
