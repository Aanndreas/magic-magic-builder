export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MTGFormat = "commander" | "standard" | "pauper" | "modern" | "pioneer" | "legacy";

export type Database = {
  public: {
    Tables: {
      collection_cards: {
        Row: {
          id: string;
          user_id: string;
          scryfall_id: string;
          card_name: string;
          quantity: number;
          foil: boolean;
          set_code: string | null;
          collector_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["collection_cards"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["collection_cards"]["Insert"]>;
      };
      meta_decks: {
        Row: {
          id: string;
          format: MTGFormat;
          deck_name: string;
          archetype: string;
          source: string;
          source_url: string | null;
          win_rate: number | null;
          popularity: number | null;
          cards: Json;
          fetched_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["meta_decks"]["Row"], "id" | "fetched_at">;
        Update: Partial<Database["public"]["Tables"]["meta_decks"]["Insert"]>;
      };
      saved_recommendations: {
        Row: {
          id: string;
          user_id: string;
          format: MTGFormat;
          deck_name: string;
          already_have: Json;
          cards_to_buy_budget: Json;
          cards_to_buy_full: Json;
          meta_deck_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["saved_recommendations"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["saved_recommendations"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      mtg_format: MTGFormat;
    };
  };
};

export type CollectionCard = Database["public"]["Tables"]["collection_cards"]["Row"];
export type MetaDeck = Database["public"]["Tables"]["meta_decks"]["Row"];
export type SavedRecommendation = Database["public"]["Tables"]["saved_recommendations"]["Row"];

export interface DeckCard {
  name: string;
  quantity: number;
  scryfall_id?: string;
  price_usd?: number;
}

export interface DeckRecommendation {
  metaDeck: MetaDeck;
  alreadyHave: DeckCard[];
  alreadyHaveCount: number;
  totalCards: number;
  coveragePercent: number;
  budgetUpgrade: {
    cards: DeckCard[];
    totalCost: number;
    newCoveragePercent: number;
  };
  fullNetdeck: {
    cards: DeckCard[];
    totalCost: number;
  };
}
