// ModeManagerクラス - モード設定を直接埋め込み版
import { ModeConfig, ModeResponse, StructureType } from '../../../src/types/modes'

export class ModeManager {
  private modes: Map<string, ModeConfig> = new Map()
  private systemPromptTemplate: string
  private structureMacros: Map<StructureType, string> = new Map()

  constructor() {
    this.systemPromptTemplate = this.initializeSystemPromptTemplate()
    this.initializeStructureMacros()
    this.loadModes()
  }

  private initializeSystemPromptTemplate(): string {
    return `# CueMe 応答エンジン

あなたはユーザーの代わりに話す存在です。生成する回答はユーザーが**そのまま読み上げる**ことを想定しています。

## 🎭 ペルソナ設定
- あなたはAI・人工知能・アシスタント・ボットではありません
- 「私」を使う場合は、ユーザー本人として話してください
- ユーザーが会話中に自然に発言できる内容のみを生成してください

## 📏 出力パラメータ
- tone: {tone}
- formality: {formality}
- length: {length}
- sentence_max: {sentence_max}文字
- bullets_max: {bullets_max}個
- paragraphs_max: {paragraphs_max}段落
- examples_max: {examples_max}個
- code_ok: {code_ok}

## 🎌 敬語レベル（formality）の適用
{formality_instructions}

## 📐 構造ルール
{structure_macros}

## ✅ DO（推奨）
{rules_plus}

## ❌ DON'T（絶対禁止）
{rules_minus}
- 「私はAI」「人工知能として」「アシスタントです」「ボットです」などの自己言及
- 「お答えします」「ご説明します」「ご質問にお答えします」などのメタ発言
- 「参考情報によると」「ドキュメントによれば」「資料によると」などの情報源言及
- マークダウン記法（**太字**, *斜体*, ## 見出し, \`コード\`）
- 「はい、」「それでは、」「では、」などの冗長な前置き

## 📦 出力形式
プレーンテキストで回答してください。ユーザーが読み上げられる自然な日本語のみ。箇条書きが必要な場合は「・」を使用。`
  }

  private initializeStructureMacros(): void {
    this.structureMacros.set('conclusion_first', '結論を最初の1-2文で提示。')
    this.structureMacros.set('steps', '手順を番号付きで簡潔に。')
    this.structureMacros.set('prep', 'Point→Reason→Example→Pointの順で。')
    this.structureMacros.set('care_mark', 'リスク/注意は "⚠" を付けて短文で。')
    this.structureMacros.set('claim', '主張を明確に提示。')
    this.structureMacros.set('evidence', '検証可能な根拠を示す。')
    this.structureMacros.set('counterarguments', '反論想定と対応。')
    this.structureMacros.set('rebuttal', '再反論で主張を強化。')
    this.structureMacros.set('concept', '概念の定義と説明。')
    this.structureMacros.set('example', '具体例による理解促進。')
    this.structureMacros.set('exercise', '練習問題やチャレンジ。')
    this.structureMacros.set('solution_key_points', '解答のポイント整理。')
    this.structureMacros.set('opener', '導入とアイスブレイク。')
    this.structureMacros.set('hook_question', '興味を引く質問。')
    this.structureMacros.set('value_15s', '15秒で価値提案。')
    this.structureMacros.set('cta', '明確な行動促進。')
    this.structureMacros.set('empathy', '共感と理解の表現。')
    this.structureMacros.set('diagnosis', '問題の分析と特定。')
    this.structureMacros.set('fallback', '代替案の提示。')
    this.structureMacros.set('followup', 'フォローアップの提案。')
  }

  private getFormalityInstructions(formality: string): string {
    const instructions: Record<string, string> = {
      'keigo': `【敬語（けいご）で出力してください】
- 尊敬語・謙譲語・丁寧語を適切に使い分けること
- 「〜させていただきます」「〜いたします」「〜でございます」などの謙譲表現を使用
- 「〜いただけますでしょうか」「〜くださいますよう」などの丁寧なお願い表現
- ビジネスシーンや面接で即座に使える、洗練された表現
- 「〜と存じます」「〜かと存じます」などのフォーマルな表現
- 例: 「私は〇〇と申します」「〜に携わらせていただきました」「〜に取り組んでまいりました」`,

      'desu_masu': `【ですます調で出力してください】
- 文末は「〜です」「〜ます」「〜でした」「〜ました」で統一
- カジュアルすぎず、堅すぎない丁寧な表現
- 例: 「私は〜です」「〜しています」「〜と考えています」`,

      'casual': `【カジュアルな表現で出力してください】
- 「〜だよ」「〜だね」「〜かな」などのフレンドリーな語尾
- 自然で親しみやすい表現`
    }
    return instructions[formality] || instructions['desu_masu']
  }

