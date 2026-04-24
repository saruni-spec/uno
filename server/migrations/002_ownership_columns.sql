ALTER TABLE custom_cards
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE game_results
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_custom_cards_creator ON custom_cards(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_game_results_creator ON game_results(created_by_user_id);
