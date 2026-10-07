import { mountDialog } from './dialog';
import { button, element } from './dom';

interface Preferences {
  speed: 1 | 2;
  quality: 'high' | 'low';
  sfxVolume: number;
  reducedMotion: boolean | null;
}

export function createSettings(
  root: HTMLElement,
  initial: Preferences,
  actions: { change(value: Preferences, manualQuality: boolean): void; preview(): void; close(): void },
) {
  const settings = { ...initial };
  const dialog = element('dialog', 'game-dialog settings-menu');
  const heading = element('h2', '', '나에게 맞게');
  heading.id = 'dialog-title';
  const form = element('div', 'settings-fields');
  const volumeLabel = element('label', 'settings-volume');
  const volumeValue = element('span', '', '효과음');
  const volume = element('input', '');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = '1';
  volume.value = String(Math.round(settings.sfxVolume * 100));
  volume.setAttribute('aria-label', '효과음 볼륨');
  const soundButtons = element('div', 'settings-sound-buttons');
  const mute = button('음소거', () => {
    settings.sfxVolume = settings.sfxVolume === 0 ? 0.7 : 0;
    volume.value = String(settings.sfxVolume * 100);
    updateVolume();
  });
  function updateVolume() {
    volumeValue.textContent = `효과음 ${Math.round(settings.sfxVolume * 100)}%`;
    mute.textContent = settings.sfxVolume === 0 ? '소리 켜기' : '음소거';
    mute.setAttribute('aria-pressed', String(settings.sfxVolume === 0));
    actions.change({ ...settings }, false);
  }
  volume.addEventListener('input', () => {
    settings.sfxVolume = Number(volume.value) / 100;
    updateVolume();
  });
  volumeValue.textContent = `효과음 ${Math.round(settings.sfxVolume * 100)}%`;
  mute.textContent = settings.sfxVolume === 0 ? '소리 켜기' : '음소거';
  mute.setAttribute('aria-pressed', String(settings.sfxVolume === 0));
  volumeLabel.append(volumeValue, volume);
  soundButtons.append(mute, button('소리 확인', actions.preview));
  function select(
    label: string,
    options: readonly [string, string][],
    value: string,
    change: (value: string) => void,
  ) {
    const wrapper = element('label', '');
    const input = element('select', '');
    input.setAttribute('aria-label', label);
    for (const [key, text] of options) {
      const option = element('option', '', text);
      option.value = key;
      input.append(option);
    }
    input.value = value;
    input.addEventListener('change', () => change(input.value));
    wrapper.append(element('span', '', label), input);
    form.append(wrapper);
  }
  form.append(volumeLabel, soundButtons);
  select(
    '화면 품질',
    [
      ['high', '선명하게'],
      ['low', '가볍게'],
    ],
    settings.quality,
    (value) => {
      settings.quality = value === 'low' ? 'low' : 'high';
      actions.change({ ...settings }, true);
    },
  );
  select(
    '전투 배속',
    [
      ['1', '1배속'],
      ['2', '2배속'],
    ],
    String(settings.speed),
    (value) => {
      settings.speed = value === '2' ? 2 : 1;
      actions.change({ ...settings }, false);
    },
  );
  select(
    '움직임과 화면 흔들림',
    [
      ['system', '기기 설정에 맞춤'],
      ['reduce', '줄이기 · 흔들림 끄기'],
      ['full', '기본 움직임'],
    ],
    settings.reducedMotion === null ? 'system' : settings.reducedMotion ? 'reduce' : 'full',
    (value) => {
      settings.reducedMotion = value === 'system' ? null : value === 'reduce';
      actions.change({ ...settings }, false);
    },
  );
  dialog.append(
    heading,
    form,
    element('p', 'settings-hint', '변경한 설정은 자동으로 저장돼요.'),
    button('완료', actions.close, 'primary-button'),
  );
  return mountDialog(root, dialog, actions.close);
}
