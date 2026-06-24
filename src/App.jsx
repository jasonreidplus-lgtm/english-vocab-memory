import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from './config/themes.jsx';
import { loadVocab, loadGroupDetail } from './data/loadVocab.js';
import { useProgress } from './state/useProgress.js';
import {
  computeLevelStates,
  dueCount,
  dueReviewIds,
  nextEnterableGroup,
  starsFor,
  summarize,
  xpFor,
} from './state/progress.js';
import { buildQuiz, tallyResult } from './game/quiz.js';
import { speak } from './lib/speech.js';
import { shuffle } from './lib/shuffle.js';

import LevelSelect from './screens/LevelSelect.jsx'; // 首屏：保持同步导入，避免首次白屏
import { loadPassages, addPassage, addPassagesBulk, parseBulk, removePassage, markStudied } from './lib/passages.js';
import { loadDict, dictEntry } from './lib/dict.js';
import ConfirmDialog from './components/ConfirmDialog.jsx';

// 其余 screen 按需懒加载，减小首屏 JS；挂载后空闲再预取(见下方 warm 副作用)，保证离线可用
const LearnScreen = lazy(() => import('./screens/LearnScreen.jsx'));
const QuizScreen = lazy(() => import('./screens/QuizScreen.jsx'));
const ResultScreen = lazy(() => import('./screens/ResultScreen.jsx'));
const MatchScreen = lazy(() => import('./screens/MatchScreen.jsx'));
const ReadScreen = lazy(() => import('./screens/ReadScreen.jsx'));
const ClozeScreen = lazy(() => import('./screens/ClozeScreen.jsx'));
const PassageScreen = lazy(() => import('./screens/PassageScreen.jsx'));
const SearchScreen = lazy(() => import('./screens/SearchScreen.jsx'));
const StatsScreen = lazy(() => import('./screens/StatsScreen.jsx'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel.jsx'));

export default function App() {
  const { progress, setTheme, finishLevel, reviewComplete, addXp, recordStudy, setGoal, setPref, markWrong, resetAll } =
    useProgress();
  const theme = getTheme(progress.themeKey);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // —— 词库加载 ——
  const [vocab, setVocab] = useState({ status: 'loading' });
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
  const [view, setView] = useState('levels'); // levels | learn | quiz | result | match
  const [group, setGroup] = useState(null);
  const [sessionWords, setSessionWords] = useState([]); // 本次进关打乱后的 10 词
  const [questions, setQuestions] = useState([]);
  const [quizMode, setQuizMode] = useState('level'); // level | review
  const [result, setResult] = useState(null);
  const [justUnlocked, setJustUnlocked] = useState(null); // 刚解锁的关卡(用于高亮动画)
  const [browseCtx, setBrowseCtx] = useState(null); // 浏览模式 { words, title, ret }
  const [passages, setPassages] = useState([]); // 真题阅读关卡库(本机)
  const [activePassage, setActivePassage] = useState(null); // 正在精读的篇目
  useEffect(() => { let alive = true; loadPassages().then((p) => alive && setPassages(p)); return () => { alive = false; }; }, []);

  // 首屏渲染后、空闲时预取其余 screen 分包 → 进 SW 缓存，离线也能直接打开任意页
  useEffect(() => {
    const warm = () => {
      import('./screens/LearnScreen.jsx');
      import('./screens/QuizScreen.jsx');
      import('./screens/ResultScreen.jsx');
      import('./screens/MatchScreen.jsx');
      import('./screens/ReadScreen.jsx');
      import('./screens/ClozeScreen.jsx');
      import('./screens/PassageScreen.jsx');
      import('./screens/SearchScreen.jsx');
      import('./screens/StatsScreen.jsx');
      import('./components/SettingsPanel.jsx');
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(warm);
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 1500);
    return () => clearTimeout(t);
  }, []);

  const levels = vocab.status === 'ready' ? vocab.levels : [];
  const byId = vocab.status === 'ready' ? vocab.byId : new Map();
  // 词条查找：兼容 id 为数字/字符串(错词池的 key 是字符串)
  const getWord = (id) => {
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
  const richCache = useRef(new Map()); // group -> { id: rich }
  const hydrate = async (words) => {
    if (!vocab.lazy || !words || !words.length) return words;
    const groups = [...new Set(words.map((w) => w.group))];
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
      const rich = richCache.current.get(w.group);
      return rich && rich[w.id] ? { ...w, ...rich[w.id] } : w;
    });
  };
  const enterTok = useRef(0); // 防止快速切关时旧的 hydrate 覆盖新会话
  const browseTok = useRef(0);
  // 单词补齐富字段(真题精读点词弹卡用)
  const hydrateWord = async (entry) => {
    if (!entry || entry._dict) return entry; // 词典词无富字段，直接用
    const [h] = await hydrate([entry]);
    return h || entry;
  };

  // —— 流程处理 ——
  const onSpeak = (text) => {
    if (progress.sound === false) return;
    speak(text, progress.accent === 'uk' ? 'en-GB' : 'en-US');
  };

  const handleReset = () => { setSettingsOpen(false); setConfirmReset(true); };
  const doReset = () => { resetAll(); setConfirmReset(false); };

  // 进入某一关：打乱该关 10 词，先用轻量数据秒开，再补齐富字段(懒加载)
  const enterLevel = (g) => {
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

  const pickLevel = (g) => enterLevel(g);

  const startQuiz = () => {
    const words = sessionWords.length ? sessionWords : currentLevel?.readyWords;
    if (!words || !words.length) return;
    setQuizMode('level');
    setQuestions(buildQuiz(words, allReady, { spelling: progress.spell !== false }));
    setView('quiz');
  };

  // 间隔复习：取今日到期的错词(最多 20 词)闯关
  const startReview = async () => {
    const dueIds = dueReviewIds(progress);
    // 错词本里若有词典词(d: 前缀)，先确保词典加载，getWord 才能解析
    if (dueIds.some((id) => typeof id === 'string' && id.startsWith('d:'))) await loadDict();
    const pool = dueIds.map(getWord).filter(Boolean);
    if (!pool.length) return;
    const sessionW = shuffle(pool).slice(0, 20);
    setQuizMode('review');
    setGroup(null);
    setSessionWords(sessionW);
    setQuestions(buildQuiz(sessionW, allReady.length ? allReady : sessionW, { spelling: progress.spell !== false }));
    setView('quiz');
  };

  const completeQuiz = (flags) => {
    const tally = tallyResult(questions, flags); // { correct, total, wrongIds, correctIds }
    const stars = starsFor(tally.correct, tally.total);
    const xpGain = xpFor(tally.correct, stars);
    const wrongWords = tally.wrongIds.map(getWord).filter(Boolean);
    recordStudy(tally.total); // 计入今日学习词数 / 打卡

    if (quizMode === 'review') {
      reviewComplete({
        correctIds: tally.correctIds,
        wrongIds: tally.wrongIds,
        xpGain,
        total: tally.total,
        correct: tally.correct,
      });
      // 答对的词已升级(间隔延长/毕业)，本批都已排到将来 → 今日剩余 = 开局到期数 - 本批题数
      setResult({
        ...tally,
        stars,
        xpGain,
        wrongWords,
        mode: 'review',
        reviewAdvanced: tally.correct,
        reviewRemaining: Math.max(0, reviewDue - tally.total),
      });
      setView('result');
      return;
    }

    const comboAfter = stars >= 1 ? progress.combo + 1 : 0;
    finishLevel({
      group,
      correct: tally.correct,
      total: tally.total,
      stars,
      xpGain,
      wrongIds: tally.wrongIds,
      correctIds: tally.correctIds,
    });
    // 本关通关后，下一关若是新解锁则标记，回到关卡页时高亮
    if (stars >= 1) {
      const ng = nextEnterableGroup(levelStates, group);
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
  const openStats = () => setView('stats');

  // —— 真题阅读关卡库 ——
  const openPassages = () => setView('passages');
  const backToPassages = () => { setActivePassage(null); setView('passages'); };
  const openPassage = (p) => { setActivePassage(p); setView('cloze'); };
  const importPassage = (title, en, cn) => { addPassage(title, en, cn); loadPassages().then(setPassages); };
  const bulkImportPassages = (text) => { addPassagesBulk(parseBulk(text)); loadPassages().then(setPassages); };
  const deletePassage = (id) => { removePassage(id); loadPassages().then(setPassages); };
  const finishPassage = (p) => {
    markStudied(p.id);
    loadPassages().then(setPassages);
    addXp(20);
    recordStudy(p.sents.length);
    backToPassages();
  };

  // 浏览模式：只翻词卡，不测验。先显示轻量卡，再懒加载富字段补齐分层。
  const startBrowse = (words, title, ret) => {
    if (!words || !words.length) return;
    const tok = ++browseTok.current;
    setBrowseCtx({ words, title, ret: ret || 'levels' });
    setView('browse');
    hydrate(words).then((h) => {
      if (browseTok.current === tok) setBrowseCtx((prev) => (prev ? { ...prev, words: h } : prev));
    });
  };
  const endBrowse = () => setView(browseCtx?.ret || 'levels');
  const browseWrong = () => {
    const pool = Object.keys(progress.wrong).map(getWord).filter(Boolean);
    startBrowse(pool, '错词本', 'levels');
  };

  const goHome = () => {
    setView('levels');
    setGroup(null);
  };
  const replay = () => enterLevel(group); // 再学一次：同一关，重新打乱
  const nextGroup = group != null ? nextEnterableGroup(levelStates, group) : null;
  const goNext = () => {
    if (nextGroup == null) return goHome();
    enterLevel(nextGroup);
  };

  // —— 渲染 ——
  let screen;
  if (vocab.status === 'loading') {
    screen = <div className="center label" style={{ paddingTop: 120 }}>词库加载中…</div>;
  } else if (vocab.status === 'error') {
    screen = (
      <div className="center label" style={{ paddingTop: 100 }}>
        词库加载失败 😢
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.8 }}>{String(vocab.error?.message || vocab.error)}</div>
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
        heading={quizMode === 'review' ? '错词复习' : undefined}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
        onComplete={completeQuiz}
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
        onReplay={result.mode === 'review' ? startReview : replay}
        onNext={goNext}
        onHome={goHome}
        hasNext={nextGroup != null}
        onBrowse={() =>
          startBrowse(
            sessionWords,
            result.mode === 'review' ? '错词复习' : `第 ${group} 关`,
            'result'
          )
        }
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
  } else if (view === 'stats') {
    screen = (
      <StatsScreen
        progress={progress}
        summary={summary}
        themeKey={theme.key}
        onTheme={setTheme}
        onBack={goHome}
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
        onReview={startReview}
        onBrowseWrong={browseWrong}
        onMatch={startMatch}
        onRead={startRead}
        onCloze={startCloze}
        onPassages={openPassages}
        onSearch={openSearch}
        onStats={openStats}
        reviewDue={reviewDue}
        onSetGoal={setGoal}
        onOpenSettings={() => setSettingsOpen(true)}
        justUnlocked={justUnlocked}
      />
    );
  }

  return (
    <div className="page">
      <div className="vg" style={theme.vars} data-theme={theme.key}>
        {theme.Deco && <theme.Deco />}
        <div className="vg__content">
          <Suspense fallback={<div className="center label" style={{ paddingTop: 120 }}>加载中…</div>}>
            {screen}
          </Suspense>
        </div>
        {settingsOpen && (
          <Suspense fallback={null}>
            <SettingsPanel
              progress={progress}
              onClose={() => setSettingsOpen(false)}
              onSetPref={setPref}
              onSetGoal={setGoal}
              onReset={handleReset}
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
    </div>
  );
}