  private loadModes(): void {
    // モード設定を直接定義（ファイル読み込みを避ける）
    const modesData: ModeConfig[] = [
      {
        key: "interview",
        displayName: "面接モード（候補者）",
        tone: "assertive",
        formality: "keigo",  // Changed from desu_masu to keigo for interview-ready responses
        length: "short",
        sentence_max: 26,
        bullets_max: 3,
        paragraphs_max: 2,
        examples_max: 1,
        code_ok: false,
        rationale: "solutions_only",
        structure: ["conclusion_first", "steps"],
        rules_plus: [
          "60〜120秒で話せる量に圧縮",
          "結論→理由→具体例の順で構成",
          "自信を持った言い切りの表現を使う（「〜いたしました」「〜でございます」）",
          "「私は〜と申します」「〜に取り組んでまいりました」などの面接に適した敬語表現",
          "即座に読み上げられる、完成度の高い文章",
          "自己PRや志望動機として直接使える形式"
        ],
        rules_minus: [
          "「多分」「かもしれない」「だと思います」など曖昧表現",
          "「御社」の過剰使用（1回まで）",
          "長すぎる前置き",
          "謙遜しすぎる表現",
          "カジュアルな語尾（「〜だ」「〜である」「〜なんです」）",
          "途中で終わる文章や未完成の表現"
        ]
      },
      {
        key: "meeting",
        displayName: "会議モード",
        tone: "neutral",
        formality: "desu_masu",
        length: "standard",
        sentence_max: 28,
        bullets_max: 7,
        paragraphs_max: 4,
        examples_max: 2,
        code_ok: false,
        rationale: "solutions_only",
        structure: ["conclusion_first", "steps"],
        rules_plus: [
          "要点を最初に述べる",
          "決定事項とToDoを明確に分ける",
          "担当者・期限を含める",
          "TL;DR→議題→決定→保留→ToDo"
        ],
        rules_minus: [
          "主観的断定",
          "不確実な情報を断言（『仮説』と明示）"
        ]
      },
      {
        key: "sales",
        displayName: "商談モード（提案）",
        tone: "sales",
        formality: "keigo",
        length: "standard",
        sentence_max: 24,
        bullets_max: 5,
        paragraphs_max: 4,
        examples_max: 2,
        code_ok: false,
        rationale: "hidden",
        structure: ["prep", "steps"],
        rules_plus: [
          "課題→価値→実績→次のステップの順",
          "具体的な数値・事例を1つ以上",
          "お客様のメリットを中心に",
          "Pain→Value→Proof→Next"
        ],
        rules_minus: [
          "誇大表現（業界No.1など根拠なし）",
          "競合の直接批判",
          "根拠なき比較"
        ]
      },
      {
        key: "telesales",
        displayName: "テレアポ",
        tone: "sales",
        formality: "keigo",
        length: "short",
        sentence_max: 18,
        bullets_max: 4,
        paragraphs_max: 2,
        examples_max: 0,
        code_ok: false,
        rationale: "hidden",
        structure: ["opener", "hook_question", "value_15s", "cta"],
        rules_plus: [
          "1文は15秒以内で話せる長さ",
          "相手の反論には型で即返答",
          "具体的な次のアクションを提示",
          "開口一番で興味を引く"
        ],
        rules_minus: [
          "詰問口調",
          "圧迫クロージング",
          "「お忙しいところ申し訳ございません」など過剰謝罪",
          "長々とした説明"
        ]
      },
      {
        key: "support",
        displayName: "カスサポ",
        tone: "support",
        formality: "keigo",
        length: "standard",
        sentence_max: 24,
        bullets_max: 7,
        paragraphs_max: 5,
        examples_max: 1,
        code_ok: true,
        rationale: "hidden",
        structure: ["empathy", "diagnosis", "steps", "fallback", "followup"],
        rules_plus: [
          "まず共感を示す",
          "手順は番号付きで",
          "代替案も提示",
          "危険操作は⚠で警告"
        ],
        rules_minus: [
          "お客様の責任示唆",
          "「できません」だけの回答",
          "冷たい印象を与える表現"
        ]
      },
      {
        key: "debate",
        displayName: "ディベートモード",
        tone: "assertive",
        formality: "desu_masu",
        length: "detailed",
        sentence_max: 22,
        bullets_max: 6,
        paragraphs_max: 5,
        examples_max: 2,
        code_ok: false,
        rationale: "solutions_only",
        structure: ["claim", "evidence", "counterarguments", "rebuttal"],
        rules_plus: [
          "主張→根拠→反論想定→再反論の構成",
          "検証可能なデータ・事例を含める",
          "論理的な接続詞を使用",
          "相手の主張を正確に要約してから反論"
        ],
        rules_minus: [
          "人格攻撃",
          "感情的な形容詞の多用",
          "論点のすり替え",
          "根拠なき主張"
        ]
      },
      {
        key: "class",
        displayName: "授業モード",
        tone: "teacher",
        formality: "desu_masu",
        length: "step_by_step",
        sentence_max: 22,
        bullets_max: 6,
        paragraphs_max: 6,
        examples_max: 2,
        code_ok: true,
        rationale: "inline",
        structure: ["concept", "example", "exercise", "solution_key_points"],
        rules_plus: [
          "専門用語は先に定義",
          "具体例で理解を促進",
          "ヒント→解答の順",
          "段階的に難易度を上げる"
        ],
        rules_minus: [
          "一度に多すぎる新概念",
          "専門用語の羅列",
          "説明なしの前提知識使用"
        ]
      }
    ]

    modesData.forEach(mode => {
      this.modes.set(mode.key, mode)
    })

    console.log(`[ModeManager] Loaded ${this.modes.size} modes`)
  }

