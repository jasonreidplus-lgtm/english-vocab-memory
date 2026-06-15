import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getTheme } from './config/themes.jsx';
import { loadVocab, loadGroupDetail } from './data/loadVocab.js';
import { useProgress } from './state/useProgress.js';
import {
  computeLevelStates,
  nextEnterableGroup,
  starsFor,
  summarize,
  xpFor,
} from './state/progress.js';
import { buildQuiz, tallyResult } from './game/quiz.js';
import { speak } from './lib/speech.js';
import { shuffle } from './lib/shuffle.js';

import LevelSelect from './screens/LevelSelect.jsx';
import LearnScreen from './screens/LearnScreen.jsx';
import QuizScreen from './screens/QuizScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import ReadScreen from './screens/ReadScreen.jsx';
import ClozeScreen from './screens/ClozeScreen.jsx';
import PassageScreen from './screens/PassageScreen.jsx';
import { loadPassages, addPassage, addPassagesBulk, parseBulk, removePassage, markStudied } from './lib/passages.js';
import SettingsPanel from './components/SettingsPanel.jsx';

export default function App() {
  const { progress, setTheme, finishLevel, reviewComplete, addXp, recordStudy, setGoal, setPref, markWrong, resetAll } =
    useProgress();
  const theme = getTheme(progress.themeKey);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  useEffect(() => { setPassages(loadPassages()); }, []);

  const levels = vocab.status === 'ready' ? vocab.levels : [];
  const byId = vocab.status === 'ready' ? vocab.byId : new Map();
  // 词条查找：兼容 id 为数字/字符串(错词池的 key 是字符串)
  const getWord = (id) => byId.get(id) ?? byId.get(Number(id)) ?? byId.get(String(id));

  const levelStates = useMemo(() => computeLevelStates(levels, progress), [levels, progress]);
  const summary = useMemo(() => summarize(levels, progress), [levels, progress]);
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
    if (!entry) return entry;
    const [h] = await hydrate([entry]);
    return h || entry;
  };

  // —— 流程处理 ——
  const onSpeak = (text) => {
    if (progress.sound === false) return;
    speak(text, progress.accent === 'uk' ? 'en-GB' : 'en-US');
  };

  const handleReset = () => {
    if (window.confirm('确定要重置全部进度吗？（XP / 通关 / 错词本将清空，画风保留）')) {
      resetAll();
      setSettingsOpen(false);
    }
  };

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
    setQuestions(buildQuiz(words, allReady));
    setView('quiz');
  };

  // 错词复习：把错词池组成一组(最多 10 词)闯关
  const startReview = () => {
    const pool = Object.keys(progress.wrong).map(getWord).filter(Boolean);
    if (!pool.length) return;
    const sessionW = shuffle(pool).slice(0, 10);
    setQuizMode('review');
    setGroup(null);
    setSessionWords(sessionW);
    setQuestions(buildQuiz(sessionW, allReady.length ? allReady : sessionW));
    setView('quiz');
  };

  const completeQuiz = (flags) => {
    const tally = tallyResult(questions, flags); // { correct, total, wrongIds, correctIds }
    const stars = starsFor(tally.correct, tally.total);
    const xpGain = xpFor(tally.correct, stars);
    const wrongWords = tally.wrongIds.map(getWord).filter(Boolean);
    recordStudy(tally.total); // 计入今日学习词数 / 打卡

    if (quizMode === 'review') {
      const removed = tally.correctIds.length;
      const before = Object.keys(progress.wrong).length;
      reviewComplete({ correctIds: tally.correctIds, wrongIds: tally.wrongIds, xpGain });
      setResult({
        ...tally,
        stars,
        xpGain,
        wrongWords,
        mode: 'review',
        reviewRemoved: removed,
        reviewRemaining: Math.max(0, before - removed),
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

  // —— 真题阅读关卡库 ——
  const openPassages = () => setView('passages');
  const backToPassages = () => { setActivePassage(null); setView('passages'); };
  const openPassage = (p) => { setActivePassage(p); setView('cloze'); };
  const importPassage = (title, en, cn) => { addPassage(title, en, cn); setPassages(loadPassages()); };
  const bulkImportPassages = (text) => { addPassagesBulk(parseBulk(text)); setPassages(loadPassages()); };
  const deletePassage = (id) => { removePassage(id); setPassages(loadPassages()); };
  const finishPassage = (p) => {
    markStudied(p.id);
    setPassages(loadPassages());
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
        <div className="vg__content">{screen}</div>
        {settingsOpen && (
          <SettingsPanel
            progress={progress}
            onClose={() => setSettingsOpen(false)}
            onSetPref={setPref}
            onSetGoal={setGoal}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
