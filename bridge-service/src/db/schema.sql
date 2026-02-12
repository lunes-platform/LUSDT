-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    source_chain VARCHAR(50) NOT NULL,
    destination_chain VARCHAR(50) NOT NULL,
    source_signature VARCHAR(255) NOT NULL,
    destination_signature VARCHAR(255),
    amount DECIMAL(20, 6) NOT NULL,
    source_address VARCHAR(255) NOT NULL,
    destination_address VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

-- Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_source_signature ON transactions(source_signature);
CREATE INDEX IF NOT EXISTS idx_transactions_destination_signature ON transactions(destination_signature);

-- Statistics View (optional, allows easier querying of stats)
CREATE OR REPLACE VIEW transaction_stats AS
SELECT
    COUNT(*) AS total_transactions,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_transactions,
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) AS pending_transactions,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_transactions,
    COALESCE(SUM(amount), 0) AS total_volume_usdt,
    COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0) AS daily_volume,
    COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) AS weekly_volume,
    COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS monthly_volume
FROM transactions;
