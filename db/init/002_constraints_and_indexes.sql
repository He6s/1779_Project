ALTER TABLE activity_log
ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'splits_split_type_check'
	) THEN
		ALTER TABLE splits
		ADD CONSTRAINT splits_split_type_check
		CHECK (split_type IN ('equal', 'percentage', 'exact'));
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'expenses_amount_positive_check'
	) THEN
		ALTER TABLE expenses
		ADD CONSTRAINT expenses_amount_positive_check
		CHECK (amount_cents > 0);
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'settlements_amount_positive_check'
	) THEN
		ALTER TABLE settlements
		ADD CONSTRAINT settlements_amount_positive_check
		CHECK (amount_cents > 0);
	END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_group_id ON activity_log(group_id);
