import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from './config/themes';
import { loadVocab, loadGroupDetail } from './data/loadVocab';
import { useProgress } from './state/useProgress';
import {
  computeLevelStates,
  dueCount,
  dueReviewIds,
  nextEnterableGroup,
  starsFor,
  summarize,
  xpFor,
} from './state/progress';
import { buildQuiz, tallyResult } from './game/quiz';
import { speak } from './lib/speech';
import { shuffle } from './lib/shuffle';

import LevelSelect from './screens/LevelSelect'; // 首屏：保持同步导入，避免首次白屏
import ReviewScreen from './screens/ReviewScreen';
import ReadingScreen from './screens/ReadingScreen';
import TabBar from './components/TabBar';
import { loadPassages, addPassage, addPassagesBulk, parseBulk, removePassage, markStudied } from './lib/passages';
import { loadDict, dictEntry } from './lib/dict';
import LoginScreen from './screens/LoginScreen';
import { isAuthed, logout } from './lib/auth';
import ConfirmDialog from './components/ConfirmDialog';

import type { Word, Level, Question, Passage } from './types';
import type { VocabPack, GroupDetail } from './data/loadVocab';
import type { Result } from './screens/ResultScreen';
import type { ReviewItem } from './screens/ReviewSession';
import { isLearningTier, LEECH_LAPSES, type ExportFilter } from './lib/stats';

// 其余 screen 按需懒加载，减小首屏 JS；挂载后空闲再预取(见下方 warm 副作用)，保证离线可用
const LearnScreen = lazy(() => import('./screens/LearnScreen'));
const QuizScreen = lazy(() => import('./screens/QuizScreen'));
const ResultScreen = lazy(() => import('./screens/ResultScreen'));
const ReviewSession = lazy(() => import('./screens/ReviewSession'));
const MatchScreen = lazy(() => import('./screens/MatchScreen'));
const ReadScreen = lazy(() => import('./screens/ReadScreen'));
const ClozeScreen = lazy(() => import('./screens/ClozeScreen'));
const PassageScreen = lazy(() => import('./screens/PassageScreen'));
const SearchScreen = lazy(() => import('./screens/SearchScreen'));
const StatsScreen = lazy(() => import('./screens/StatsScreen'));
const PrintView = lazy(() => import('./screens/PrintView'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));

const REVIEW_LIMIT = 30; // 每轮间隔复习最多词数

type TabKey = 'levels' | 'review' | 'reading' | 'stats';
type View =
  | TabKey
  | 'learn'
  | 'quiz'
  | 'result'
  | 'reviewSession'
  | 'match'
  | 'read'
  | 'cloze'
  | 'passages'
  | 'browse'
  | 'search';
type VocabState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | ({ status: 'ready' } & VocabPack);
interface BrowseCtx {
  words: Word[];
  title: string;
  ret: View;
}

