import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt';
import { config } from '../config';
import type { ConfigSummary, ChatResponse, DictionaryCompact, MatchedEntry } from '../types';

// AWS Bedrock 클라이언트 (credential chain: env vars → ~/.aws/credentials → IAM Role)
const client = new BedrockRuntimeClient({
  region: config.aws.region,
  ...(config.aws.profile ? { profile: config.aws.profile } : {}),
});

/**
 * MatchedEntry 배열 유효성 검증 (v4.4.0)
 * Dictionary에 실제 존재하는 항목인지 확인
 */
function validateMatchedEntries(
  entries: MatchedEntry[] | undefined,
  dictionary?: DictionaryCompact
): MatchedEntry[] {
  if (!entries || !dictionary) {
    return [];
  }

  // v4.4.0: configKeywords가 dictionary에 존재하는지 검증
  const validKeywords = new Set<string>();
  dictionary.entries.forEach(e => {
    e.k.forEach(keyword => validKeywords.add(keyword));  // k = configKeywords
  });

  return entries.filter(entry => {
    // 필수 필드 존재 여부 확인
    if (!entry.matchedAlias || !Array.isArray(entry.configKeywords) || !entry.groupName) {
      return false;
    }

    // configKeywords가 최소 1개 이상 dictionary에 존재하는지 확인
    const hasValidKeyword = entry.configKeywords.some(kw => validKeywords.has(kw));
    if (!hasValidKeyword) {
      return false;
    }

    return true;
  });
}

export async function askClaude(
  message: string,
  configSummary: ConfigSummary,
  dictionary?: DictionaryCompact,
  filterType?: 'all' | 'epipe' | 'vpls' | 'vprn' | 'ies',
): Promise<ChatResponse> {
  console.log('[askClaude] 요청 정보:');
  console.log(`  - message: "${message}"`);
  console.log(`  - filterType: ${filterType || 'none'}`);
  console.log(`  - dictionary: ${dictionary ? `${dictionary.entries.length}개 항목` : 'none'}`);

  let dictionarySection = '';
  if (dictionary && dictionary.entries.length > 0) {
    const lines = dictionary.entries.map(e => {
      const configKw = e.k.join(', ');  // k = configKeywords
      const searchAl = e.a.length > 0 ? ` | 검색어: ${e.a.join(', ')}` : '';  // a = searchAliases
      return `- "${e.n}" → Config: ${configKw}${searchAl}`;  // n = name
    });
    dictionarySection = `\n\n## Name Dictionary (이름 사전)\n\n${lines.join('\n')}`;
    console.log(`[askClaude] Dictionary 섹션 추가 (${lines.length}개 항목)`);
  } else {
    console.log('[askClaude] Dictionary 없음 - matchedEntries 생성 불가');
  }

  let filterSection = '';
  if (filterType && filterType !== 'all') {
    filterSection = `\n\n## 필터 조건\n\n서비스 타입: ${filterType} (이 타입만 검색하세요)`;
  }

  const userContent = `## ConfigSummary (파싱된 네트워크 설정 축약 데이터)

\`\`\`json
${JSON.stringify(configSummary, null, 2)}
\`\`\`
${dictionarySection}${filterSection}

## 사용자 질문

${message}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: [{ text: userContent }] as ContentBlock[],
    },
  ];

  const command = new ConverseCommand({
    modelId: config.bedrock.modelId,
    system: [{ text: SYSTEM_PROMPT }],
    messages,
    inferenceConfig: {
      maxTokens: 2048,
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

  console.log('[askClaude] Claude 원본 응답:');
  console.log(`  - selectedKeys: ${parsed.selectedKeys?.length || 0}개`);
  console.log(`  - matchedEntries (원본): ${parsed.matchedEntries?.length || 0}개`);
  if (parsed.matchedEntries && parsed.matchedEntries.length > 0) {
    console.log('  - matchedEntries 내용:', JSON.stringify(parsed.matchedEntries, null, 2));
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

  // matchedEntries 검증
  if (parsed.matchedEntries) {
    const beforeValidation = parsed.matchedEntries.length;
    parsed.matchedEntries = validateMatchedEntries(parsed.matchedEntries, dictionary);
    const afterValidation = parsed.matchedEntries.length;
    console.log(`[askClaude] matchedEntries 검증: ${beforeValidation}개 → ${afterValidation}개`);
  } else {
    console.log('[askClaude] matchedEntries 없음 (Claude가 생성하지 않음)');
  }

  // filterType 검증
  if (parsed.filterType && !['all', 'epipe', 'vpls', 'vprn', 'ies'].includes(parsed.filterType)) {
    parsed.filterType = 'all';
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
      modelId: config.bedrock.modelId,
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
