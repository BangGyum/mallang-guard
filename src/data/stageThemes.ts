export interface StageTheme {
  readonly id: 'yard' | 'grove' | 'bubble' | 'greenhouse' | 'pond' | 'terrace' | 'royal';
  readonly name: string;
  readonly floor: string;
  readonly blocked: string;
  readonly base: string;
  readonly leaf: string;
  readonly accent: string;
  readonly trim: string;
  readonly sky: readonly [string, string];
  readonly light: string;
  readonly ambient: string;
}

const STAGE_THEMES: Readonly<Record<string, StageTheme>> = {
  'stage-1': {
    id: 'yard',
    name: '햇살 마당',
    floor: '#F1D6A0',
    blocked: '#A5D983',
    base: '#AF8864',
    leaf: '#66AD5C',
    accent: '#FF9B9B',
    trim: '#FFF0BE',
    sky: ['#C7E9EE', '#F6F4DD'],
    light: '#FFF4DC',
    ambient: '#C5B7CA',
  },
  'stage-2': {
    id: 'grove',
    name: '자작나무 길',
    floor: '#E7E6CF',
    blocked: '#85BC94',
    base: '#829D83',
    leaf: '#478C72',
    accent: '#EAC586',
    trim: '#F2EEE0',
    sky: ['#C1E0D7', '#EBF4E6'],
    light: '#F0FFEB',
    ambient: '#A3BBC3',
  },
  'stage-3': {
    id: 'bubble',
    name: '방울 정원',
    floor: '#E4D6EB',
    blocked: '#96CBBF',
    base: '#9D8BAE',
    leaf: '#5E9F9B',
    accent: '#A58FE0',
    trim: '#F6E3A1',
    sky: ['#D7D5F0', '#F6EBF2'],
    light: '#FFF0FF',
    ambient: '#ADB6D5',
  },
  'stage-4': {
    id: 'greenhouse',
    name: '민트 온실',
    floor: '#E6BFA6',
    blocked: '#ABDDC2',
    base: '#B58D77',
    leaf: '#4EA688',
    accent: '#F1A47F',
    trim: '#E9F7E7',
    sky: ['#BDE5D8', '#F1F6DF'],
    light: '#F3FFE8',
    ambient: '#A8C9BB',
  },
  'stage-5': {
    id: 'pond',
    name: '푸른 연못',
    floor: '#DCD3AC',
    blocked: '#79C6D9',
    base: '#779EAE',
    leaf: '#62B59E',
    accent: '#EAA7C4',
    trim: '#D9F6F4',
    sky: ['#B7DDEB', '#E5F5F4'],
    light: '#EFFFFF',
    ambient: '#A5C3DA',
  },
  'stage-6': {
    id: 'terrace',
    name: '연회 테라스',
    floor: '#F0DCCB',
    blocked: '#D8C2AB',
    base: '#AC8F88',
    leaf: '#7FB494',
    accent: '#EA8D84',
    trim: '#FFE3A2',
    sky: ['#EDCFC5', '#FFF0DB'],
    light: '#FFF0DF',
    ambient: '#C6ABC5',
  },
  'stage-7': {
    id: 'royal',
    name: '왕실 정원',
    floor: '#F1EBD7',
    blocked: '#91CBB4',
    base: '#8AA99E',
    leaf: '#4D9A87',
    accent: '#C7A862',
    trim: '#FFF1BB',
    sky: ['#D6EAF0', '#F6F5DF'],
    light: '#FFFFEB',
    ambient: '#B7B5D1',
  },
};

export function stageThemeFor(stageId = 'stage-1'): StageTheme {
  return Object.hasOwn(STAGE_THEMES, stageId)
    ? (STAGE_THEMES[stageId] as StageTheme)
    : (STAGE_THEMES['stage-1'] as StageTheme);
}
