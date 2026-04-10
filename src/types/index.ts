/**
 * 前后端共享类型（对应 src-tauri/src/types/*.rs）
 *
 * 规则：字段名必须与 Rust 结构体序列化后的 JSON 保持一致。
 * Rust 侧用 serde 默认命名策略（snake_case），故这里也用 snake_case。
 */

// ============================================================================
// Profile
// ============================================================================

export type SocialTendency = "introvert" | "neutral" | "extrovert";
export type FinancialStatus = "broke" | "saving" | "stable" | "debt";

export interface UserProfile {
  id: string;
  created_at: string;
  updated_at: string;

  occupation: string;
  habits: string[];
  social_tendency: SocialTendency;
  financial_status: FinancialStatus;
  personality_tags: string[];
  relationship_status: string;

  health_status?: string | null;
  family_background?: string | null;
  location?: string | null;
  core_fears: string[];
  dreams: string[];

  hidden_tags: string[];

  language: string;
  profile_version: number;
}

export interface UserProfileDraft {
  occupation: string;
  habits: string[];
  social_tendency: SocialTendency;
  financial_status: FinancialStatus;
  personality_tags: string[];
  relationship_status: string;

  health_status?: string | null;
  family_background?: string | null;
  location?: string | null;
  core_fears?: string[];
  dreams?: string[];

  language?: string;
}

// ============================================================================
// Emotion / Timeline
// ============================================================================

export interface EmotionDimensions {
  energy: number;
  satisfaction: number;
  regret: number;
  hope: number;
  loneliness: number;
}

export interface KeyEvent {
  year: string;
  event: string;
  emotion: "positive" | "neutral" | "negative";
}

export interface DimensionScore {
  year: number;
  career: number;
  financial: number;
  health: number;
  relationship: number;
  satisfaction: number;
}

export type TimelineType = "reality" | "parallel";

export interface Timeline {
  id: string;
  decision_id: string;
  timeline_type: TimelineType;

  narrative: string;
  emotion: EmotionDimensions;
  realism_score: number;

  key_events: KeyEvent[];
  dimension_scores: DimensionScore[];

  black_swan_event?: string | null;
}

// ============================================================================
// Decision / Simulation
// ============================================================================

export type TimeHorizon = "1y" | "3y" | "5y" | "10y";

export interface SimulateInput {
  decision_text: string;
  context?: string;
  time_horizon: TimeHorizon;
  drama_level: 1 | 2 | 3 | 4;
  black_swan_enabled?: boolean;
  anchor_timeline_id?: string;
}

export interface DecisionRecord {
  id: string;
  profile_id: string;
  created_at: string;

  decision_text: string;
  time_horizon: string;
  context?: string | null;

  drama_level: number;
  black_swan_enabled: boolean;

  is_anchored: boolean;
  anchored_at?: string | null;

  emotion_snapshot: EmotionDimensions;
}

export interface SimulationResult {
  decision_id: string;
  timelines: Timeline[];
  letter?: string | null;
  decision_tree?: unknown;
  life_chart?: unknown;
}

// ============================================================================
// Settings
// ============================================================================

export interface AppSettings {
  language: string;
  drama_level: number;
  black_swan_enabled: boolean;
  safety_valve_enabled: boolean;
  active_model_id: string;
  update_check_frequency: string;
  last_update_check?: string | null;
  audio_enabled: boolean;
  daily_simulation_count: number;
  last_simulation_date?: string | null;
}

export interface AppSettingsPatch {
  language?: string;
  drama_level?: number;
  black_swan_enabled?: boolean;
  safety_valve_enabled?: boolean;
  active_model_id?: string;
  update_check_frequency?: string;
  audio_enabled?: boolean;
}