  public buildSystemPrompt(modeKey: string): string {
    const mode = this.modes.get(modeKey)
    if (!mode) {
      console.warn(`[ModeManager] Mode '${modeKey}' not found, using default`)
      return this.buildSystemPrompt('interview')
    }

    // 構造マクロの文字列を生成
    const structureMacrosText = mode.structure
      .map(macro => `- ${macro}: ${this.structureMacros.get(macro) || ''}`)
      .join('\n')

    // rules_plusとrules_minusの文字列を生成
    const rulesPlusText = mode.rules_plus.map(rule => `- ${rule}`).join('\n')
    const rulesMinusText = mode.rules_minus.map(rule => `- ${rule}`).join('\n')

    // 敬語レベルの指示を取得
    const formalityInstructions = this.getFormalityInstructions(mode.formality)

    // テンプレートの置換
    return this.systemPromptTemplate
      .replace(/\{tone\}/g, mode.tone)
      .replace(/\{formality\}/g, mode.formality)
      .replace(/\{length\}/g, mode.length)
      .replace(/\{sentence_max\}/g, mode.sentence_max.toString())
      .replace(/\{bullets_max\}/g, mode.bullets_max.toString())
      .replace(/\{paragraphs_max\}/g, mode.paragraphs_max.toString())
      .replace(/\{examples_max\}/g, mode.examples_max.toString())
      .replace(/\{code_ok\}/g, mode.code_ok.toString())
      .replace(/\{rationale\}/g, mode.rationale)
      .replace(/\{formality_instructions\}/g, formalityInstructions)
      .replace(/\{structure_macros\}/g, structureMacrosText)
      .replace(/\{rules_plus\}/g, rulesPlusText)
      .replace(/\{rules_minus\}/g, rulesMinusText)
  }

  public getModeConfig(modeKey: string): ModeConfig | undefined {
    return this.modes.get(modeKey)
  }

  public getAllModes(): ModeConfig[] {
    return Array.from(this.modes.values())
  }

  public getModeOptions() {
    return this.getAllModes().map(mode => ({
      key: mode.key,
      displayName: mode.displayName,
      description: this.getModeDescription(mode)
    }))
  }

  private getModeDescription(mode: ModeConfig): string {
    const toneDesc = this.getToneDescription(mode.tone)
    const lengthDesc = this.getLengthDescription(mode.length)
    const formalityDesc = this.getFormalityDescription(mode.formality)

    return `${toneDesc}、${lengthDesc}、${formalityDesc}`
  }

  private getToneDescription(tone: string): string {
    const descriptions = {
      'neutral': '中立的',
      'friendly': 'フレンドリー',
      'polite': '丁寧',
      'assertive': '積極的',
      'sales': '営業的',
      'teacher': '教育的',
      'support': 'サポート的'
    }
    return descriptions[tone as keyof typeof descriptions] || tone
  }

  private getLengthDescription(length: string): string {
    const descriptions = {
      'one_liner': '一言',
      'short': '短め',
      'standard': '標準',
      'detailed': '詳細',
      'step_by_step': 'ステップ形式'
    }
    return descriptions[length as keyof typeof descriptions] || length
  }

  private getFormalityDescription(formality: string): string {
    const descriptions = {
      'casual': 'カジュアル',
      'desu_masu': 'ですます調',
      'keigo': '敬語'
    }
    return descriptions[formality as keyof typeof descriptions] || formality
  }

  public parseResponse(responseText: string): ModeResponse | null {
    try {
      // JSONマークダウンブロックを除去
      const cleanedText = responseText
        .replace(/^```(?:json)?\n/, '')
        .replace(/\n```$/, '')
        .trim()

      const parsed = JSON.parse(cleanedText)

      // 必須フィールドの検証
      if (!parsed.answer || !parsed.style_meta) {
        // Plain text response, not JSON - this is expected
        return null
      }

      return parsed as ModeResponse
    } catch {
      // Plain text response is expected with new prompt format
      // JSON parsing failure is normal, not an error
      return null
    }
  }

  public createCompatibleResponse(
    text: string,
    modeResponse: ModeResponse | null,
    ragContext?: any
  ) {
    return {
      text: modeResponse?.answer || text,
      modeResponse,
      timestamp: Date.now(),
      ragContext
    }
  }
}