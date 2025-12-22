export type BirthInput = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
};

export type Ganji = {
  label: string; // 예: "Gye-Sa"
  stem: string;  // 예: "gye"
  branch: string; // 예: "sa"
};

export type AnimalArchetype = {
  name: string;          // Water Snake
  image: string;         // "/animals/water-snake.png"
  traits: string[];      
};

export type CharacterProfile = {
  id: string;          // unique
  title: string;       // 예: "불꽃 전략가"
  tagline: string;     // 한 줄 요약
  keywords: string[];  // 성향 키워드
  strengths: string[];
  pitfalls: string[];
  adviceTone: string;  // 시스템 프롬프트에 넣을 톤 요약
  animal: AnimalArchetype;
};