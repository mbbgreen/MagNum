import React from 'react';
import { SlidersHorizontal, Bug, Layers, MessageSquare } from 'lucide-react';
import { Language } from '../i18n/translations';

export interface SkillDef {
  id: string;
  name: string;
  nameFa: string;
  desc: string;
  descFa: string;
  color: string;
  icon: React.ReactNode;
}

export const SKILLS: SkillDef[] = [
  { id: 'plan', name: 'Plan', nameFa: 'برنامه‌ریزی', desc: 'Generate an implementation plan', descFa: 'تهیه نقشه و برنامه پیاده‌سازی', color: '#f59e0b', icon: <SlidersHorizontal size={13} /> },
  { id: 'debug', name: 'Debug', nameFa: 'خطایابی', desc: 'Pinpoint the root cause of an issue', descFa: 'یافتن ریشه دقیق خطا و مشکل', color: '#f43f5e', icon: <Bug size={13} /> },
  { id: 'multitask', name: 'Multitask', nameFa: 'چندوظیفه‌ای', desc: 'Orchestrate multiple subagents in parallel', descFa: 'هماهنگی و اجرای هم‌زمان چند وظیفه', color: '#a855f7', icon: <Layers size={13} /> },
  { id: 'ask', name: 'Ask', nameFa: 'پرسش', desc: 'Answer questions without making edits', descFa: 'پاسخ‌گویی و تحلیل کد بدون ایجاد تغییر', color: '#10b981', icon: <MessageSquare size={13} /> }
];

export const getSkill = (id?: string | null): SkillDef | null => SKILLS.find(s => s.id === id) || null;
export const getSkillText = (skill: SkillDef, lang: Language = 'en') => ({
  name: lang === 'fa' ? skill.nameFa : skill.name,
  desc: lang === 'fa' ? skill.descFa : skill.desc
});

export const SKILL_PREFIX_RE = /^\/(plan|debug|multitask|ask)\s*/i;
export const stripSkillPrefix = (text: string): string => text.replace(SKILL_PREFIX_RE, '');
export const detectSkillInText = (text: string): string | null => {
  const m = text.match(SKILL_PREFIX_RE);
  return m ? m[1].toLowerCase() : null;
};

export const SkillChip: React.FC<{ id?: string | null; size?: 'sm' | 'md'; lang?: Language }> = ({ id, size = 'md', lang = 'en' }) => {
  const skill = getSkill(id);
  if (!skill) return null;
  const label = lang === 'fa' ? skill.nameFa : skill.name;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: size === 'sm' ? '2px 7px' : '3px 9px',
      borderRadius: 8, fontSize: size === 'sm' ? 10 : 11, fontWeight: 700,
      color: skill.color, background: `${skill.color}1f`, border: `1px solid ${skill.color}66`,
      flexShrink: 0, lineHeight: 1.4
    }}>
      {skill.icon}
      <span>{label}</span>
    </span>
  );
};
