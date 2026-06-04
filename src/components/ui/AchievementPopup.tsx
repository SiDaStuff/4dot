import { useEffect, useState } from 'react';
import type { Achievement } from '../../utils/achievements';

interface AchievementPopupProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementPopup({ achievement, onClose }: AchievementPopupProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const dismiss = () => {
      setExiting(true);
      setTimeout(onClose, 400);
    };
    const timer = setTimeout(dismiss, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onClose, 400);
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: exiting ? 'translateX(-50%) translateY(20px)' : 'translateX(-50%) translateY(0)',
        zIndex: 3000,
        background: 'linear-gradient(135deg, #2C6E49 0%, #4C956C 100%)',
        color: 'white',
        padding: '14px 24px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(44, 110, 73, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        maxWidth: 400,
        cursor: 'pointer',
        animation: exiting ? 'achievementPopOut 400ms ease-in forwards' : 'achievementPopIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        animation: exiting ? 'none' : 'achievementIconSpin 600ms ease-out',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: '#FFC9B9' }}>
          {achievement.icon}
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.8, marginBottom: 2 }}>
          Achievement Unlocked
        </div>
        <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>
          {achievement.label}
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: 2 }}>
          {achievement.description}
        </div>
      </div>
      <div style={{
        fontSize: '1.8rem',
        animation: exiting ? 'none' : 'achievementShine 2s ease-in-out infinite',
      }}>
        ✨
      </div>
    </div>
  );
}

let popupContainer: HTMLDivElement | null = null;
let activePopups: { id: string; el: HTMLDivElement }[] = [];

function ensureContainer() {
  if (!popupContainer) {
    popupContainer = document.createElement('div');
    popupContainer.id = 'achievement-popup-container';
    popupContainer.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:3000;pointer-events:none;display:flex;flex-direction:column-reverse;align-items:center;gap:8px;padding:24px;';
    document.body.appendChild(popupContainer);
  }
  return popupContainer;
}

let popupIdCounter = 0;

export function showAchievementPopup(achievement: Achievement) {
  const container = ensureContainer();
  const id = `achievement-popup-${++popupIdCounter}`;
  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.style.cssText = 'pointer-events:auto;';
  container.appendChild(wrapper);

  const root = document.createElement('div');
  wrapper.appendChild(root);

  root.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #2C6E49 0%, #4C956C 100%);
      color: white;
      padding: 14px 24px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(44, 110, 73, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 400px;
      cursor: pointer;
      animation: achievementPopIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    " data-popup-id="${id}">
      <div style="
        width: 44px; height: 44px; border-radius: 50%;
        background: rgba(255,255,255,0.15);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        animation: achievementIconSpin 600ms ease-out;
      ">
        <span class="material-symbols-outlined" style="font-size: 1.5rem; color: #FFC9B9;">${achievement.icon}</span>
      </div>
      <div style="flex:1">
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;opacity:0.8;margin-bottom:2px;">Achievement Unlocked</div>
        <div style="font-weight:700;font-size:1rem;line-height:1.2;">${achievement.label}</div>
        <div style="font-size:0.8rem;opacity:0.85;margin-top:2px;">${achievement.description}</div>
      </div>
      <div style="font-size:1.8rem;animation:achievementShine 2s ease-in-out infinite;">✨</div>
    </div>
  `;

  const entry = { id, el: wrapper };
  activePopups.push(entry);

  const popupEl = root.firstElementChild as HTMLElement;
  const dismiss = () => {
    popupEl.style.animation = 'achievementPopOut 400ms ease-in forwards';
    setTimeout(() => {
      wrapper.remove();
      activePopups = activePopups.filter(p => p.id !== id);
    }, 400);
  };

  popupEl.addEventListener('click', dismiss);
  setTimeout(dismiss, 5000);
}
