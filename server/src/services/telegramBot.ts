import https from 'https';
import { askClaude } from './claudeClient';
import { configStore } from './configStore';
import { fileWatcher } from './fileWatcher';
import { loadDictionary } from './dictionaryStore';
import fs from 'fs/promises';
import type { ConfigSummary, DictionaryCompact } from '../types';

interface TelegramConfig {
  token: string;
  chatId: string;
  topicId: number;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: {
    id: number;
  };
  message_thread_id?: number;
  from?: {
    id: number;
    first_name: string;
    username?: string;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/**
 * Nokia Visualizer Telegram Bot Service
 * AI 챗봇 기능을 텔레그램으로 제공
 */
export class NokiaTelegramBot {
  private config: TelegramConfig;
  private baseUrl: string;
  private lastUpdateId: number = 0;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${config.token}`;
  }

  /**
   * 봇 시작
   */
  start() {
    console.log('[TelegramBot] Starting Nokia Visualizer bot...');
    console.log(`[TelegramBot] Chat ID: ${this.config.chatId}`);
    console.log(`[TelegramBot] Topic ID: ${this.config.topicId}`);

    this.pollUpdates();
  }

  /**
   * Long Polling으로 메시지 수신
   */
  private async pollUpdates() {
    while (true) {
      try {
        const updates = await this.getUpdates();

        for (const update of updates) {
          this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
          await this.handleUpdate(update);
        }

        // 다음 폴링까지 대기 (1초)
        await this.sleep(1000);
      } catch (error) {
        console.error('[TelegramBot] Polling error:', error);
        await this.sleep(5000); // 에러 시 5초 대기
      }
    }
  }

  /**
   * Telegram getUpdates API 호출
   */
  private async getUpdates(): Promise<TelegramUpdate[]> {
    const url = `${this.baseUrl}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.ok) {
              resolve(json.result || []);
            } else {
              reject(new Error(json.description || 'Telegram API error'));
            }
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 메시지 업데이트 처리
   */
  private async handleUpdate(update: TelegramUpdate) {
    const message = update.message;
    if (!message || !message.text) return;

    // AI챗봇 Topic에서만 응답
    if (message.message_thread_id !== this.config.topicId) return;

    // 그룹 ID 확인
    if (message.chat.id.toString() !== this.config.chatId) return;

    console.log(`[TelegramBot] Received: "${message.text}" from ${message.from?.first_name}`);

    // 명령어 처리
    if (message.text.startsWith('/')) {
      await this.handleCommand(message);
    } else {
      // AI 질문 처리
      await this.handleAIQuestion(message);
    }
  }

  /**
   * 명령어 처리
   */
  private async handleCommand(message: TelegramMessage) {
    const command = message.text!.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
      case '/help':
        await this.sendHelp(message.chat.id, message.message_thread_id);
        break;
      case '/status':
        await this.sendStatus(message.chat.id, message.message_thread_id);
        break;
      default:
        await this.sendMessage(
          message.chat.id,
          '알 수 없는 명령어입니다. /help를 입력하세요.',
          message.message_thread_id
        );
    }
  }

