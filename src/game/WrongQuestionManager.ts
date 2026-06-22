import type { Question } from '../data/questionBank';
import { questionBank, modelDescriptions } from '../data/questionBank';

export interface WrongQuestionRecord {
  questionId: string;
  wrongCount: number;
  lastWrongModelId: string;
  lastWrongTime: number;
  firstWrongTime: number;
}

const STORAGE_KEY = 'origami_wrong_questions';

export class WrongQuestionManager {
  private records: Map<string, WrongQuestionRecord> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WrongQuestionRecord[];
        parsed.forEach(record => {
          this.records.set(record.questionId, record);
        });
      }
    } catch (e) {
      console.error('Failed to load wrong questions from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.records.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save wrong questions to storage:', e);
    }
  }

  addWrongAnswer(questionId: string, wrongModelId: string): void {
    const now = Date.now();
    const existing = this.records.get(questionId);

    if (existing) {
      existing.wrongCount += 1;
      existing.lastWrongModelId = wrongModelId;
      existing.lastWrongTime = now;
    } else {
      this.records.set(questionId, {
        questionId,
        wrongCount: 1,
        lastWrongModelId: wrongModelId,
        lastWrongTime: now,
        firstWrongTime: now
      });
    }

    this.saveToStorage();
  }

  removeRecord(questionId: string): void {
    this.records.delete(questionId);
    this.saveToStorage();
  }

  clearAll(): void {
    this.records.clear();
    this.saveToStorage();
  }

  getRecords(): WrongQuestionRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.lastWrongTime - a.lastWrongTime);
  }

  getQuestionById(questionId: string): Question | undefined {
    return questionBank.find(q => q.id === questionId);
  }

  getWrongCount(): number {
    return this.records.size;
  }

  getModelName(modelId: string): string {
    const desc = modelDescriptions[modelId];
    return desc ? desc.name : modelId;
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 30) return `${diffDays}天前`;

    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}
