export interface Team {
  id: string;
  name: string;
  color: string;
}

// KBO 10개 구단 (구단명 + 대표색). 로고·유니폼·실제 선수는 사용하지 않음.
// TODO(CLAUDE.md 다음 할 일 1): 가상 팀 프리셋으로 교체.
export const TEAMS: Team[] = [
  { id: 'doosan', name: '두산 베어스', color: '#131230' },
  { id: 'lg', name: 'LG 트윈스', color: '#c30452' },
  { id: 'kia', name: 'KIA 타이거즈', color: '#ea0029' },
  { id: 'samsung', name: '삼성 라이온즈', color: '#074ca1' },
  { id: 'lotte', name: '롯데 자이언츠', color: '#041e42' },
  { id: 'hanwha', name: '한화 이글스', color: '#fc4e00' },
  { id: 'ssg', name: 'SSG 랜더스', color: '#ce0e2d' },
  { id: 'kt', name: 'KT 위즈', color: '#2a2a2a' },
  { id: 'nc', name: 'NC 다이노스', color: '#315288' },
  { id: 'kiwoom', name: '키움 히어로즈', color: '#570514' },
];

export const findTeam = (id: string | null | undefined): Team =>
  TEAMS.find((t) => t.id === id) ?? TEAMS[0];
