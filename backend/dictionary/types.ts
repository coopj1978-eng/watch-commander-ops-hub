export type DictionaryType = "skill" | "cert";

export interface Dictionary {
  id: number;
  type: DictionaryType;
  value: string;
  active: boolean;
  created_at: Date;
}

export interface CreateDictionaryRequest {
  type: DictionaryType;
  value: string;
  active?: boolean;
}

export interface UpdateDictionaryRequest {
  value?: string;
  active?: boolean;
}
