import { OrderList } from '@/components/orders/OrderList';

export default function HomePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          zkAliPay
        </h1>
        <p className="text-lg text-muted-foreground">
          Peer-to-peer CNY ↔ Token exchange with zero-knowledge proofs
        </p>
      </div>

      {/* Order List */}
      <OrderList />
    </div>
  );
}
