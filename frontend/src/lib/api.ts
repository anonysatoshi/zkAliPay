import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// API response types
export interface Order {
  order_id: string;
  seller: string;
  token: string;
  total_amount: string;
  remaining_amount: string;
  exchange_rate: string;
  alipay_id: string;
  alipay_name: string;
  created_at: number;
}

export interface Fill {
  order_id: string;
  seller: string;
  fill_amount: string;
  exchange_rate: string;
  alipay_id: string;
  alipay_name: string;
  token: string;
}

// Extended Fill interface used when sending to backend
export interface FillWithCNY extends Fill {
  cny_amount: string; // Added by frontend before sending to execute-fill
}

export interface MatchPlan {
  fills: Fill[];
  total_filled: string;
  fully_fillable: boolean;
}

export interface Trade {
  trade_id: string;
  order_id: string;
  buyer: string;
  token_amount: string;
  cny_amount: string;
  payment_nonce: string;
  created_at: number;
  expires_at: number;
  status: number; // 0=PENDING, 1=SETTLED, 2=EXPIRED
  escrow_tx_hash?: string;
  settlement_tx_hash?: string;
  proof_hash?: string;
  pdf_filename?: string;  // Added for PDF support
  pdf_uploaded_at?: string; // Added for PDF support
  token?: string;  // Token address (joined from orders table)
}

// Trade result from execute-fill endpoint (has payment details)
export interface TradeResult {
  trade_id: string;
  order_id: string;
  tx_hash: string;
  alipay_id: string;
  alipay_name: string;
  payment_nonce: string;
  expires_at: number;
}

// Extended trade result with CNY amount calculated by frontend
export interface TradeResultWithCNY extends TradeResult {
  cny_amount: string;
}