  /**
   * AI 질문 처리
   */
  private async handleAIQuestion(message: TelegramMessage) {
    try {
      // 이름 사전 로드
      const rawDict = loadDictionary();
      const dictionary = rawDict ? (rawDict as DictionaryCompact) : undefined;

      // 1. ConfigStore에서 데이터 로드 시도
      let configs = configStore.getAll();

      // 2. ConfigStore가 비어있으면 FileWatcher에서 파일 읽기
      if (configs.length === 0) {
        const latestFiles = await fileWatcher.getLatestFiles();

        if (latestFiles.length === 0) {
          await this.sendMessage(
            message.chat.id,
            '❌ Config 파일이 없습니다.\n\n/data/configs 폴더에 Nokia config 파일(.txt)을 저장해주세요.',
            message.message_thread_id
          );
          return;
        }

        // FileWatcher의 파일 목록을 웹 UI API 형식으로 변환
        await this.sendMessage(
          message.chat.id,
          `📂 ${latestFiles.length}개 Config 파일을 불러오는 중...\n\n잠시만 기다려주세요.`,
          message.message_thread_id
        );

        // 파일 읽기 및 ConfigSummary 직접 생성
        const devices: any[] = [];
        for (const filename of latestFiles) { // 모든 파일 읽기
          try {
            const filePath = fileWatcher.getFilePath(filename);
            if (!filePath) continue;

            const content = await fs.readFile(filePath, 'utf-8');

            // 간단한 파싱 (hostname 추출)
            const hostnameMatch = content.match(/system\s+name\s+"?([^"\n]+)"?/);
            const hostname = hostnameMatch ? hostnameMatch[1].trim() : filename.replace(/\..+$/, '');

            devices.push({
              hostname,
              systemIp: '',
              services: [], // FileWatcher 모드: 서비스 파싱 없이 RAW config 전달
              _rawConfig: content, // 전체 파일 내용 전달 (Claude가 직접 분석)
            });
          } catch (err) {
            console.error(`[TelegramBot] Failed to read file: ${filename}`, err);
          }
        }

        if (devices.length === 0) {
          await this.sendMessage(
            message.chat.id,
            '❌ Config 파일을 읽을 수 없습니다.',
            message.message_thread_id
          );
          return;
        }

        // ConfigSummary 생성 (간단한 버전)
        const configSummary: ConfigSummary = { devices };

        // 처리 중 메시지
        await this.sendMessage(
          message.chat.id,
          `🤖 ${devices.length}개 장비 Config를 AI가 분석 중...\n\n잠시만 기다려주세요.`,
          message.message_thread_id
        );

        // Claude AI에 질문 (raw config 텍스트 검색, 이름 사전 적용)
        const result = await askClaude(
          message.text!,
          configSummary,
          dictionary,
          'all'
        );

        // 간단한 응답 (파일 목록 반환)
        let responseText = `✅ 검색 완료\n\n`;
        responseText += `**질문:** ${this.escapeMarkdown(message.text!)}\n\n`;
        responseText += `**AI 분석:**\n${this.escapeMarkdown(result.explanation || '분석 결과가 없습니다.')}\n\n`;
        responseText += `**매칭된 장비:**\n`;
        devices.forEach((dev, idx) => {
          responseText += `${idx + 1}. ${this.escapeMarkdown(dev.hostname)}\n`;
        });

        await this.sendMessage(
          message.chat.id,
          responseText,
          message.message_thread_id
        );
        return;
      }

      // ConfigStore에 데이터가 있는 경우 기존 로직 사용
      const configSummary: ConfigSummary = {
        devices: configs.map((config: any) => {
          // AutoParser가 저장한 형식: config.configSummary.devices[0] = { hostname, systemIp, services }
          const deviceData = config.configSummary.devices[0];
          return {
            hostname: config.hostname,
            systemIp: config.systemIp || '',
            services: deviceData?.services || [],
          };
        }),
      };

      // 처리 중 메시지 전송
      await this.sendMessage(
        message.chat.id,
        '🤖 AI가 분석 중입니다...',
        message.message_thread_id
      );

      // Claude AI에 질문 (이름 사전 적용)
      const result = await askClaude(
        message.text!,
        configSummary,
        dictionary,
        'all'
      );

      // 응답 포맷팅
      const responseText = this.formatAIResponse(result, configSummary);

      // 응답 전송
      await this.sendMessage(
        message.chat.id,
        responseText,
        message.message_thread_id
      );

    } catch (error) {
      console.error('[TelegramBot] AI question error:', error);
      await this.sendMessage(
        message.chat.id,
        `❌ 오류가 발생했습니다.\n\n${(error as Error).message}`,
        message.message_thread_id
      );
    }
  }

  /**
   * AI 응답 포맷팅 (간결한 버전 - 웹 UI와 동일)
   */
  private formatAIResponse(result: any, configSummary: ConfigSummary): string {
    const { selectedKeys, explanation } = result;

    if (!selectedKeys || selectedKeys.length === 0) {
      return `📭 검색 결과가 없습니다.\n\n${this.escapeMarkdown(explanation)}`;
    }

    // 선택된 서비스 찾기
    const selectedServices: any[] = [];
    for (const device of configSummary.devices) {
      for (const service of device.services) {
        if (selectedKeys.includes(service.selectionKey)) {
          selectedServices.push({
            ...service,
            hostname: device.hostname,
          });
        }
      }
    }

    // 간결한 응답 텍스트 생성 (웹 UI와 동일)
    let text = `✅ 검색 결과 (${selectedServices.length}개 서비스)\n\n`;
    text += `${this.escapeMarkdown(explanation)}\n\n`;

    // 서비스 목록 (최대 20개)
    const maxServices = 20;
    selectedServices.slice(0, maxServices).forEach((service, index) => {
      text += `${index + 1}. ${service.serviceType.toUpperCase()} ${service.serviceId}\n`;
      text += `   • 장비: ${this.escapeMarkdown(service.hostname)}\n`;
      if (service.description) {
        text += `   • 설명: ${this.escapeMarkdown(service.description)}\n`;
      }
    });

    if (selectedServices.length > maxServices) {
      text += `\n... 외 ${selectedServices.length - maxServices}개 서비스\n`;
    }

    return text;
  }

  /**
   * 정확도 배지
   */
  private getConfidenceBadge(confidence: string): string {
    switch (confidence) {
      case 'high': return '🟢 높음';
      case 'medium': return '🟡 보통';
      case 'low': return '🔴 낮음';
      default: return '⚪ 알 수 없음';
    }
  }

  /**
   * 도움말 전송
   */
  private async sendHelp(chatId: number, topicId?: number) {
    const helpText = `
🤖 **Nokia Visualizer AI 챗봇**

**사용법:**
자연어로 질문하면 AI가 Nokia config 데이터를 분석하여 관련 서비스를 찾아드립니다.

**예시 질문:**
• Epipe 서비스 보여줘
• QoS가 100M 이상인 서비스
• nokia-1 장비의 모든 서비스
• 172.16으로 시작하는 VPRN

**명령어:**
/help - 도움말
/status - Config 로딩 상태 확인
`;

    await this.sendMessage(chatId, helpText.trim(), topicId);
  }

  /**
   * 상태 전송
   */
  private async sendStatus(chatId: number, topicId?: number) {
    const configs = configStore.getAll();
    const allServices = configStore.getAllServices();

    // 타입별 집계
    const servicesByType: Record<string, number> = {};
    allServices.forEach(svc => {
      servicesByType[svc.serviceType] = (servicesByType[svc.serviceType] || 0) + 1;
    });

    let statusText = '📊 **Nokia Visualizer 상태**\n\n';
    statusText += `• Config 파일: ${configs.length}개\n`;
    statusText += `• 총 서비스: ${allServices.length}개\n`;
    statusText += `  - Epipe: ${servicesByType.epipe || 0}개\n`;
    statusText += `  - VPLS: ${servicesByType.vpls || 0}개\n`;
    statusText += `  - VPRN: ${servicesByType.vprn || 0}개\n`;
    statusText += `  - IES: ${servicesByType.ies || 0}개\n`;

    if (configs.length === 0) {
      statusText += '\n⚠️ Config 데이터가 없습니다.\n';
      statusText += '/data/configs 폴더에 파일을 저장해주세요.';
    }

    await this.sendMessage(chatId, statusText, topicId);
  }

  /**
   * 메시지 전송
   */
  private async sendMessage(chatId: number, text: string, topicId?: number): Promise<void> {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      message_thread_id: topicId,
      parse_mode: 'Markdown',
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        `${this.baseUrl}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.ok) {
                resolve();
              } else {
                reject(new Error(json.description || 'Telegram sendMessage error'));
              }
            } catch (err) {
              reject(err);
            }
          });
        }
      );

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Sleep 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Telegram Markdown 특수문자 이스케이프
   *
   * Telegram Markdown v1 (parse_mode: 'Markdown')에서 문제되는 문자들:
   * - _ (밑줄) → \_
   * - * (별표) → \* (이미 **굵게**로 사용 중이므로 제외)
   * - [ ] (대괄호) → \[ \]
   * - ( ) (괄호) → 일부 케이스에서 문제
   * - ` (백틱) → \` (이미 코드로 사용 중이므로 제외)
   */
  private escapeMarkdown(text: string): string {
    // Claude AI 응답에서 자주 발생하는 패턴들만 이스케이프
    return text
      .replace(/_/g, '\\_')         // 밑줄
      .replace(/\[/g, '\\[')        // 왼쪽 대괄호
      .replace(/\]/g, '\\]');       // 오른쪽 대괄호
  }
}

/**
 * 텔레그램 봇 인스턴스 생성 및 시작
 */
export function startTelegramBot(config: TelegramConfig): NokiaTelegramBot {
  const bot = new NokiaTelegramBot(config);
  bot.start();
  return bot;
}
