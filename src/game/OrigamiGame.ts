import { questionBank, modelDescriptions, type Question } from '../data/questionBank';
import { SeededRandom, generateSeed } from '../utils/random';
import { OrigamiSVG } from '../components/OrigamiSVG';
import { Model3DViewer } from '../components/Model3DViewer';
import { FoldStateManager } from './FoldStateManager';
import { WrongQuestionManager } from './WrongQuestionManager';

export interface GameState {
  currentQuestion: Question | null;
  score: number;
  level: number;
  stepsUsed: number;
  selectedModelId: string | null;
  gameStatus: 'idle' | 'playing' | 'won' | 'lost';
}

export class OrigamiGame {
  private container: HTMLElement;
  private state: GameState;
  private seed: number;
  private rng: SeededRandom;
  private questionPool: Question[] = [];
  private currentQuestionIndex: number = 0;
  private origamiSVG: OrigamiSVG | null = null;
  private foldStateManager: FoldStateManager | null = null;
  private modelViewers: Model3DViewer[] = [];
  private shuffledOptions: string[] = [];
  private wrongQuestionManager: WrongQuestionManager;
  private isReviewMode: boolean = false;
  private reviewQuestionIds: string[] = [];
  private reviewCurrentIndex: number = 0;

  private modelsContainer: HTMLElement | null = null;
  private submitBtn: HTMLButtonElement | null = null;
  private resetBtn: HTMLButtonElement | null = null;
  private hintBtn: HTMLButtonElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;
  private wrongListBtn: HTMLButtonElement | null = null;
  private wrongCountBadge: HTMLElement | null = null;
  private modalOverlay: HTMLElement | null = null;
  private wrongListContainer: HTMLElement | null = null;
  private returnBtn: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      currentQuestion: null,
      score: 0,
      level: 1,
      stepsUsed: 0,
      selectedModelId: null,
      gameStatus: 'idle'
    };
    this.seed = generateSeed();
    this.rng = new SeededRandom(this.seed);
    this.questionPool = this.rng.shuffle([...questionBank]);
    this.wrongQuestionManager = new WrongQuestionManager();

    this.initUI();
    this.startGame();
  }

  private initUI(): void {
    this.container.innerHTML = `
      <div class="game-container">
        <div class="game-header">
          <h1>🎯 3D 折纸挑战</h1>
          <div class="game-stats">
            <span class="stat-item">
              <span class="stat-label">关卡</span>
              <span class="stat-value" id="level-display">1</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">得分</span>
              <span class="stat-value" id="score-display">0</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">步数</span>
              <span class="stat-value" id="steps-display">0/0</span>
            </span>
            <button class="btn-wrong-list" id="wrong-list-btn" title="错题本">
              📝 错题本
              <span class="wrong-count-badge" id="wrong-count-badge" style="display: none;">0</span>
            </button>
          </div>
        </div>

        <div class="game-main">
          <div class="left-panel">
            <div class="panel-title">📐 折痕图</div>
            <div class="question-info">
              <h2 id="question-name">题目名称</h2>
              <p id="question-desc">题目描述</p>
            </div>
            <div class="svg-container" id="svg-container"></div>
            <div class="action-buttons">
              <button class="btn btn-secondary" id="reset-btn">🔄 重置</button>
              <button class="btn btn-secondary" id="hint-btn">💡 提示</button>
            </div>
          </div>

          <div class="right-panel">
            <div class="panel-title">🧩 选择正确的3D模型</div>
            <div class="models-container" id="models-container"></div>
            <div class="submit-area">
              <button class="btn btn-primary" id="submit-btn" disabled>✅ 提交答案</button>
            </div>
          </div>
        </div>

        <div class="game-footer">
          <button class="btn btn-next" id="next-btn" style="display: none;">➡️ 下一题</button>
          <button class="btn btn-return" id="return-btn" style="display: none;">↩️ 返回题库</button>
          <div class="result-message" id="result-message"></div>
        </div>
      </div>

      <div class="modal-overlay" id="modal-overlay" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>📝 错题本</h2>
            <button class="modal-close-btn" id="modal-close-btn">✕</button>
          </div>
          <div class="modal-body">
            <div class="wrong-list-toolbar">
              <span class="wrong-list-summary" id="wrong-list-summary">共 0 道错题</span>
              <button class="btn btn-clear" id="clear-wrong-btn">🗑️ 清空错题</button>
            </div>
            <div class="wrong-list-container" id="wrong-list-container"></div>
          </div>
        </div>
      </div>
    `;

    this.modelsContainer = this.container.querySelector('#models-container');
    this.submitBtn = this.container.querySelector('#submit-btn');
    this.resetBtn = this.container.querySelector('#reset-btn');
    this.hintBtn = this.container.querySelector('#hint-btn');
    this.nextBtn = this.container.querySelector('#next-btn');
    this.wrongListBtn = this.container.querySelector('#wrong-list-btn');
    this.wrongCountBadge = this.container.querySelector('#wrong-count-badge');
    this.modalOverlay = this.container.querySelector('#modal-overlay');
    this.wrongListContainer = this.container.querySelector('#wrong-list-container');
    this.returnBtn = this.container.querySelector('#return-btn');

    this.submitBtn?.addEventListener('click', () => this.checkAnswer());
    this.resetBtn?.addEventListener('click', () => this.resetFolds());
    this.hintBtn?.addEventListener('click', () => this.showHint());
    this.nextBtn?.addEventListener('click', () => this.nextQuestion());
    this.wrongListBtn?.addEventListener('click', () => this.openWrongList());
    this.returnBtn?.addEventListener('click', () => this.exitReviewMode());

    const closeModalBtn = this.container.querySelector('#modal-close-btn');
    closeModalBtn?.addEventListener('click', () => this.closeWrongList());

    const clearWrongBtn = this.container.querySelector('#clear-wrong-btn');
    clearWrongBtn?.addEventListener('click', () => this.clearAllWrongQuestions());

    this.modalOverlay?.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeWrongList();
      }
    });

    this.updateWrongCountBadge();
  }

  private startGame(): void {
    this.loadQuestion(this.currentQuestionIndex);
  }

  private loadQuestion(index: number): void {
    let question: Question;

    if (this.isReviewMode) {
      if (this.reviewCurrentIndex >= this.reviewQuestionIds.length) {
        this.showMessage('🎉 恭喜！错题已全部复习完成', 'success');
        if (this.nextBtn) this.nextBtn.style.display = 'none';
        return;
      }
      const questionId = this.reviewQuestionIds[this.reviewCurrentIndex];
      const found = this.wrongQuestionManager.getQuestionById(questionId);
      if (!found) {
        this.reviewCurrentIndex++;
        this.loadQuestion(index);
        return;
      }
      question = found;
    } else {
      let safeIndex = index;
      if (index >= this.questionPool.length) {
        this.currentQuestionIndex = 0;
        this.questionPool = this.rng.shuffle([...questionBank]);
        safeIndex = 0;
      }
      question = this.questionPool[safeIndex];
    }

    this.state.currentQuestion = question;
    this.state.stepsUsed = 0;
    this.state.selectedModelId = null;
    this.state.gameStatus = 'playing';

    this.updateUI();
    this.setupOrigamiSVG(question);
    this.setupFoldState(question);
    this.setupModelOptions(question);
    this.hideMessage();
    this.updateSubmitState();

    if (this.nextBtn) {
      this.nextBtn.style.display = 'none';
    }
  }

  private setupOrigamiSVG(question: Question): void {
    const svgContainer = this.container.querySelector('#svg-container') as HTMLElement;
    if (!svgContainer) return;

    if (this.origamiSVG) {
      this.origamiSVG.destroy();
    }

    this.origamiSVG = new OrigamiSVG(
      svgContainer,
      question,
      (lineId) => this.handleFold(lineId),
      (lineId) => this.handleUnfold(lineId)
    );
  }

  private setupFoldState(question: Question): void {
    this.foldStateManager = new FoldStateManager(question);
  }

  private setupModelOptions(question: Question): void {
    this.modelViewers.forEach(viewer => viewer.destroy());
    this.modelViewers = [];

    const options = [question.correctModelId, ...question.distractorModelIds];
    this.shuffledOptions = this.rng.shuffle(options);

    if (this.modelsContainer) {
      this.modelsContainer.innerHTML = '';
    }

    this.shuffledOptions.forEach((modelId) => {
      const modelCard = document.createElement('div');
      modelCard.className = 'model-card';
      modelCard.dataset.modelId = modelId;

      const modelViewerContainer = document.createElement('div');
      modelViewerContainer.className = 'model-viewer';
      modelCard.appendChild(modelViewerContainer);

      const modelLabel = document.createElement('div');
      modelLabel.className = 'model-label';
      const desc = modelDescriptions[modelId];
      modelLabel.textContent = desc ? desc.name : modelId;
      modelCard.appendChild(modelLabel);

      modelCard.addEventListener('click', () => this.selectModel(modelId));

      this.modelsContainer?.appendChild(modelCard);

      const viewer = new Model3DViewer(modelViewerContainer);
      viewer.loadModel(modelId);
      this.modelViewers.push(viewer);
    });
  }

  private handleFold(lineId: string): void {
    if (!this.foldStateManager || this.state.gameStatus !== 'playing') return;

    if (this.foldStateManager.fold(lineId)) {
      this.state.stepsUsed = this.foldStateManager.getCurrentStep();
      this.updateStepsDisplay();
      this.checkFoldComplete();
    } else {
      this.origamiSVG?.unfoldLine(lineId, false);
      const nextLine = this.foldStateManager.getNextFoldLine();
      if (nextLine) {
        this.showMessage(`请按顺序折叠：第 ${nextLine.order} 步 - ${this.formatFoldType(nextLine.type)}`, 'info');
      }
    }
    this.updateSubmitState();
  }

  private handleUnfold(lineId: string): void {
    if (!this.foldStateManager || this.state.gameStatus !== 'playing') return;

    if (this.foldStateManager.unfold(lineId)) {
      this.state.stepsUsed = this.foldStateManager.getCurrentStep();
      this.updateStepsDisplay();
    } else {
      this.origamiSVG?.foldLine(lineId, false);
      this.showMessage('只能撤销最后一步折痕，请先撤销后面的折痕。', 'info');
    }
    this.updateSubmitState();
  }

  private checkFoldComplete(): void {
    if (this.foldStateManager?.isComplete()) {
      this.showMessage('🎉 所有折叠完成！请选择正确的3D模型', 'info');
    }
    this.updateSubmitState();
  }

  private selectModel(modelId: string): void {
    if (this.state.gameStatus !== 'playing') return;

    this.state.selectedModelId = modelId;

    this.modelViewers.forEach(viewer => {
      viewer.setSelected(viewer.getModelId() === modelId);
    });

    this.container.querySelectorAll('.model-card').forEach(card => {
      const htmlCard = card as HTMLElement;
      htmlCard.classList.remove('selected');
      if (htmlCard.dataset.modelId === modelId) {
        htmlCard.classList.add('selected');
      }
    });

    this.updateSubmitState();

    if (!this.foldStateManager?.isComplete()) {
      this.showMessage('请先按顺序完成全部折叠，再提交答案。', 'info');
    }
  }

  private checkAnswer(): void {
    if (!this.state.currentQuestion || !this.state.selectedModelId) return;

    if (!this.foldStateManager?.isComplete()) {
      this.updateSubmitState();
      this.showMessage('还没有完成折叠，先按提示折完再提交答案。', 'info');
      return;
    }

    const isCorrect = this.state.selectedModelId === this.state.currentQuestion.correctModelId;

    if (isCorrect) {
      const stepsBonus = Math.max(0, this.state.currentQuestion.maxSteps - this.state.stepsUsed) * 10;
      const baseScore = this.state.currentQuestion.difficulty * 100;
      this.state.score += baseScore + stepsBonus;
      this.state.gameStatus = 'won';
      this.showMessage(`🎉 答对了！获得 ${baseScore + stepsBonus} 分`, 'success');

      if (this.isReviewMode) {
        this.wrongQuestionManager.removeRecord(this.state.currentQuestion.id);
        this.updateWrongCountBadge();
      }
    } else {
      this.state.gameStatus = 'lost';
      this.showMessage('😅 答错了，再试试吧！正确答案已高亮', 'error');
      this.highlightCorrectAnswer();

      this.wrongQuestionManager.addWrongAnswer(
        this.state.currentQuestion.id,
        this.state.selectedModelId
      );
      this.updateWrongCountBadge();
    }

    this.updateScoreDisplay();

    if (this.nextBtn) {
      this.nextBtn.style.display = 'inline-block';
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = true;
    }
  }

  private highlightCorrectAnswer(): void {
    if (!this.state.currentQuestion) return;

    const correctId = this.state.currentQuestion.correctModelId;
    this.container.querySelectorAll('.model-card').forEach(card => {
      const htmlCard = card as HTMLElement;
      if (htmlCard.dataset.modelId === correctId) {
        htmlCard.classList.add('correct');
      }
    });
  }

  private resetFolds(): void {
    this.origamiSVG?.reset();
    this.foldStateManager?.reset();
    this.state.stepsUsed = 0;
    this.state.gameStatus = 'playing';
    this.state.selectedModelId = null;

    this.modelViewers.forEach(viewer => viewer.setSelected(false));
    this.container.querySelectorAll('.model-card').forEach(card => {
      card.classList.remove('selected', 'correct');
    });

    this.updateSubmitState();
    if (this.nextBtn) {
      this.nextBtn.style.display = 'none';
    }

    this.hideMessage();
    this.updateStepsDisplay();
  }

  private showHint(): void {
    if (!this.foldStateManager) return;

    const nextLine = this.foldStateManager.getNextFoldLine();

    if (nextLine) {
      const lineElement = this.container.querySelector(`[data-line-id="${nextLine.id}"]`);
      if (lineElement) {
        lineElement.classList.add('hint');
        setTimeout(() => {
          lineElement.classList.remove('hint');
        }, 2000);
      }
      this.showMessage(`💡 下一步：第 ${nextLine.order} 步 - ${nextLine.type === 'valley' ? '谷折' : '山折'}`, 'info');
    } else {
      this.showMessage('折叠已经完成，可以选择模型并提交答案。', 'info');
    }
  }

  private nextQuestion(): void {
    if (this.isReviewMode) {
      this.reviewCurrentIndex++;
      this.loadQuestion(this.reviewCurrentIndex);
    } else {
      this.currentQuestionIndex++;
      this.state.level++;
      this.loadQuestion(this.currentQuestionIndex);
    }

    if (this.nextBtn) {
      this.nextBtn.style.display = 'none';
    }
    this.hideMessage();
  }

  private updateSubmitState(): void {
    if (!this.submitBtn) return;

    const canSubmit =
      this.state.gameStatus === 'playing' &&
      Boolean(this.state.selectedModelId) &&
      Boolean(this.foldStateManager?.isComplete());

    this.submitBtn.disabled = !canSubmit;
  }

  private formatFoldType(type: 'valley' | 'mountain'): string {
    return type === 'valley' ? '谷折' : '山折';
  }

  private updateUI(): void {
    this.updateLevelDisplay();
    this.updateScoreDisplay();
    this.updateStepsDisplay();
    this.updateQuestionInfo();
  }

  private updateLevelDisplay(): void {
    const levelDisplay = this.container.querySelector('#level-display');
    if (levelDisplay) {
      if (this.isReviewMode) {
        levelDisplay.textContent = `错题${this.reviewCurrentIndex + 1}`;
      } else {
        levelDisplay.textContent = String(this.state.level);
      }
    }
  }

  private updateScoreDisplay(): void {
    const scoreDisplay = this.container.querySelector('#score-display');
    if (scoreDisplay) {
      scoreDisplay.textContent = String(this.state.score);
    }
  }

  private updateStepsDisplay(): void {
    const stepsDisplay = this.container.querySelector('#steps-display');
    if (stepsDisplay && this.state.currentQuestion) {
      stepsDisplay.textContent = `${this.state.stepsUsed}/${this.state.currentQuestion.maxSteps}`;
    }
  }

  private updateQuestionInfo(): void {
    const nameEl = this.container.querySelector('#question-name');
    const descEl = this.container.querySelector('#question-desc');

    if (nameEl && this.state.currentQuestion) {
      nameEl.textContent = this.state.currentQuestion.name;
    }
    if (descEl && this.state.currentQuestion) {
      descEl.textContent = this.state.currentQuestion.description;
    }
  }

  private showMessage(message: string, type: 'info' | 'success' | 'error'): void {
    const resultEl = this.container.querySelector('#result-message') as HTMLElement;
    if (resultEl) {
      resultEl.textContent = message;
      resultEl.className = `result-message ${type}`;
      resultEl.style.display = 'block';
    }
  }

  private hideMessage(): void {
    const resultEl = this.container.querySelector('#result-message') as HTMLElement;
    if (resultEl) {
      resultEl.style.display = 'none';
    }
  }

  private updateWrongCountBadge(): void {
    if (!this.wrongCountBadge) return;
    const count = this.wrongQuestionManager.getWrongCount();
    if (count > 0) {
      this.wrongCountBadge.textContent = String(count);
      this.wrongCountBadge.style.display = 'inline-flex';
    } else {
      this.wrongCountBadge.style.display = 'none';
    }
  }

  private openWrongList(): void {
    this.renderWrongList();
    if (this.modalOverlay) {
      this.modalOverlay.style.display = 'flex';
    }
  }

  private closeWrongList(): void {
    if (this.modalOverlay) {
      this.modalOverlay.style.display = 'none';
    }
  }

  private renderWrongList(): void {
    if (!this.wrongListContainer) return;

    const records = this.wrongQuestionManager.getRecords();
    const summaryEl = this.container.querySelector('#wrong-list-summary');
    if (summaryEl) {
      summaryEl.textContent = `共 ${records.length} 道错题`;
    }

    if (records.length === 0) {
      this.wrongListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-title">太棒了！</div>
          <div class="empty-desc">暂无错题，继续保持！</div>
        </div>
      `;
      return;
    }

    this.wrongListContainer.innerHTML = '';

    records.forEach((record) => {
      const question = this.wrongQuestionManager.getQuestionById(record.questionId);
      if (!question) return;

      const card = document.createElement('div');
      card.className = 'wrong-item';

      const difficultyStars = '⭐'.repeat(question.difficulty);
      const lastWrongModelName = this.wrongQuestionManager.getModelName(record.lastWrongModelId);
      const correctModelName = this.wrongQuestionManager.getModelName(question.correctModelId);

      card.innerHTML = `
        <div class="wrong-item-header">
          <div class="wrong-item-title">
            <span class="wrong-item-name">${question.name}</span>
            <span class="wrong-item-difficulty">${difficultyStars}</span>
          </div>
          <div class="wrong-item-count">
            <span class="count-badge">❌ 答错 ${record.wrongCount} 次</span>
          </div>
        </div>
        <div class="wrong-item-desc">${question.description}</div>
        <div class="wrong-item-details">
          <div class="detail-row">
            <span class="detail-label">上次错选：</span>
            <span class="detail-value wrong">${lastWrongModelName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">正确答案：</span>
            <span class="detail-value correct">${correctModelName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">最近答错：</span>
            <span class="detail-value">${this.wrongQuestionManager.formatTime(record.lastWrongTime)}</span>
          </div>
        </div>
        <div class="wrong-item-actions">
          <button class="btn btn-review" data-question-id="${record.questionId}">🔄 重新挑战</button>
          <button class="btn btn-remove" data-question-id="${record.questionId}">🗑️ 移除</button>
        </div>
      `;

      this.wrongListContainer?.appendChild(card);
    });

    this.wrongListContainer.querySelectorAll('.btn-review').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = (e.target as HTMLElement).dataset.questionId;
        if (questionId) {
          this.startReviewMode([questionId]);
        }
      });
    });

    this.wrongListContainer.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = (e.target as HTMLElement).dataset.questionId;
        if (questionId) {
          this.wrongQuestionManager.removeRecord(questionId);
          this.updateWrongCountBadge();
          this.renderWrongList();
        }
      });
    });
  }

  private clearAllWrongQuestions(): void {
    if (confirm('确定要清空所有错题吗？')) {
      this.wrongQuestionManager.clearAll();
      this.updateWrongCountBadge();
      this.renderWrongList();
    }
  }

  private startReviewMode(questionIds: string[]): void {
    this.isReviewMode = true;
    this.reviewQuestionIds = [...questionIds];
    this.reviewCurrentIndex = 0;
    this.closeWrongList();

    if (this.returnBtn) {
      this.returnBtn.style.display = 'inline-block';
    }

    this.loadQuestion(0);
  }

  private exitReviewMode(): void {
    this.isReviewMode = false;
    this.reviewQuestionIds = [];
    this.reviewCurrentIndex = 0;

    if (this.returnBtn) {
      this.returnBtn.style.display = 'none';
    }

    this.loadQuestion(this.currentQuestionIndex);
  }

  getState(): GameState {
    return { ...this.state };
  }

  destroy(): void {
    this.origamiSVG?.destroy();
    this.modelViewers.forEach(viewer => viewer.destroy());
    this.container.innerHTML = '';
  }
}