// API client
export const api = {
  // Get all active orders
  async getActiveOrders(limit?: number): Promise<Order[]> {
    const response = await axios.get(`${API_BASE}/api/orders/active`, {
      params: { limit },
    });
    return response.data.orders || [];
  },

  // Get orders by seller address
  async getOrdersBySeller(sellerAddress: string): Promise<{ orders: Order[] }> {
    const response = await axios.get(`${API_BASE}/api/orders/active`, {
      params: { seller: sellerAddress.toLowerCase() },
    });
    return response.data;
  },

  // Get trades by buyer address
  async getTradesByBuyer(buyerAddress: string): Promise<{ trades: Trade[] }> {
    const response = await axios.get(`${API_BASE}/api/trades/buyer/${buyerAddress.toLowerCase()}`);
    return response.data;
  },

  // Get single order
  async getOrder(orderId: string): Promise<Order> {
    const response = await axios.get(`${API_BASE}/api/orders/${orderId}`);
    return response.data;
  },

  // Match buy intent
  async matchIntent(tokenAddress: string, desiredAmount: string, maxRate?: string): Promise<MatchPlan> {
    const response = await axios.post(`${API_BASE}/api/match-intent`, {
      token_address: tokenAddress,
      desired_amount: desiredAmount,
      max_rate: maxRate,
    });
    return response.data;
  },

  // Execute fill (relayer calls fillOrder)
  async executeFill(matchPlan: MatchPlan, buyerAddress: string): Promise<TradeResult[]> {
    const response = await axios.post(`${API_BASE}/api/execute-fill`, {
      match_plan: matchPlan,
      buyer_address: buyerAddress,
    });
    return response.data.trades || [];
  },

  // Get trade details
  async getTrade(tradeId: string): Promise<Trade> {
    const response = await axios.get(`${API_BASE}/api/trades/${tradeId}`);
    return response.data;
  },

  // Submit payment proof (for testing)
  async submitProof(
    tradeId: string,
    isValid: boolean
  ): Promise<{ tx_hash: string; trade_id: string; status: string }> {
    const response = await axios.post(`${API_BASE}/api/submit-proof`, {
      trade_id: tradeId,
      is_valid: isValid,
    });
    return response.data;
  },

  // Upload PDF for a trade
  async uploadPdf(tradeId: string, pdfFile: File): Promise<{ trade_id: string; filename: string; size: number; uploaded_at: string }> {
    const formData = new FormData();
    formData.append('pdf', pdfFile);
    
    const response = await axios.post(`${API_BASE}/api/trades/${tradeId}/pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get PDF URL for a trade
  getPdfUrl(tradeId: string): string {
    return `${API_BASE}/api/trades/${tradeId}/pdf`;
  },

  // Validate PDF using Axiom Execute Mode (fast validation)
  async validatePdfAxiom(tradeId: string): Promise<{
    is_valid: boolean;
    expected_hash: string;
    actual_hash: string;
    details: string;
  }> {
    const response = await axios.post(`${API_BASE}/api/validate-pdf-axiom`, {
      trade_id: tradeId,
    });
    return response.data;
  },

  // Get debug data
  async getDebugData(): Promise<{ orders: Order[]; trades: Trade[] }> {
    const response = await axios.get(`${API_BASE}/api/debug/database`);
    return response.data;
  },

  // ============ Admin Endpoints ============

  // Get current contract configuration
  async getContractConfig(): Promise<{
    min_trade_value_cny: string;
    max_trade_value_cny: string;
    payment_window: string;
    paused: boolean;
    zk_verifier: string;
    public_key_der_hash: string;
    app_exe_commit: string;
    app_vm_commit: string;
  }> {
    const response = await axios.get(`${API_BASE}/api/admin/config`);
    return response.data;
  },

  // Update contract configuration
  async updateConfig(
    minTradeValueCny?: number,
    maxTradeValueCny?: number,
    paymentWindow?: number
  ): Promise<{ tx_hash: string; message: string }> {
    const response = await axios.post(`${API_BASE}/api/admin/update-config`, {
      min_trade_value_cny: minTradeValueCny,
      max_trade_value_cny: maxTradeValueCny,
      payment_window: paymentWindow,
    });
    return response.data;
  },

  // Update zkPDF verifier contract
  async updateVerifier(
    newVerifierAddress: string
  ): Promise<{ tx_hash: string; message: string }> {
    const response = await axios.post(`${API_BASE}/api/admin/update-verifier`, {
      new_verifier_address: newVerifierAddress,
    });
    return response.data;
  },

  // Update zkPDF configuration (public key hash and commitments)
  async updateZkPDFConfig(
    publicKeyDerHash: string,
    appExeCommit: string,
    appVmCommit: string
  ): Promise<{ tx_hash: string; message: string }> {
    const response = await axios.post(`${API_BASE}/api/admin/update-zkpdf-config`, {
      public_key_der_hash: publicKeyDerHash,
      app_exe_commit: appExeCommit,
      app_vm_commit: appVmCommit,
    });
    return response.data;
  },

  // Pause the contract
  async pauseContract(): Promise<{ tx_hash: string; message: string }> {
    const response = await axios.post(`${API_BASE}/api/admin/pause`);
    return response.data;
  },

  // Unpause the contract
  async unpauseContract(): Promise<{ tx_hash: string; message: string }> {
    const response = await axios.post(`${API_BASE}/api/admin/unpause`);
    return response.data;
  },

  // Generate Axiom proof for a trade
  async generateProof(tradeId: string): Promise<{
    success: boolean;
    message: string;
    proof_id?: string;
  }> {
    const response = await axios.post(`${API_BASE}/api/generate-proof`, {
      trade_id: tradeId,
    });
    return response.data;
  },

  // Submit proof to blockchain for settlement
  async submitBlockchainProof(tradeId: string): Promise<{
    success: boolean;
    tx_hash: string;
    message: string;
  }> {
    const response = await axios.post(`${API_BASE}/api/submit-blockchain-proof`, {
      trade_id: tradeId,
    });
    return response.data;
  },
};

