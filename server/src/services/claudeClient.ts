import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt';
import type { ConfigSummary, ChatResponse } from '../types';

// AWS Bedrock 클라이언트 (credential chain: env vars → ~/.aws/credentials → IAM Role)
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION
    || process.env.AWS_DEFAULT_REGION
    || 'ap-northeast-2',
  ...(process.env.AWS_PROFILE ? { profile: process.env.AWS_PROFILE } : {}),
});

// 모델 ID (환경변수로 변경 가능)
const MODEL_ID = process.env.BEDROCK_MODEL_ID
  || 'apac.anthropic.claude-sonnet-4-20250514-v1:0';

export async function askClaude(
  message: string,
  configSummary: ConfigSummary,
): Promise<ChatResponse> {
  const userContent = `## ConfigSummary (파싱된 네트워크 설정 축약 데이터)

\`\`\`json
${JSON.stringify(configSummary, null, 2)}
\`\`\`

## 사용자 질문

${message}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: [{ text: userContent }] as ContentBlock[],
    },
  ];

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages,
    inferenceConfig: {
      maxTokens: 1024,
      temperature: 0.1,
    },
  });

  const response = await client.send(command);

  // 응답에서 텍스트 추출
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

  let parsed: ChatResponse;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude 응답 JSON 파싱 실패: ${rawText.substring(0, 200)}`);
  }

  // 응답 구조 검증
  if (!Array.isArray(parsed.selectedKeys)) {
    parsed.selectedKeys = [];
  }
  if (typeof parsed.explanation !== 'string') {
    parsed.explanation = '응답을 처리했습니다.';
  }
  if (!['high', 'medium', 'low'].includes(parsed.confidence)) {
    parsed.confidence = 'medium';
  }

  // selectedKeys가 configSummary에 실제 존재하는지 검증
  const validKeys = new Set<string>();
  for (const device of configSummary.devices) {
    for (const service of device.services) {
      validKeys.add(service.selectionKey);
      // 개별 인터페이스 키도 허용
      if (service.interfaces) {
        for (const intf of service.interfaces) {
          if (service.serviceType === 'vprn') {
            validKeys.add(`vprn___${service.serviceId}___${device.hostname}___${intf.name}`);
          } else if (service.serviceType === 'ies') {
            validKeys.add(`ies___${device.hostname}___${intf.name}`);
          }
        }
      }
    }
  }
  parsed.selectedKeys = parsed.selectedKeys.filter(key => validKeys.has(key));

  return parsed;
}

/** Bedrock 연결 확인 */
export async function checkBedrockAccess(): Promise<boolean> {
  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: 'ping' }] as ContentBlock[],
        },
      ],
      inferenceConfig: { maxTokens: 1 },
    });
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}