export default function App() {
  const { progress, setTheme, finishLevel, reviewGrade, addXp, recordStudy, setGoal, setPref, markWrong, resetAll } =
    useProgress();
  const theme = getTheme(progress.themeKey);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authed, setAuthed] = useState(isAuthed);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tab, setTab] = useState<TabKey>('levels'); // 底部主标签：levels|review|reading|stats

  // —— 词库加载 ——
  const [vocab, setVocab] = useState<VocabState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadVocab()
      .then((data) => alive && setVocab({ status: 'ready', ...data }))
      .catch((err) => alive && setVocab({ status: 'error', error: err }));
    return () => {
      alive = false;
    };
  }, []);

  // —— 画风需要的额外字体(可选 fontHref)动态注入 ——
  useEffect(() => {
    const href = theme.fontHref;
    if (!href || document.querySelector(`link[data-theme-font="${theme.key}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-theme-font', theme.key);
    document.head.appendChild(link);
  }, [theme]);

  // —— 手机状态栏颜色跟随画风 ——
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.vars['--bg2'] || '#0c0c12');
  }, [theme]);

  // —— 导航 ——
  const [view, setView] = useState<View>('levels'); // levels | learn | quiz | result | reviewSession | …
  const [group, setGroup] = useState<number | null>(null);
  const [sessionWords, setSessionWords] = useState<Word[]>([]); // 本次进关打乱后的 10 词
  const [questions, setQuestions] = useState<Question[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]); // 本轮间隔复习的词 + FSRS 卡
  const [justUnlocked, setJustUnlocked] = useState<number | null>(null); // 刚解锁的关卡(用于高亮动画)
  const [browseCtx, setBrowseCtx] = useState<BrowseCtx | null>(null); // 浏览模式 { words, title, ret }
  const [passages, setPassages] = useState<Passage[]>([]); // 真题阅读关卡库(本机)
  const [activePassage, setActivePassage] = useState<Passage | null>(null); // 正在精读的篇目
  const [printData, setPrintData] = useState<{ title: string; words: Word[] } | null>(null); // PDF 导出覆盖层
  useEffect(() => { let alive = true; loadPassages().then((p) => alive && setPassages(p)); return () => { alive = false; }; }, []);

  // 首屏渲染后、空闲时预取其余 screen 分包 → 进 SW 缓存，离线也能直接打开任意页
  useEffect(() => {
    const warm = () => {
      import('./screens/LearnScreen');
      import('./screens/QuizScreen');
      import('./screens/ResultScreen');
      import('./screens/ReviewSession');
      import('./screens/MatchScreen');
      import('./screens/ReadScreen');
      import('./screens/ClozeScreen');
      import('./screens/PassageScreen');
      import('./screens/SearchScreen');
      import('./screens/StatsScreen');
      import('./components/SettingsPanel');
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(warm);
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 1500);
    return () => clearTimeout(t);
  }, []);

  const levels: Level[] = vocab.status === 'ready' ? vocab.levels : [];
  const byId = vocab.status === 'ready' ? vocab.byId : new Map<number | string, Word>();
  // 词条查找：兼容 id 为数字/字符串(错词池的 key 是字符串)
  const getWord = (id: number | string): Word | null | undefined => {
    const core = byId.get(id) ?? byId.get(Number(id)) ?? byId.get(String(id));
    if (core) return core;
    if (typeof id === 'string' && id.startsWith('d:')) return dictEntry(id.slice(2)); // 词典词(供错词本/复习解析)
    return undefined;
  };

  const levelStates = useMemo(() => computeLevelStates(levels, progress), [levels, progress]);
  const summary = useMemo(() => summarize(levels, progress), [levels, progress]);
  const reviewDue = useMemo(() => dueCount(progress), [progress]);
  const allReady = useMemo(() => levels.flatMap((l) => l.readyWords), [levels]);

  const currentLevel = useMemo(
    () => levels.find((l) => l.group === group) || null,
    [levels, group]
  );

  // —— 懒加载富字段：进关/浏览时按 group 拉取并合并 ——
  const richCache = useRef<Map<number, GroupDetail>>(new Map()); // group -> { id: rich }
  const hydrate = async (words: Word[]): Promise<Word[]> => {
    const lazy = vocab.status === 'ready' && !!vocab.lazy;
    if (!lazy || !words || !words.length) return words;
    const groups = [...new Set(words.map((w) => w.group).filter((g): g is number => g != null))];
    await Promise.all(
      groups.map(async (g) => {
        if (richCache.current.has(g)) return;
        try {
          richCache.current.set(g, await loadGroupDetail(g));
        } catch {
          richCache.current.set(g, {});
        }
      })
    );
    return words.map((w) => {
      const rich = w.group != null ? richCache.current.get(w.group) : undefined;
      return rich && rich[w.id] ? { ...w, ...rich[w.id] } : w;
    });
  };
  const enterTok = useRef(0); // 防止快速切关时旧的 hydrate 覆盖新会话
  const browseTok = useRef(0);
  // 单词补齐富字段(真题精读点词弹卡用)
  const hydrateWord = async (entry: Word): Promise<Word> => {
    if (!entry || entry._dict) return entry; // 词典词无富字段，直接用
    const [h] = await hydrate([entry]);
    return h || entry;
  };

  // —— 流程处理 ——
  const onSpeak = (text: string) => {
    if (progress.sound === false) return;
    speak(text, progress.accent === 'uk' ? 'en-GB' : 'en-US');
  };

  const handleReset = () => { setSettingsOpen(false); setConfirmReset(true); };
  const doReset = () => { resetAll(); setConfirmReset(false); };

  // 进入某一关：打乱该关 10 词，先用轻量数据秒开，再补齐富字段(懒加载)
  const enterLevel = (g: number) => {
    const lvl = levels.find((l) => l.group === g);
    if (!lvl) return;
    setJustUnlocked(null);
    const words = shuffle(lvl.readyWords);
    setGroup(g);
    setSessionWords(words);
    setView('learn');
    const tok = ++enterTok.current;
    hydrate(words).then((h) => {
      if (enterTok.current === tok) setSessionWords(h);
    });
  };

  const pickLevel = (g: number) => enterLevel(g);

  const startQuiz = () => {
    const words = sessionWords.length ? sessionWords : currentLevel?.readyWords;
    if (!words || !words.length) return;
    setQuestions(buildQuiz(words, allReady));
    setView('quiz');
  };

  // 间隔复习(FSRS)：取今日到期的错词，补齐富字段后进入四档自评复习
  const startReview = async () => {
    const ids = dueReviewIds(progress);
    if (!ids.length) return;
    // 错词本里若有词典词(d: 前缀)，先确保词典加载，getWord 才能解析
    if (ids.some((id) => typeof id === 'string' && id.startsWith('d:'))) await loadDict();
    const words = ids.map(getWord).filter(Boolean) as Word[];
    const hydrated = await hydrate(words);
    const items: ReviewItem[] = shuffle(hydrated)
      .slice(0, REVIEW_LIMIT)
      .map((w) => ({ word: w, card: progress.wrong[String(w.id)]?.card }));
    if (!items.length) return;
    setReviewItems(items);
    setView('reviewSession');
  };

  // 间隔复习结束：按复习词数给 XP + 计入打卡，返回复习页
  const finishReview = (reviewed: number) => {
    if (reviewed > 0) {
      addXp(reviewed * 2);
      recordStudy(reviewed);
    }
    goHome();
  };

  // —— 统计：改考试日 / 导出 PDF ——
  const onExamDate = (iso: string) => setPref('examDate', iso);
  const EXPORT_LABELS: Record<ExportFilter, string> = {
    'wrong-all': '错词本 · 全部',
    leech: '困难词（易错）',
    learning: '错词 · 学习中',
    familiar: '错词 · 熟悉',
    due: '即将到期（错词）',
    'learned-all': '全部已学单词',
  };
  const onExport = async (filter: ExportFilter) => {
    let words: Word[] = [];
    if (filter === 'learned-all') {
      words = levels.filter((l) => progress.levels[l.group]?.completed).flatMap((l) => l.readyWords);
    } else {
      const now = Date.now();
      const ids = Object.entries(progress.wrong)
        .filter(([, e]) => {
          const c = e.card;
          if (!c) return filter === 'wrong-all';
          if (filter === 'leech') return (c.lapses || 0) >= LEECH_LAPSES;
          if (filter === 'learning') return isLearningTier(c);
          if (filter === 'familiar') return !isLearningTier(c);
          if (filter === 'due') return new Date(c.due).getTime() <= now + 2 * 86400000; // 含今天 + 2 天
          return true; // wrong-all
        })
        .map(([id]) => id);
      if (ids.some((id) => id.startsWith('d:'))) await loadDict();
      words = ids.map(getWord).filter(Boolean) as Word[];
    }
    if (!words.length) return;
    const hydrated = await hydrate(words);
    setPrintData({ title: EXPORT_LABELS[filter], words: hydrated });
  };

  const completeQuiz = (flags: boolean[]) => {
    const tally = tallyResult(questions, flags); // { correct, total, wrongIds, correctIds }
    const stars = starsFor(tally.correct, tally.total);
    const xpGain = xpFor(tally.correct, stars);
    const wrongWords = tally.wrongIds.map(getWord).filter(Boolean) as Word[];
    recordStudy(tally.total); // 计入今日学习词数 / 打卡

    const comboAfter = stars >= 1 ? progress.combo + 1 : 0;
    finishLevel({
      group: group!,
      correct: tally.correct,
      total: tally.total,
      stars,
      xpGain,
      wrongIds: tally.wrongIds,
      correctIds: tally.correctIds,
    });
    // 本关通关后，下一关若是新解锁则标记，回到关卡页时高亮
    if (stars >= 1) {
      const ng = nextEnterableGroup(levelStates, group!);
      if (ng != null && !(progress.levels[ng] && progress.levels[ng].completed)) {
        setJustUnlocked(ng);
      }
    }
    setResult({ ...tally, stars, xpGain, wrongWords, comboAfter, mode: 'level' });
    setView('result');
  };

  const startMatch = () => setView('match');
  const startRead = () => setView('read');
  const startCloze = () => { setActivePassage(null); setView('cloze'); };
  const openSearch = () => setView('search');

  // —— 真题阅读关卡库 ——
  const openPassages = () => setView('passages');
  const backToPassages = () => { setActivePassage(null); setView('passages'); };
  const openPassage = (p: Passage) => { setActivePassage(p); setView('cloze'); };
  const importPassage = (title: string, en: string, cn: string) => { addPassage(title, en, cn); loadPassages().then(setPassages); };
  const bulkImportPassages = (text: string) => { addPassagesBulk(parseBulk(text)); loadPassages().then(setPassages); };
  const deletePassage = (id: string) => { removePassage(id); loadPassages().then(setPassages); };
  const finishPassage = (p: Passage) => {
    markStudied(p.id);
    loadPassages().then(setPassages);
    addXp(20);
    recordStudy(p.sents.length);
    backToPassages();
  };

  // 浏览模式：只翻词卡，不测验。先显示轻量卡，再懒加载富字段补齐分层。
  const startBrowse = (words: Word[], title: string, ret?: View) => {
    if (!words || !words.length) return;
    const tok = ++browseTok.current;
    setBrowseCtx({ words, title, ret: ret || tab });
    setView('browse');
    hydrate(words).then((h) => {
      if (browseTok.current === tok) setBrowseCtx((prev) => (prev ? { ...prev, words: h } : prev));
    });
  };
  const endBrowse = () => setView(browseCtx?.ret || tab);
  const browseWrong = () => {
    const pool = Object.keys(progress.wrong).map(getWord).filter(Boolean) as Word[];
    startBrowse(pool, '错词本', tab);
  };

  const goHome = () => {
    setView(tab); // 深层流程返回当前所在的主标签
    setGroup(null);
  };
  const replay = () => { if (group != null) enterLevel(group); }; // 再学一次：同一关，重新打乱
  const nextGroup = group != null ? nextEnterableGroup(levelStates, group) : null;
  const goNext = () => {
    if (nextGroup == null) return goHome();
    enterLevel(nextGroup);
  };

  // —— 渲染 ——
  let screen: React.ReactNode;
  if (!authed) {
    screen = <LoginScreen onSuccess={() => setAuthed(true)} />;
  } else if (vocab.status === 'loading') {
    screen = <div className="center label" style={{ paddingTop: 120 }}>词库加载中…</div>;
  } else if (vocab.status === 'error') {
    screen = (
      <div className="center label" style={{ paddingTop: 100 }}>
        词库加载失败 😢
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>{String((vocab.error as Error)?.message || vocab.error)}</div>
      </div>
    );
  } else if (view === 'learn' && currentLevel) {
    screen = (
      <LearnScreen
        words={sessionWords.length ? sessionWords : currentLevel.readyWords}
        group={group}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onStart={startQuiz}
        onSpeak={onSpeak}
        onMarkWrong={markWrong}
      />
    );
  } else if (view === 'quiz' && questions.length) {
    screen = (
      <QuizScreen
        questions={questions}
        group={group}
        pool={allReady}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onComplete={completeQuiz}
        onSpeak={onSpeak}
      />
    );
  } else if (view === 'reviewSession') {
    screen = (
      <ReviewSession
        items={reviewItems}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onGrade={reviewGrade}
        onFinish={finishReview}
        onSpeak={onSpeak}
      />
    );
  } else if (view === 'match') {
    screen = (
      <MatchScreen
        pool={allReady}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onReward={addXp}
        onStudied={recordStudy}
      />
    );
  } else if (view === 'read') {
    screen = (
      <ReadScreen
        pool={allReady}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onSpeak={onSpeak}
        onMarkWrong={markWrong}
        hydrateWord={hydrateWord}
      />
    );
  } else if (view === 'cloze') {
    screen = (
      <ClozeScreen
        pool={allReady}
        sentences={activePassage ? activePassage.sents : undefined}
        title={activePassage ? activePassage.title : undefined}
        onDone={activePassage ? () => finishPassage(activePassage) : undefined}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={activePassage ? backToPassages : goHome}
        onSpeak={onSpeak}
        onMarkWrong={markWrong}
        hydrateWord={hydrateWord}
      />
    );
  } else if (view === 'passages') {
    screen = (
      <PassageScreen
        passages={passages}
        pool={allReady}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onOpen={openPassage}
        onImport={importPassage}
        onBulkImport={bulkImportPassages}
        onDelete={deletePassage}
      />
    );
  } else if (view === 'browse' && browseCtx) {
    screen = (
      <LearnScreen
        mode="browse"
        words={browseCtx.words}
        title={browseCtx.title}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={endBrowse}
        onStart={endBrowse}
        onSpeak={onSpeak}
      />
    );
  } else if (view === 'result' && result) {
    screen = (
      <ResultScreen
        result={result}
        group={group}
        themeKey={theme.key}
        onTheme={setTheme}
        onReplay={replay}
        onNext={goNext}
        onHome={goHome}
        hasNext={nextGroup != null}
        onBrowse={() => startBrowse(sessionWords, `第 ${group} 关`, 'result')}
      />
    );
  } else if (view === 'search') {
    screen = (
      <SearchScreen
        pool={allReady}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onSpeak={onSpeak}
        onMarkWrong={markWrong}
        hydrateWord={hydrateWord}
      />
    );
  } else if (view === 'review') {
    screen = (
      <ReviewScreen
        themeKey={theme.key}
        onTheme={setTheme}
        reviewDue={reviewDue}
        wrongCount={summary.wrongCount}
        onReview={startReview}
        onBrowseWrong={browseWrong}
        onMatch={startMatch}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  } else if (view === 'reading') {
    screen = (
      <ReadingScreen
        themeKey={theme.key}
        onTheme={setTheme}
        onPassages={openPassages}
        onRead={startRead}
        onCloze={startCloze}
        onSearch={openSearch}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    );
  } else if (view === 'stats') {
    screen = (
      <StatsScreen
        progress={progress}
        summary={summary}
        themeKey={theme.key}
        onTheme={setTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onExamDate={onExamDate}
        onExport={onExport}
      />
    );
  } else {
    screen = (
      <LevelSelect
        levelStates={levelStates}
        progress={progress}
        summary={summary}
        themeKey={theme.key}
        onTheme={setTheme}
        onPick={pickLevel}
        onSetGoal={setGoal}
        onOpenSettings={() => setSettingsOpen(true)}
        justUnlocked={justUnlocked}
      />
    );
  }

  const showTabBar = authed && vocab.status === 'ready' && ['levels', 'review', 'reading', 'stats'].includes(view);

  return (
    <div className="page">
      <div className={'vg' + (showTabBar ? ' has-tabbar' : '')} style={theme.vars} data-theme={theme.key}>
        {theme.Deco && <theme.Deco />}
        <div className="vg__content">
          <Suspense fallback={<div className="center label" style={{ paddingTop: 120 }}>加载中…</div>}>
            {screen}
          </Suspense>
        </div>
        {showTabBar && <TabBar tab={tab} onTab={(k) => { setTab(k); setView(k); setGroup(null); }} />}
        {settingsOpen && (
          <Suspense fallback={null}>
            <SettingsPanel
              progress={progress}
              onClose={() => setSettingsOpen(false)}
              onSetPref={setPref}
              onSetGoal={setGoal}
              onReset={handleReset}
              onLogout={() => { logout(); setAuthed(false); setSettingsOpen(false); }}
            />
          </Suspense>
        )}
        {confirmReset && (
          <ConfirmDialog
            danger
            title="重置全部进度？"
            message="XP / 通关 / 错词本将被清空（画风保留）。此操作无法撤销。"
            confirmText="重置"
            cancelText="取消"
            onConfirm={doReset}
            onCancel={() => setConfirmReset(false)}
          />
        )}
      </div>
      {printData && (
        <Suspense fallback={null}>
          <PrintView title={printData.title} words={printData.words} onClose={() => setPrintData(null)} />
        </Suspense>
      )}
    </div>
  );
}
