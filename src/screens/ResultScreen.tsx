import React from 'react';
import { Trophy, RotateCw, ArrowRight, Home, Flame, BookOpen } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import Stars from '../components/Stars';
import type { Word } from '../types';

const PRAISE = ['再接再厉', '不错哦', '很棒！', '完美通关！'];

export interface Result {
  correct: number;
  total: number;
  stars: number;
  xpGain: number;
  wrongWords?: Word[];
  comboAfter?: number;
}

export interface ResultScreenProps {
  result: Result;
  group?: number | null;
  themeKey: string;
  onTheme: (k: string) => void;
  onReplay: () => void;
  onNext: () => void;
  onHome: () => void;
  onBrowse?: () => void;
  hasNext: boolean;
}

export default function ResultScreen({
  result,
  group,
  themeKey,
  onTheme,
  onReplay,
  onNext,
  onHome,
  onBrowse,
  hasNext,
}: ResultScreenProps) {
  const { correct, total, stars, xpGain, wrongWords = [], comboAfter = 0 } = result;

  return (
    <>
      <HeaderBar themeKey={themeKey} onTheme={onTheme} />

      <div className="center fade" style={{ paddingTop: 18 }}>
        <span className="trophy-wrap" style={{ marginBottom: 6 }}>
          {stars >= 1 && <span className="burst" />}
          <Trophy size={54} color="var(--accent)" className="pop" />
        </span>
        <div className="result-title">
          第 {group} 关 · {stars >= 1 ? '通关！' : '再来一次'}
        </div>

        <div className="stars-row">
          <Stars count={stars} size={42} pop gap={10} />
        </div>

        <div className="label" style={{ fontSize: 16 }}>
          答对 {correct} / {total} · {PRAISE[stars]}
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="badge"><Trophy size={14} color="var(--accent)" /> +{xpGain} XP</span>
          {comboAfter > 0 && (
            <span className={`badge ${comboAfter >= 2 ? 'combo-pop' : ''}`}>
              <Flame size={14} color="var(--accent)" /> 连胜 {comboAfter}
            </span>
          )}
        </div>
      </div>

      {wrongWords.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 22 }}>
            🧠 已加入复习池 · {wrongWords.length} 词
          </div>
          <div className="wrong-list">
            {wrongWords.map((w) => (
              <div key={w.id} className="wrong-item">
                <span className="w-en">{w.word}</span>
                <span className="w-cn">{w.base_meaning}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row gap10" style={{ marginTop: 22 }}>
        <button className="btn ghost grow" onClick={onReplay}>
          <RotateCw size={16} /> 再学一次
        </button>
        {hasNext ? (
          <button className="btn primary" style={{ flex: 1.4 }} onClick={onNext}>
            下一关 <ArrowRight size={17} />
          </button>
        ) : (
          <button className="btn primary" style={{ flex: 1.4 }} onClick={onHome}>
            回到关卡 <Home size={16} />
          </button>
        )}
      </div>

      <button className="btn ghost block mt12" onClick={onHome}>
        <Home size={15} /> 关卡列表
      </button>

      {onBrowse && (
        <button className="btn ghost block mt12" onClick={onBrowse}>
          <BookOpen size={15} /> 浏览这组词卡
        </button>
      )}
    </>
  );
}
