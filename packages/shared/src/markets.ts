export const MARKET_TYPES = {
  oneXTwo: "ONE_X_TWO",
  asianHandicap: "ASIAN_HANDICAP",
  correctScore: "CORRECT_SCORE"
} as const;

export const BET_WINDOW_TYPES = {
  preMatch: "PRE_MATCH",
  halfTime: "HALF_TIME"
} as const;

export const BET_STATUSES = {
  pending: "PENDING",
  won: "WON",
  lost: "LOST",
  void: "VOID",
  halfWon: "HALF_WON",
  halfLost: "HALF_LOST",
  pushed: "PUSHED"
} as const;

export type MarketType = (typeof MARKET_TYPES)[keyof typeof MARKET_TYPES];
export type BetWindowType = (typeof BET_WINDOW_TYPES)[keyof typeof BET_WINDOW_TYPES];
export type BetStatus = (typeof BET_STATUSES)[keyof typeof BET_STATUSES];

export type HandicapSettlementResult =
  | "WON"
  | "HALF_WON"
  | "PUSHED"
  | "HALF_LOST"
  | "LOST";
